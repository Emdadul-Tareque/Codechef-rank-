import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchCodeChefProfile } from '@/lib/codechefScraper';
import { cleanHandle } from '@/lib/handleUtils';
import { BatchApiResponse, CodeChefResult } from '@/lib/types';

// Keep this comfortably under whatever maxDuration is configured
// (see vercel.json — default 60s). We stop dispatching new work once we're
// this close to the wall so the response always makes it back, even on
// plans/configs where the platform timeout is shorter than expected.
const WALL_CLOCK_BUDGET_MS = 45_000;

const MAX_HANDLES_PER_REQUEST = 60;
const DEFAULT_CONCURRENCY = 3;
const MAX_CONCURRENCY = 6;
const MAX_ATTEMPTS = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(baseMs: number): number {
  return baseMs + Math.random() * baseMs * 0.5;
}

const RETRYABLE: ReadonlySet<string> = new Set(['blocked', 'error']);

async function fetchWithRetry(handle: string, deadline: number): Promise<CodeChefResult> {
  let attempt = 0;
  let last: CodeChefResult | null = null;
  while (attempt < MAX_ATTEMPTS) {
    if (Date.now() > deadline) {
      return (
        last || {
          handle,
          status: 'error',
          currentRating: null,
          highestRating: null,
          stars: null,
          countryName: null,
          note: 'Ran out of time before this handle could be fetched — retry it in the next run.',
        }
      );
    }
    last = await fetchCodeChefProfile(handle);
    if (!RETRYABLE.has(last.status)) return last;
    attempt++;
    if (attempt < MAX_ATTEMPTS) {
      await sleep(jitter(1500 * 2 ** attempt)); // 3s, 6s (+jitter) — real-world CodeChef 429s need more room than a quick retry
    }
  }
  return last!;
}

/** Simple bounded-concurrency pool — no external dependency needed. */
async function runPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function next(): Promise<void> {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await worker(items[idx]);
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => next());
  await Promise.all(runners);
  return results;
}

export const config = {
  api: {
    bodyParser: { sizeLimit: '2mb' },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<BatchApiResponse | { error: string }>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed — POST a JSON body of { handles: string[] }' });
  }

  const startedAt = Date.now();
  const deadline = startedAt + WALL_CLOCK_BUDGET_MS;

  let body: any;
  try {
    body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const rawHandles = body?.handles;
  if (!Array.isArray(rawHandles) || rawHandles.length === 0) {
    return res.status(400).json({ error: '"handles" must be a non-empty array of strings' });
  }
  if (rawHandles.length > MAX_HANDLES_PER_REQUEST) {
    return res.status(400).json({
      error: `Too many handles in one request (${rawHandles.length}). Send at most ${MAX_HANDLES_PER_REQUEST} per call and loop client-side — this keeps each call well inside the serverless time budget.`,
    });
  }

  const requestedConcurrency = Number(body?.concurrency) || DEFAULT_CONCURRENCY;
  const concurrency = Math.max(1, Math.min(MAX_CONCURRENCY, requestedConcurrency));

  // De-dupe within this batch (two students can share a mistyped handle) —
  // fetch each unique handle once, then fan the result back out.
  const cleaned = rawHandles.map((h) => cleanHandle(h));
  const uniqueHandles = Array.from(new Set(cleaned.filter(Boolean)));

  const uniqueResults = await runPool(uniqueHandles, concurrency, (h) => fetchWithRetry(h, deadline));
  const byHandle = new Map(uniqueResults.map((r) => [r.handle, r]));

  const results = cleaned.map((h, i) => {
    if (!h) {
      const r: CodeChefResult = {
        handle: String(rawHandles[i] ?? ''),
        status: 'no_handle',
        currentRating: null,
        highestRating: null,
        stars: null,
        countryName: null,
        note: 'Blank handle',
      };
      return { handle: String(rawHandles[i] ?? ''), result: r };
    }
    const r = byHandle.get(h)!;
    return { handle: h, result: r };
  });

  const blockedCount = results.filter((r) => r.result.status === 'blocked').length;
  const blockRate = results.length > 0 ? blockedCount / results.length : 0;

  // Adaptive backpressure: tell the client how long to breathe before the
  // next batch, scaled to how much CodeChef is currently pushing back.
  let suggestedDelayMs = 300;
  if (blockRate > 0.5) suggestedDelayMs = 15000;
  else if (blockRate > 0.2) suggestedDelayMs = 6000;
  else if (blockRate > 0) suggestedDelayMs = 2000;

  const response: BatchApiResponse = {
    results,
    meta: {
      requested: rawHandles.length,
      completed: results.filter((r) => r.result.status !== 'error' || true).length,
      blockedCount,
      elapsedMs: Date.now() - startedAt,
      suggestedDelayMs,
    },
  };

  return res.status(200).json(response);
}
