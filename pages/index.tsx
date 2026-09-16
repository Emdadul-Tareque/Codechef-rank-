import Head from 'next/head';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import UploadStep from '@/components/UploadStep';
import ColumnMappingStep from '@/components/ColumnMappingStep';
import UniversityMappingReview from '@/components/UniversityMappingReview';
import Dashboard from '@/components/Dashboard';
import { ColumnMapping, RawSheet, buildSourceRows, guessColumnMapping } from '@/lib/excelIO';
import { buildUniversityMapping, UniversityMappingResult } from '@/lib/universityMap';
import { isPlausibleHandle } from '@/lib/handleUtils';
import { BatchApiResponse, CodeChefResult, FetchStatus, JoinedRecord, SourceRow } from '@/lib/types';

type Step = 'upload' | 'mapping' | 'university_review' | 'dashboard';

const SESSION_KEY = 'phitron_codechef_session_v1';
// Persistent cache of resolved CodeChef results, keyed by handle — survives
// "Start over" and even a completely different file upload. If you have to
// re-upload after fixing a mistake (e.g. a wrong column mapping), every
// handle that was already successfully resolved is reused instantly instead
// of being re-fetched and potentially re-triggering CodeChef's rate limiting.
const RATINGS_CACHE_KEY = 'phitron_codechef_ratings_cache_v1';

// How many CodeChef profile requests are in flight at once, and how far
// apart, now that these go through the Parse.bot managed API
// (lib/parseBotScraper.ts) instead of scraping codechef.com directly.
// Parse.bot enforces a hard per-plan requests/minute cap and returns 429 if
// you exceed it — so pacing here must match whatever plan the API key is on:
//   Free: 5 req/min · Hobby: 20 req/min · Developer: 100 req/min · Team: 300 req/min
// Set PARSE_BOT_REQUESTS_PER_MINUTE below to your actual plan. Defaulting to
// the Free tier's 5/min is deliberately conservative — raise it once you've
// confirmed which plan the key is actually on.
const PARSE_BOT_REQUESTS_PER_MINUTE = 5;
const CONCURRENT_REQUESTS = 1; // single-file pacing is the simplest way to guarantee the req/min cap is respected
const BASE_DELAY_MS = Math.ceil(60000 / PARSE_BOT_REQUESTS_PER_MINUTE);
const RECENT_WINDOW = 15; // how many recent outcomes we look at to detect a block streak

const TERMINAL_STATUSES: ReadonlySet<FetchStatus> = new Set(['ok', 'not_found', 'unrated', 'invalid_handle', 'no_handle']);

interface SessionState {
  fingerprint: string;
  sourceRows: SourceRow[];
  universityMapping: UniversityMappingResult;
  results: Record<string, CodeChefResult>;
  savedAt: number;
}

function fingerprintFor(rows: SourceRow[]): string {
  const handles = rows.map((r) => r.handle).filter(Boolean);
  return `${handles.length}:${handles.slice(0, 3).join(',')}:${handles.slice(-3).join(',')}`;
}

function loadSession(): SessionState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionState;
  } catch {
    return null;
  }
}

function saveSession(state: SessionState) {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded or storage disabled — non-fatal, just means no resume.
  }
}

function clearSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* noop */
  }
}

function loadRatingsCache(): Record<string, CodeChefResult> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(RATINGS_CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, CodeChefResult>;
  } catch {
    return {};
  }
}

