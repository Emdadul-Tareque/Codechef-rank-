import * as cheerio from 'cheerio';
import { CodeChefResult, FetchStatus } from './types';
import { isPlausibleHandle } from './handleUtils';

// A small rotation of realistic desktop user-agents. This is not an attempt
// to "spoof" identity maliciously — it just avoids every single request
// looking identical, which is one of the easiest bot-fingerprint signals.
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
];

function pickUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

const STAR_BANDS: Array<{ floor: number; stars: number }> = [
  { floor: 2500, stars: 7 },
  { floor: 2200, stars: 6 },
  { floor: 2000, stars: 5 },
  { floor: 1800, stars: 4 },
  { floor: 1600, stars: 3 },
  { floor: 1400, stars: 2 },
  { floor: 0, stars: 1 },
];
function starsForRating(rating: number | null): number | null {
  if (rating === null) return null;
  for (const b of STAR_BANDS) if (rating >= b.floor) return b.stars;
  return 1;
}

function blank(status: FetchStatus, note: string): CodeChefResult {
  return {
    handle: '',
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
 * Fetches and parses ONE CodeChef profile. Makes exactly one HTTP attempt —
 * callers are responsible for retry/backoff (see pages/api/fetch-batch.ts),
 * since retry policy needs visibility across the whole batch, not just one
 * handle.
 */
export async function fetchCodeChefProfile(
  handle: string,
  opts: ScraperOptions = {}
): Promise<CodeChefResult> {
  const timeoutMs = opts.timeoutMs ?? 12000;

  if (!handle) {
    return { ...blank('no_handle', 'No handle provided in source sheet'), handle };
  }
  if (!isPlausibleHandle(handle)) {
    return {
      ...blank(
        'invalid_handle',
        `"${handle}" doesn't look like a valid CodeChef handle (unexpected characters/length)`
      ),
      handle,
    };
  }

  const url = `https://www.codechef.com/users/${encodeURIComponent(handle)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let resp: Response;
  try {
    resp = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': pickUserAgent(),
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
  } catch (err: any) {
    const msg = err?.name === 'AbortError' ? 'Request timed out' : `Network error: ${err?.message || err}`;
    return { ...blank('error', msg), handle };
  } finally {
    clearTimeout(timer);
  }

  if (resp.status === 404) {
    return { ...blank('not_found', 'CodeChef returned 404 — no such profile'), handle };
  }
  if (resp.status === 429 || resp.status === 503 || resp.status === 403) {
    const retryAfter = resp.headers.get('retry-after');
    return {
      ...blank(
        'blocked',
        `CodeChef responded ${resp.status}${retryAfter ? ` (Retry-After: ${retryAfter}s)` : ''} — likely rate-limited/bot-checked`
      ),
      handle,
    };
  }
  if (!resp.ok) {
    return { ...blank('error', `Unexpected HTTP ${resp.status}`), handle };
  }

  const html = await resp.text();

  // Cloudflare / bot-challenge pages sometimes come back as HTTP 200.
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = (titleMatch?.[1] || '').toLowerCase();
  if (title.includes('just a moment') || title.includes('attention required')) {
    return { ...blank('blocked', 'Bot-challenge page returned instead of profile'), handle };
  }

  if (/user\s+not\s+found/i.test(html)) {
    return { ...blank('not_found', 'Profile page reports user not found'), handle };
  }

  const $ = cheerio.load(html);

  // Primary path: CodeChef's own markup.
  let currentRating: number | null = null;
  const ratingNumberText = $('.rating-number').first().text().trim();
  if (ratingNumberText) {
    const m = ratingNumberText.match(/\d+/);
    if (m) currentRating = parseInt(m[0], 10);
  }

  let highestRating: number | null = null;
  const headerSmallText = $('.rating-header small').first().text().trim();
  if (headerSmallText) {
    const m = headerSmallText.match(/(?:highest|max)\s*rating\s*(\d+)/i);
    if (m) highestRating = parseInt(m[1], 10);
  }

  // Fallback: same phrase can appear elsewhere in the DOM/HTML if CodeChef
  // tweaks class names; search the raw HTML text as a safety net.
  if (highestRating === null) {
    const m = html.match(/(?:highest|max)[\s_-]*rating[^0-9]{0,15}(\d{3,4})/i);
    if (m) highestRating = parseInt(m[1], 10);
  }

  // Country, shown near the top of the profile card — nice-to-have, not critical.
  let countryName: string | null = null;
  const countryText = $('.user-country-name').first().text().trim();
  if (countryText) countryName = countryText;

  if (currentRating === null && highestRating === null) {
    // A genuinely valid profile that has never played a rated contest shows
    // no rating badge at all. Distinguish that from "we failed to parse" by
    // checking for other profile chrome that only exists on a real page.
    const looksLikeRealProfile =
      $('.user-details-container').length > 0 ||
      $('.side-bar').length > 0 ||
      new RegExp(handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(html);

    if (looksLikeRealProfile) {
      return {
        handle,
        status: 'unrated',
        currentRating: null,
        highestRating: null,
        stars: null,
        countryName,
        note: 'Profile exists but has no rated-contest history yet',
      };
    }
    return {
      ...blank('error', 'Could not locate rating data — CodeChef may have changed its page layout'),
      handle,
    };
  }

  const finalHighest = highestRating ?? currentRating;
  return {
    handle,
    status: 'ok',
    currentRating,
    highestRating: finalHighest,
    stars: starsForRating(finalHighest),
    countryName,
    note: '',
  };
}
