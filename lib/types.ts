// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/** One row as it exists in the uploaded source Excel, after column mapping. */
export interface SourceRow {
  rowIndex: number; // 1-based row number in the ORIGINAL sheet (for error reporting)
  name: string;
  batch: string;
  email: string;
  phone: string;
  handleRaw: string; // exactly as typed by whoever filled the sheet
  handle: string; // cleaned (trimmed, URL-stripped, invisible chars removed)
  university: string; // "Institute Name" as typed
  universityNormalized: string; // after mapping/clustering
}

export type FetchStatus =
  | 'pending'
  | 'fetching'
  | 'ok'
  | 'not_found'
  | 'unrated'
  | 'invalid_handle'
  | 'no_handle'
  | 'blocked'
  | 'error';

/** One entry in a student's per-contest rating history (from Parse.bot's date_versus_rating). */
export interface ContestHistoryEntry {
  code: string; // e.g. "START101B" — unique per division
  name: string; // e.g. "Starters 101 Division 2 (Rated)"
  rating: number; // rating AFTER this contest
  rank: number; // this student's rank IN this specific contest
  end_date: string; // "YYYY-MM-DD HH:mm:ss"
}

export interface CodeChefResult {
  handle: string;
  status: FetchStatus;
  currentRating: number | null;
  highestRating: number | null;
  stars: number | null; // 1-7, null if never rated
  countryName: string | null;
  note: string;
  // Optional — only populated by lib/parseBotScraper.ts (the direct-scrape
  // fallback in lib/codechefScraper.ts doesn't extract full history). Used
  // by the Contest Analysis section. Sorted ascending by end_date, capped to
  // a reasonable length. Always read as `result.contestHistory || []` since
  // older cached entries (from before this field existed) won't have it.
  contestHistory?: ContestHistoryEntry[];
  initialRating?: number | null; // starting rating before their first-ever contest (usually 1000)
}

/** A fully joined record: source row + fetched CodeChef data. */
export interface JoinedRecord extends SourceRow {
  result: CodeChefResult;
}

export interface UniversityCluster {
  canonical: string;
  variants: string[]; // raw strings from the sheet that map to this canonical name
  count: number;
}

export interface BatchApiRequest {
  handles: string[];
}

export interface BatchApiResponseItem {
  handle: string;
  result: CodeChefResult;
}

export interface BatchApiResponse {
  results: BatchApiResponseItem[];
  meta: {
    requested: number;
    completed: number;
    blockedCount: number;
    elapsedMs: number;
    suggestedDelayMs: number; // adaptive: client should wait this long before next batch
  };
}