function saveRatingsCache(cache: Record<string, CodeChefResult>) {
  try {
    window.localStorage.setItem(RATINGS_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Non-fatal — worst case this run just doesn't benefit from caching.
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function emptyCounts() {
  return { ok: 0, not_found: 0, unrated: 0, blocked: 0, error: 0, invalid_handle: 0, no_handle: 0, pending: 0 };
}

export default function Home() {
  const [step, setStep] = useState<Step>('upload');
  const [rawSheet, setRawSheet] = useState<RawSheet | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [sourceRows, setSourceRows] = useState<SourceRow[]>([]);
  const [universityMapping, setUniversityMapping] = useState<UniversityMappingResult | null>(null);
  const [results, setResults] = useState<Record<string, CodeChefResult>>({});
  const [isFetching, setIsFetching] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [statusLine, setStatusLine] = useState('');
  const [savedSession, setSavedSession] = useState<SessionState | null>(null);

  const cancelRef = useRef(false);
  const resultsRef = useRef(results);
  resultsRef.current = results;
  const ratingsCacheRef = useRef<Record<string, CodeChefResult>>({});

  useEffect(() => {
    setSavedSession(loadSession());
    ratingsCacheRef.current = loadRatingsCache();
  }, []);

  const cacheIfTerminal = useCallback((handle: string, result: CodeChefResult) => {
    if (!TERMINAL_STATUSES.has(result.status)) return;
    ratingsCacheRef.current = { ...ratingsCacheRef.current, [handle]: result };
    saveRatingsCache(ratingsCacheRef.current);
  }, []);

  const persist = useCallback((rows: SourceRow[], uniMap: UniversityMappingResult, res: Record<string, CodeChefResult>) => {
    saveSession({ fingerprint: fingerprintFor(rows), sourceRows: rows, universityMapping: uniMap, results: res, savedAt: Date.now() });
  }, []);

  // ---------------------------------------------------------------------
  // Step 1: upload
  // ---------------------------------------------------------------------
  const handleLoaded = (sheet: RawSheet, _file: File) => {
    setRawSheet(sheet);
    setColumnMapping(guessColumnMapping(sheet.headers));
    setStep('mapping');
  };

  const handleResume = () => {
    if (!savedSession) return;
    setSourceRows(savedSession.sourceRows);
    setUniversityMapping(savedSession.universityMapping);
    setResults(savedSession.results);
    setStep('dashboard');
    // Jump straight to the (already-live) dashboard and keep going on
    // whatever wasn't finished last time — already-resolved handles are
    // skipped automatically inside runFetchLoop.
    setTimeout(
      () => runFetchLoop(savedSession.sourceRows.map((r) => r.handle), savedSession.universityMapping, savedSession.sourceRows),
      0
    );
  };

  const handleDiscardSaved = () => {
    clearSession();
    setSavedSession(null);
  };

  // ---------------------------------------------------------------------
  // Step 2: column mapping confirmed -> build source rows
  // ---------------------------------------------------------------------
  const handleMappingConfirm = (mapping: ColumnMapping) => {
    if (!rawSheet) return;
    setColumnMapping(mapping);
    const { rows } = buildSourceRows(rawSheet, mapping);
    setSourceRows(rows);
    const uniResult = buildUniversityMapping(rows.map((r) => r.university));
    setUniversityMapping(uniResult);
    setStep('university_review');
  };

  // ---------------------------------------------------------------------
  // Step 3: university mapping confirmed -> apply + start fetching.
  // We jump straight to the dashboard: it renders immediately (all rows
  // "pending") and fills itself in live as results stream back, rather than
  // sitting behind a separate blocking progress screen.
  // ---------------------------------------------------------------------
  const handleUniversityConfirm = (uniResult: UniversityMappingResult) => {
    const updatedRows = sourceRows.map((r) => ({
      ...r,
      universityNormalized: uniResult.applyMap[r.university.trim()] || r.university,
    }));
    setSourceRows(updatedRows);
    setUniversityMapping(uniResult);

    // Pre-seed from the persistent ratings cache — if this exact handle was
    // already successfully resolved in a previous run (even a totally
    // different upload), reuse it instead of hitting CodeChef again.
    const seeded: Record<string, CodeChefResult> = {};
    for (const row of updatedRows) {
      const cached = row.handle && ratingsCacheRef.current[row.handle];
      if (cached) seeded[row.handle] = cached;
    }
    setResults(seeded);
    persist(updatedRows, uniResult, seeded);
    setStep('dashboard');
    setTimeout(() => runFetchLoop(updatedRows.map((r) => r.handle), uniResult, updatedRows), 0);
  };

  // ---------------------------------------------------------------------
  // Core fetch loop — shared by the initial run, "resume", and "retry".
  //
  // Each worker requests ONE handle at a time (not a batch of 25) so the
  // UI updates the instant that single result comes back. CONCURRENT_REQUESTS
  // workers run in parallel, each pulling the next handle off a shared
  // cursor — the same bounded-concurrency pattern used server-side, just
  // moved to the client so per-handle progress is visible.
  // ---------------------------------------------------------------------
  const runFetchLoop = useCallback(
    async (handles: string[], uniMap: UniversityMappingResult, rows: SourceRow[]) => {
      cancelRef.current = false;
      setIsFetching(true);
      setStatusLine('');

      const unique = Array.from(new Set(handles));
      const toFetch: string[] = [];
      const immediate: Record<string, CodeChefResult> = {};

      for (const h of unique) {
        if (!h) continue; // blank handled by JoinedRecord default ('no_handle')
        const existing = resultsRef.current[h];
        if (existing && TERMINAL_STATUSES.has(existing.status)) continue; // already resolved — don't re-fetch
        if (!isPlausibleHandle(h)) {
          immediate[h] = {
            handle: h,
            status: 'invalid_handle',
            currentRating: null,
            highestRating: null,
            stars: null,
            countryName: null,
            note: `"${h}" doesn't look like a valid CodeChef handle`,
          };
        } else {
          toFetch.push(h);
        }
      }

      let current = { ...resultsRef.current, ...immediate };
      setResults(current);
      persist(rows, uniMap, current);
      for (const [h, r] of Object.entries(immediate)) cacheIfTerminal(h, r);

      if (toFetch.length === 0) {
        setIsFetching(false);
        setStatusLine('Done.');
        return;
      }

      setStatusLine(`Fetching ${toFetch.length} handle${toFetch.length === 1 ? '' : 's'}…`);

      // Rolling window of recent outcomes, shared across workers, used to
      // slow everyone down together if CodeChef starts pushing back.
      const recentOutcomes: FetchStatus[] = [];
      let extraDelayMs = 0;

      function recordOutcome(status: FetchStatus) {
        recentOutcomes.push(status);
        if (recentOutcomes.length > RECENT_WINDOW) recentOutcomes.shift();
        const blockedRecent = recentOutcomes.filter((s) => s === 'blocked' || s === 'error').length;
        // Scaled off BASE_DELAY_MS (itself derived from the plan's req/min)
        // rather than a fixed number, so this stays sensible whichever
        // Parse.bot plan PARSE_BOT_REQUESTS_PER_MINUTE is set to.
        if (blockedRecent >= 6) extraDelayMs = BASE_DELAY_MS * 4;
        else if (blockedRecent >= 3) extraDelayMs = BASE_DELAY_MS * 2;
        else if (blockedRecent >= 1) extraDelayMs = BASE_DELAY_MS;
        else extraDelayMs = 0;
      }

      let cursor = 0;
      let blockedTotal = 0;

      async function worker() {
        while (cursor < toFetch.length) {
          if (cancelRef.current) return;
          const idx = cursor++;
          const handle = toFetch[idx];

          try {
            const resp = await fetch('/api/fetch-batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ handles: [handle] }),
            });
            if (!resp.ok) {
              const err = await resp.json().catch(() => ({}));
              throw new Error(err?.error || `HTTP ${resp.status}`);
            }
            const data: BatchApiResponse = await resp.json();
            const item = data.results[0];
            current = { ...current, [item.handle]: item.result };
            setResults(current); // <-- fires immediately for this one handle
            persist(rows, uniMap, current);
            cacheIfTerminal(item.handle, item.result);
            recordOutcome(item.result.status);
            if (item.result.status === 'blocked') {
              blockedTotal++;
              setStatusLine(`CodeChef is pushing back — slowing down (${blockedTotal} blocked so far)…`);
            }
          } catch (e: any) {
            current = {
              ...current,
              [handle]: {
                handle,
                status: 'error' as FetchStatus,
                currentRating: null,
                highestRating: null,
                stars: null,
                countryName: null,
                note: `Request failed: ${e?.message || e}. Safe to retry from the dashboard.`,
              },
            };
            setResults(current);
            persist(rows, uniMap, current);
            recordOutcome('error');
          }

          if (cancelRef.current) return;
          await sleep(BASE_DELAY_MS + extraDelayMs + Math.random() * 200);
        }
      }

      const workers = Array.from({ length: Math.min(CONCURRENT_REQUESTS, toFetch.length) }, () => worker());
      await Promise.all(workers);

      setIsFetching(false);
      setStatusLine(cancelRef.current ? 'Paused.' : 'Done.');
    },
    [persist, cacheIfTerminal]
  );

  const handleCancelFetch = () => {
    cancelRef.current = true;
  };

  const handleRetryHandles = async (handles: string[]) => {
    if (!universityMapping) return;
    setRetrying(true);
    await runFetchLoop(handles, universityMapping, sourceRows);
    setRetrying(false);
  };

  const handleStartOver = () => {
    clearSession();
    setRawSheet(null);
    setColumnMapping({});
    setSourceRows([]);
    setUniversityMapping(null);
    setResults({});
    setSavedSession(null);
    setStep('upload');
  };

  // ---------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------
  const records: JoinedRecord[] = useMemo(
    () =>
      sourceRows.map((row) => ({
        ...row,
        result:
          results[row.handle] ||
          ({
            handle: row.handle,
            status: (row.handle ? 'pending' : 'no_handle') as FetchStatus,
            currentRating: null,
            highestRating: null,
            stars: null,
            countryName: null,
            note: row.handle ? '' : 'No handle provided',
          } as CodeChefResult),
      })),
    [sourceRows, results]
  );

  const progressCounts = useMemo(() => {
    const c = emptyCounts();
    for (const r of records) {
      const s = r.result.status;
      if (s in c) (c as any)[s]++;
    }
    return c;
  }, [records]);

  const done = records.length - progressCounts.pending;

  return (
    <>
      <Head>
        <title>Phitron · CodeChef Performance Dashboard</title>
        <meta name="description" content="Bulk CodeChef rating lookup and batch/university leaderboard for Phitron." />
      </Head>
      <div className="min-h-screen bg-slate-950 px-4 py-10">
        <header className="mx-auto mb-8 max-w-6xl">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-400">Phitron</p>
          <h1 className="text-2xl font-bold text-slate-100">CodeChef Performance Dashboard</h1>
        </header>

        {step === 'upload' && (
          <UploadStep
            onLoaded={handleLoaded}
            savedProgressBanner={
              savedSession
                ? { count: Object.keys(savedSession.results).length, total: savedSession.sourceRows.length }
                : null
            }
            onResume={handleResume}
            onDiscardSaved={handleDiscardSaved}
          />
        )}

        {step === 'mapping' && rawSheet && (
          <ColumnMappingStep
            sheet={rawSheet}
            initialMapping={columnMapping}
            onConfirm={handleMappingConfirm}
            onBack={() => setStep('upload')}
          />
        )}

        {step === 'university_review' && universityMapping && (
          <UniversityMappingReview
            initial={universityMapping}
            onConfirm={handleUniversityConfirm}
            onBack={() => setStep('mapping')}
          />
        )}

        {step === 'dashboard' && universityMapping && (
          <Dashboard
            records={records}
            universityClusters={universityMapping.clusters}
            onRetryHandles={handleRetryHandles}
            retrying={retrying}
            onEditUniversityMapping={() => setStep('university_review')}
            onStartOver={handleStartOver}
            isFetching={isFetching}
            fetchDone={done}
            fetchTotal={records.length}
            fetchCounts={progressCounts}
            fetchStatusLine={statusLine}
            onCancelFetch={handleCancelFetch}
          />
        )}
      </div>
    </>
  );
}
