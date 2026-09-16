import { CodeChefResult, ContestHistoryEntry, FetchStatus } from './types';
import { isPlausibleHandle } from './handleUtils';
import { starsForRating } from './starTier';

// Bounds worst-case localStorage size (this history is cached per-handle) —
// generous enough that no realistic student's real contest count gets truncated.
const MAX_HISTORY_ENTRIES = 80;

// Fixed per this Parse.bot marketplace API instance
// (https://parse.bot/marketplace/57b88850-0922-4fec-9b43-39f9fa21bd9b/codechef-com-api).
// Overridable via env var in case you later "subscribe" to your own pinned
// copy on Parse.bot, which gets its own endpoint URL.
const PARSE_BOT_ENDPOINT =
  process.env.PARSE_BOT_ENDPOINT ||
  'https://api.parse.bot/scraper/6aa4e6fb-1d6a-4c05-aeaf-d2996e380e80/get_user_info';

interface ParseBotRatingEntry {
  code: string;
  rating: string; // numeric string, e.g. "1767"
  rank: string; // per-contest rank, not a stable profile-level stat — not surfaced in the dashboard
  name: string;
  end_date: string; // "2023-09-20 22:00:02"
  color?: string;
}

interface ParseBotUserData {
  currentUser: string | null;
  date_versus_rating?: {
    all?: ParseBotRatingEntry[];
    all_old?: ParseBotRatingEntry[];
    dsa_monday?: ParseBotRatingEntry[]; // separate contest track — deliberately excluded from "Max Rank"
  };
  user_initial_ratings?: {
    all?: number;
    all_old?: number;
    dsa_monday?: number;
  };
}

interface ParseBotResponse {
  status: string; // "success" | "error" (exact error shape unconfirmed — handled defensively below)
  data?: ParseBotUserData;
  message?: string;
  error?: string;
}

function blank(status: FetchStatus, note: string, handle: string): CodeChefResult {
  return {
    handle,
    status,
    currentRating: null,
    highestRating: null,
    stars: null,
    countryName: null,
    note,
  };
}

export interface ScraperOptions {
  timeoutMs?: number;
}

/**
 * Same contract as codechefScraper.ts's fetchCodeChefProfile — one attempt,
 * caller (pages/api/fetch-batch.ts) handles retry/backoff. Swap the import
 * in that file to switch between the two implementations.
 */
export async function fetchCodeChefProfile(
  handle: string,
  opts: ScraperOptions = {}
): Promise<CodeChefResult> {
  const timeoutMs = opts.timeoutMs ?? 15000;

  if (!handle) return blank('no_handle', 'No handle provided in source sheet', handle);
  if (!isPlausibleHandle(handle)) {
    return blank(
      'invalid_handle',
      `"${handle}" doesn't look like a valid CodeChef handle (unexpected characters/length)`,
      handle
    );
  }

  const apiKey = process.env.PARSE_BOT_API_KEY;
  if (!apiKey) {
    return blank(
      'error',
      '__NO_RETRY__PARSE_BOT_API_KEY environment variable is not set — add it in Vercel → Project → Settings → Environment Variables, then redeploy.',
      handle
    );
  }

  const url = new URL(PARSE_BOT_ENDPOINT);
  url.searchParams.set('username', handle);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let resp: Response;
  try {
    resp = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { 'X-API-Key': apiKey },
    });
  } catch (err: any) {
    const msg = err?.name === 'AbortError' ? 'Request timed out' : `Network error: ${err?.message || err}`;
    return blank('error', msg, handle);
  } finally {
    clearTimeout(timer);
  }

  if (resp.status === 429) {
    return blank(
      'blocked',
      "Parse.bot rate limit hit (429) — you're calling faster than your plan allows. Lower CONCURRENT_REQUESTS / raise BASE_DELAY_MS in pages/index.tsx to match your plan's req/min.",
      handle
    );
  }
  if (resp.status === 401 || resp.status === 403) {
    return blank(
      'error',
      `__NO_RETRY__Parse.bot rejected the API key (HTTP ${resp.status}) — check PARSE_BOT_API_KEY.`,
      handle
    );
  }
  if (!resp.ok) {
    return blank('error', `Parse.bot returned HTTP ${resp.status}`, handle);
  }

  let json: ParseBotResponse;
  try {
    json = await resp.json();
  } catch {
    return blank('error', 'Parse.bot response was not valid JSON', handle);
  }

  if (json.status !== 'success' || !json.data) {
    const msg = (json.message || json.error || '').toLowerCase();
    if (msg.includes('not found') || msg.includes('no such user') || msg.includes('does not exist')) {
      return blank('not_found', json.message || 'User not found', handle);
    }
    return blank('error', `Parse.bot: ${json.message || json.error || `unexpected status "${json.status}"`}`, handle);
  }

  const dvr = json.data.date_versus_rating || {};
  // "all" is the general/current rating track; "all_old" is pre-rating-system-change
  // history (CodeChef recalibrated ratings on 2022-12-20) — both are real contest
  // results for this user, so both count toward Highest Rating. "dsa_monday" is a
  // separate contest series and is intentionally left out of the main rating.
  const entries = [...(dvr.all || []), ...(dvr.all_old || [])];

  if (entries.length === 0) {
    return {
      handle,
      status: 'unrated',
      currentRating: null,
      highestRating: null,
      stars: null,
      countryName: null,
      note: 'Profile exists but has no rated-contest history yet',
    };
  }

  const ratings = entries
    .map((e) => ({ rating: parseInt(e.rating, 10), end_date: e.end_date, code: e.code, name: e.name }))
    .filter((e) => Number.isFinite(e.rating));

  if (ratings.length === 0) {
    return blank('error', 'Parse.bot returned contest entries but no parseable rating values', handle);
  }

  const highestRating = Math.max(...ratings.map((r) => r.rating));
  // Chronological order (ascending) — needed both for "current = most recent"
  // and for Contest Analysis to know each contest's *preceding* rating.
  const sortedByDate = [...ratings].sort((a, b) => (a.end_date < b.end_date ? -1 : a.end_date > b.end_date ? 1 : 0));
  const currentRating = sortedByDate[sortedByDate.length - 1].rating;

  const contestHistory: ContestHistoryEntry[] = sortedByDate.slice(-MAX_HISTORY_ENTRIES).map((e) => ({
    code: e.code,
    name: e.name,
    rating: e.rating,
    end_date: e.end_date,
  }));

  const initialRatingRaw = json.data.user_initial_ratings?.all;
  const initialRating = typeof initialRatingRaw === 'number' ? initialRatingRaw : null;

  return {
    handle,
    status: 'ok',
    currentRating,
    highestRating,
    stars: starsForRating(highestRating),
    countryName: null, // not exposed by this endpoint
    note: '',
    contestHistory,
    initialRating,
  };
}
