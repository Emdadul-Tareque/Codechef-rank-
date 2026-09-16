// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/** One row as it exists in the uploaded source Excel, after column mapping. */
export interface SourceRow {
  rowIndex: number; // 1-based row number in the ORIGINAL sheet (for error reporting)
  name: string;
  batch: string;
  handleRaw: string; // exactly as typed by whoever filled the sheet
  handle: string; // cleaned (trimmed, URL-stripped, invisible chars removed)
  university: string; // as typed
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

export interface CodeChefResult {
  handle: string;
  status: FetchStatus;
  currentRating: number | null;
  highestRating: number | null;
  stars: number | null; // 1-7, null if never rated
  countryName: string | null;
  note: string;
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
