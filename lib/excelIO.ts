import * as XLSX from 'xlsx';
import { cleanHandle, normalizeHeader } from './handleUtils';
import { JoinedRecord, SourceRow, UniversityCluster } from './types';
import { tierLabelForResult } from './starTier';
import { ContestParticipant } from './contestAnalysis';

// ---------------------------------------------------------------------------
// Reading the uploaded roster
// ---------------------------------------------------------------------------

export interface RawSheet {
  headers: string[];
  rows: string[][];
  sheetName: string;
  otherSheetNames: string[];
}

export async function readWorkbookFile(file: File): Promise<RawSheet> {
  const buf = await file.arrayBuffer();
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: 'array' });
  } catch (e: any) {
    throw new Error(
      `Could not open "${file.name}" as an Excel file. Make sure it's a valid .xlsx/.xls/.csv file (error: ${e?.message || e}).`
    );
  }

  if (!wb.SheetNames.length) {
    throw new Error('The workbook has no sheets.');
  }
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json<string[]>(ws, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  });

  if (aoa.length === 0) {
    throw new Error(`Sheet "${sheetName}" appears to be empty.`);
  }

  const headers = (aoa[0] || []).map((h) => String(h ?? '').trim());
  const rows = aoa.slice(1).map((r) => headers.map((_, i) => String(r?.[i] ?? '').trim()));

  return {
    headers,
    rows,
    sheetName,
    otherSheetNames: wb.SheetNames.slice(1),
  };
}

// ---------------------------------------------------------------------------
// Flexible column detection
// ---------------------------------------------------------------------------

function bigrams(s: string): Set<string> {
  const g = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) g.add(s.slice(i, i + 2));
  return g;
}
function diceSimilarity(a: string, b: string): number {
  const ga = bigrams(a);
  const gb = bigrams(b);
  if (ga.size === 0 || gb.size === 0) return a === b ? 1 : 0;
  let overlap = 0;
  for (const g of ga) if (gb.has(g)) overlap++;
  return (2 * overlap) / (ga.size + gb.size);
}

interface FieldSpec {
  key: 'batch' | 'name' | 'email' | 'phone' | 'university' | 'handle';
  substrings: string[]; // normalized substrings that count as a confident match
  fuzzyTargets: string[]; // normalized words to fuzzy-match against as a fallback
}

// Order matches the roster template: Batch, Name, Email, Phone Number,
// Institute Name, CodeChef Handle.
const FIELD_SPECS: FieldSpec[] = [
  { key: 'batch', substrings: ['batch'], fuzzyTargets: ['batch'] },
  { key: 'name', substrings: ['name'], fuzzyTargets: ['name'] },
  { key: 'email', substrings: ['email', 'mail'], fuzzyTargets: ['email', 'emailaddress'] },
  {
    key: 'phone',
    substrings: ['phone', 'mobile', 'cell', 'contactno', 'contactnumber'],
    fuzzyTargets: ['phonenumber', 'mobilenumber', 'contact'],
  },
  {
    key: 'university',
    substrings: ['institut', 'univers', 'college'],
    fuzzyTargets: ['institutename', 'university', 'institution'],
  },
  {
    key: 'handle',
    substrings: ['codechef', 'handle', 'ccid', 'ccprofile'],
    fuzzyTargets: ['codechefhandle', 'handle'],
  },
];

export type ColumnMapping = Partial<Record<FieldSpec['key'], number>>;

