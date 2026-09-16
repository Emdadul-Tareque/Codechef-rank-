import { JoinedRecord } from './types';
import { ALL_TIER_LABELS, tierLabelForResult } from './starTier';
import { BatchStat, UniversityStat } from './excelIO';

export const TIER_ORDER = ALL_TIER_LABELS;

function emptyTierCounts(): Record<string, number> {
  const o: Record<string, number> = {};
  for (const t of TIER_ORDER) o[t] = 0;
  return o;
}

function groupBy<T>(items: T[], keyFn: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const item of items) {
    const k = keyFn(item);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(item);
  }
  return m;
}

function avgHighest(records: JoinedRecord[]): number | null {
  const vals = records.map((r) => r.result.highestRating).filter((n): n is number => n !== null);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function computeBatchStats(records: JoinedRecord[]): BatchStat[] {
  const groups = groupBy(records, (r) => r.batch);
  const stats: BatchStat[] = [];
  for (const [batch, recs] of groups.entries()) {
    const tierCounts = emptyTierCounts();
    for (const r of recs) {
      if (r.result.status === 'ok') tierCounts[tierLabelForResult(r.result.highestRating)]++;
    }
    stats.push({
      batch,
      total: recs.length,
      tierCounts,
      avgHighestRating: avgHighest(recs),
      foundCount: recs.filter((r) => r.result.status === 'ok').length,
    });
  }
  // Sort by total students desc, then name — keeps the dashboard stable/readable.
  return stats.sort((a, b) => b.total - a.total || a.batch.localeCompare(b.batch));
}

export function computeUniversityStats(records: JoinedRecord[]): UniversityStat[] {
  const groups = groupBy(records, (r) => r.universityNormalized);
  const stats: UniversityStat[] = [];
  for (const [university, recs] of groups.entries()) {
    const tierCounts = emptyTierCounts();
    for (const r of recs) {
      if (r.result.status === 'ok') tierCounts[tierLabelForResult(r.result.highestRating)]++;
    }
    stats.push({
      university,
      total: recs.length,
      tierCounts,
      avgHighestRating: avgHighest(recs),
      foundCount: recs.filter((r) => r.result.status === 'ok').length,
    });
  }
  return stats.sort((a, b) => b.total - a.total || a.university.localeCompare(b.university));
}

export function computeLeaderboard(records: JoinedRecord[], topN = 20): JoinedRecord[] {
  return records
    .filter((r) => r.result.status === 'ok' && r.result.highestRating !== null)
    .sort((a, b) => (b.result.highestRating || 0) - (a.result.highestRating || 0))
    .slice(0, topN);
}

export interface OverallSummary {
  total: number;
  found: number;
  unrated: number;
  notFound: number;
  needsAttention: number;
  distinctBatches: number;
  distinctUniversities: number;
  avgHighestRating: number | null;
  tierDistribution: Record<string, number>;
  duplicateHandles: Array<{ handle: string; names: string[] }>;
}

export function computeOverallSummary(records: JoinedRecord[]): OverallSummary {
  const tierDistribution = emptyTierCounts();
  for (const r of records) {
    if (r.result.status === 'ok') tierDistribution[tierLabelForResult(r.result.highestRating)]++;
  }

  const byHandle = groupBy(
    records.filter((r) => r.handle),
    (r) => r.handle
  );
  const duplicateHandles = Array.from(byHandle.entries())
    .filter(([, recs]) => new Set(recs.map((r) => r.name)).size > 1)
    .map(([handle, recs]) => ({ handle, names: Array.from(new Set(recs.map((r) => r.name))) }));

  return {
    total: records.length,
    found: records.filter((r) => r.result.status === 'ok').length,
    unrated: records.filter((r) => r.result.status === 'unrated').length,
    notFound: records.filter((r) => r.result.status === 'not_found').length,
    needsAttention: records.filter((r) =>
      ['blocked', 'error', 'invalid_handle', 'no_handle'].includes(r.result.status)
    ).length,
    distinctBatches: new Set(records.map((r) => r.batch)).size,
    distinctUniversities: new Set(records.map((r) => r.universityNormalized)).size,
    avgHighestRating: avgHighest(records.filter((r) => r.result.status === 'ok')),
    tierDistribution,
    duplicateHandles,
  };
}