/** Best-effort auto-detection of which column is which — always shown to the user to confirm/override. */
export function guessColumnMapping(headers: string[]): ColumnMapping {
  const normalized = headers.map((h) => normalizeHeader(h));
  const mapping: ColumnMapping = {};
  const used = new Set<number>();

  for (const spec of FIELD_SPECS) {
    let bestIdx = -1;
    let bestScore = 0;
    normalized.forEach((h, idx) => {
      if (used.has(idx) || !h) return;
      let score = 0;
      if (spec.substrings.some((s) => h.includes(s))) score = 1;
      else {
        for (const target of spec.fuzzyTargets) {
          score = Math.max(score, diceSimilarity(h, target));
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    });
    if (bestIdx >= 0 && bestScore >= 0.45) {
      mapping[spec.key] = bestIdx;
      used.add(bestIdx);
    }
  }
  return mapping;
}

export function buildSourceRows(sheet: RawSheet, mapping: ColumnMapping): {
  rows: SourceRow[];
  skippedBlankRows: number;
} {
  const rows: SourceRow[] = [];
  let skippedBlankRows = 0;

  sheet.rows.forEach((r, i) => {
    const name = mapping.name !== undefined ? (r[mapping.name] || '').trim() : '';
    const batch = mapping.batch !== undefined ? (r[mapping.batch] || '').trim() : '';
    const email = mapping.email !== undefined ? (r[mapping.email] || '').trim() : '';
    const phone = mapping.phone !== undefined ? (r[mapping.phone] || '').trim() : '';
    const handleRaw = mapping.handle !== undefined ? (r[mapping.handle] || '').trim() : '';
    const university = mapping.university !== undefined ? (r[mapping.university] || '').trim() : '';

    const allBlank = !name && !batch && !email && !phone && !handleRaw && !university;
    if (allBlank) {
      skippedBlankRows++;
      return;
    }

    rows.push({
      rowIndex: i + 2, // +1 for header row, +1 for 1-based numbering
      name: name || 'Unknown',
      batch: batch || 'Unknown',
      email, // left blank rather than "Unknown" — this is contact info, not a grouping category
      phone,
      handleRaw,
      handle: cleanHandle(handleRaw),
      university: university || 'Unknown',
      universityNormalized: university || 'Unknown', // filled in later by university mapping step
    });
  });

  return { rows, skippedBlankRows };
}

// ---------------------------------------------------------------------------
// Exporting results
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<string, string> = {
  ok: 'Found',
  not_found: 'Not Found',
  unrated: 'Unrated (no contest history)',
  invalid_handle: 'Invalid Handle Format',
  no_handle: 'No Handle Provided',
  blocked: 'Blocked / Rate-Limited (retry)',
  error: 'Error (retry)',
  pending: 'Pending',
  fetching: 'Fetching',
};

// The six roster-identity columns every export leads with, in the order the
// roster template itself uses: Batch, Name, Email, Phone Number, Institute
// Name, CodeChef Handle.
function identityColumns(r: JoinedRecord) {
  return {
    Batch: r.batch,
    Name: r.name,
    Email: r.email,
    'Phone Number': r.phone,
    'Institute Name': r.universityNormalized,
    'CodeChef Handle': r.handle || r.handleRaw,
  };
}
const IDENTITY_COL_WIDTHS = [{ wch: 12 }, { wch: 24 }, { wch: 28 }, { wch: 16 }, { wch: 42 }, { wch: 20 }];

export function exportResultWorkbook(records: JoinedRecord[], filename = 'codechef_ratings_result.xlsx') {
  const data = records.map((r) => ({
    ...identityColumns(r),
    'Max Rank': r.result.highestRating ?? '',
    'Current Rating': r.result.currentRating ?? '',
    'Star Tier': tierLabelForResult(r.result.highestRating),
    Status: STATUS_LABEL[r.result.status] || r.result.status,
    Notes: r.result.note,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [...IDENTITY_COL_WIDTHS, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 26 }, { wch: 45 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Results');
  XLSX.writeFile(wb, filename);
}

// ---------------------------------------------------------------------------
// Contest breakdown export — separate sheet per tab (Increased / Decreased /
// Did Not Participate / Summary), each carrying the full roster identity
// columns plus rating and per-contest-rank before/after.
// ---------------------------------------------------------------------------

export interface ContestParticipantRow extends ContestParticipant {}

function contestParticipantRow(p: ContestParticipantRow) {
  return {
    Batch: p.batch,
    Name: p.name,
    Email: p.email,
    'Phone Number': p.phone,
    'Institute Name': p.university,
    'CodeChef Handle': p.handle,
    'Contest Played': p.contestName,
    'Rating Before': p.ratingBefore,
    'Rating After': p.ratingAfter,
    'Rating Change': p.delta,
    'Rank Before': p.rankBefore ?? 'N/A (first contest)',
    'Rank After': p.rankAfter,
    'Rank Improved?': p.rankImproved === null ? 'N/A (first contest)' : p.rankImproved ? 'Yes' : 'No',
  };
}
const PARTICIPANT_COL_WIDTHS = [
  { wch: 12 },
  { wch: 24 },
  { wch: 28 },
  { wch: 16 },
  { wch: 42 },
  { wch: 20 },
  { wch: 32 },
  { wch: 12 },
  { wch: 12 },
  { wch: 12 },
  { wch: 16 },
  { wch: 12 },
  { wch: 16 },
];

export function exportContestBreakdownWorkbook(breakdown: {
  eventLabel: string;
  increased: ContestParticipantRow[];
  decreased: ContestParticipantRow[];
  unchanged: ContestParticipantRow[];
  didNotParticipate: JoinedRecord[];
  unresolved: JoinedRecord[];
}) {
  const wb = XLSX.utils.book_new();

  // --- Summary (always first sheet) ---
  const totalConsidered =
    breakdown.increased.length +
    breakdown.decreased.length +
    breakdown.unchanged.length +
    breakdown.didNotParticipate.length;
  const summaryRows = [
    { Metric: 'Contest', Value: breakdown.eventLabel || '(unnamed)' },
    { Metric: 'Rating increased', Value: breakdown.increased.length },
    { Metric: 'Rating decreased', Value: breakdown.decreased.length },
    { Metric: 'Rating unchanged', Value: breakdown.unchanged.length },
    { Metric: 'Did not participate', Value: breakdown.didNotParticipate.length },
    { Metric: 'Total students considered', Value: totalConsidered },
    { Metric: 'Excluded — CodeChef data not resolved yet', Value: breakdown.unresolved.length },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 38 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // --- Increased ---
  const wsInc = XLSX.utils.json_to_sheet(breakdown.increased.map(contestParticipantRow));
  wsInc['!cols'] = PARTICIPANT_COL_WIDTHS;
  XLSX.utils.book_append_sheet(wb, wsInc, 'Rating Increased');

  // --- Decreased ---
  const wsDec = XLSX.utils.json_to_sheet(breakdown.decreased.map(contestParticipantRow));
  wsDec['!cols'] = PARTICIPANT_COL_WIDTHS;
  XLSX.utils.book_append_sheet(wb, wsDec, 'Rating Decreased');

  // --- Unchanged (kept as its own small sheet rather than folded into either of the above) ---
  if (breakdown.unchanged.length > 0) {
    const wsUnch = XLSX.utils.json_to_sheet(breakdown.unchanged.map(contestParticipantRow));
    wsUnch['!cols'] = PARTICIPANT_COL_WIDTHS;
    XLSX.utils.book_append_sheet(wb, wsUnch, 'Rating Unchanged');
  }

  // --- Did Not Participate — full identity info, per the brief ---
  const notPlayedRows = breakdown.didNotParticipate.map((r) => identityColumns(r));
  const wsNotPlayed = XLSX.utils.json_to_sheet(notPlayedRows);
  wsNotPlayed['!cols'] = IDENTITY_COL_WIDTHS;
  XLSX.utils.book_append_sheet(wb, wsNotPlayed, 'Did Not Participate');

  // --- Unresolved (bonus — not requested, but avoids silently dropping students) ---
  if (breakdown.unresolved.length > 0) {
    const unresolvedRows = breakdown.unresolved.map((r) => ({
      ...identityColumns(r),
      Status: STATUS_LABEL[r.result.status] || r.result.status,
    }));
    const wsUnresolved = XLSX.utils.json_to_sheet(unresolvedRows);
    wsUnresolved['!cols'] = [...IDENTITY_COL_WIDTHS, { wch: 26 }];
    XLSX.utils.book_append_sheet(wb, wsUnresolved, 'Unresolved (Not Fetched Yet)');
  }

  const safeName = breakdown.eventLabel.replace(/[^a-z0-9]+/gi, '_').slice(0, 40) || 'contest';
  XLSX.writeFile(wb, `contest_breakdown_${safeName}.xlsx`);
}

export interface BatchStat {
  batch: string;
  total: number;
  tierCounts: Record<string, number>;
  avgHighestRating: number | null;
  foundCount: number;
}

export interface UniversityStat {
  university: string;
  total: number;
  tierCounts: Record<string, number>;
  avgHighestRating: number | null;
  foundCount: number;
}

export function exportFullReportWorkbook(params: {
  records: JoinedRecord[];
  batchStats: BatchStat[];
  universityStats: UniversityStat[];
  universityClusters: UniversityCluster[];
  leaderboard: JoinedRecord[];
  tierOrder: string[];
  filename?: string;
}) {
  const { records, batchStats, universityStats, universityClusters, leaderboard, tierOrder } = params;
  const wb = XLSX.utils.book_new();

  // --- Summary sheet ---
  const total = records.length;
  const found = records.filter((r) => r.result.status === 'ok').length;
  const notFound = records.filter((r) => r.result.status === 'not_found').length;
  const unrated = records.filter((r) => r.result.status === 'unrated').length;
  const problem = records.filter((r) =>
    ['blocked', 'error', 'invalid_handle', 'no_handle'].includes(r.result.status)
  ).length;
  const ratings = records.map((r) => r.result.highestRating).filter((n): n is number => n !== null);
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

  const summaryRows = [
    { Metric: 'Total students in sheet', Value: total },
    { Metric: 'CodeChef profile found & rated', Value: found },
    { Metric: 'Profile found, never rated (Unrated)', Value: unrated },
    { Metric: 'Handle not found on CodeChef', Value: notFound },
    { Metric: 'Needs attention (blocked/error/invalid/blank)', Value: problem },
    { Metric: 'Distinct batches', Value: new Set(records.map((r) => r.batch)).size },
    { Metric: 'Distinct universities (after mapping)', Value: new Set(records.map((r) => r.universityNormalized)).size },
    { Metric: 'Average Highest Rating (rated students only)', Value: avgRating ? Math.round(avgRating) : 'N/A' },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 45 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // --- Batch breakdown (pivot: batch x star tier) ---
  const batchRows = batchStats.map((b) => {
    const row: Record<string, string | number> = { Batch: b.batch, 'Total Students': b.total, 'Found on CodeChef': b.foundCount };
    for (const tier of tierOrder) row[tier] = b.tierCounts[tier] || 0;
    row['Avg Highest Rating'] = b.avgHighestRating ? Math.round(b.avgHighestRating) : 'N/A';
    return row;
  });
  const wsBatch = XLSX.utils.json_to_sheet(batchRows);
  XLSX.utils.book_append_sheet(wb, wsBatch, 'Batch Breakdown');

  // --- University breakdown (pivot: university x star tier) ---
  const uniRows = universityStats.map((u) => {
    const row: Record<string, string | number> = {
      'Institute Name': u.university,
      'Total Students': u.total,
      'Found on CodeChef': u.foundCount,
    };
    for (const tier of tierOrder) row[tier] = u.tierCounts[tier] || 0;
    row['Avg Highest Rating'] = u.avgHighestRating ? Math.round(u.avgHighestRating) : 'N/A';
    return row;
  });
  const wsUni = XLSX.utils.json_to_sheet(uniRows);
  XLSX.utils.book_append_sheet(wb, wsUni, 'University Breakdown');

  // --- University name mapping audit trail ---
  const mappingRows: Record<string, string | number>[] = [];
  for (const c of universityClusters) {
    for (const v of c.variants) {
      mappingRows.push({ 'As typed in sheet': v, 'Mapped to (canonical)': c.canonical });
    }
  }
  const wsMapping = XLSX.utils.json_to_sheet(mappingRows);
  wsMapping['!cols'] = [{ wch: 45 }, { wch: 55 }];
  XLSX.utils.book_append_sheet(wb, wsMapping, 'University Mapping');

  // --- Leaderboard ---
  const leaderRows = leaderboard.map((r, i) => ({
    Rank: i + 1,
    ...identityColumns(r),
    'Max Rank': r.result.highestRating,
    'Star Tier': tierLabelForResult(r.result.highestRating),
  }));
  const wsLeader = XLSX.utils.json_to_sheet(leaderRows);
  wsLeader['!cols'] = [{ wch: 8 }, ...IDENTITY_COL_WIDTHS, { wch: 10 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsLeader, 'Leaderboard (Top Performers)');

  // --- Data quality / follow-up list ---
  const issueRows = records
    .filter((r) => r.result.status !== 'ok')
    .map((r) => ({
      ...identityColumns(r),
      Status: STATUS_LABEL[r.result.status] || r.result.status,
      Notes: r.result.note,
    }));
  const wsIssues = XLSX.utils.json_to_sheet(issueRows);
  wsIssues['!cols'] = [...IDENTITY_COL_WIDTHS, { wch: 28 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsIssues, 'Needs Attention');

  // --- Full raw data ---
  const rawRows = records.map((r) => ({
    ...identityColumns(r),
    'Institute (as typed)': r.university,
    'Current Rating': r.result.currentRating ?? '',
    'Max Rank': r.result.highestRating ?? '',
    'Star Tier': tierLabelForResult(r.result.highestRating),
    Status: STATUS_LABEL[r.result.status] || r.result.status,
    Notes: r.result.note,
  }));
  const wsRaw = XLSX.utils.json_to_sheet(rawRows);
  wsRaw['!cols'] = [...IDENTITY_COL_WIDTHS, { wch: 42 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 26 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, wsRaw, 'Raw Data');

  XLSX.writeFile(wb, params.filename || 'phitron_codechef_full_report.xlsx');
}
