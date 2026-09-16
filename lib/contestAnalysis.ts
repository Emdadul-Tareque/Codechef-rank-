import { ContestHistoryEntry, JoinedRecord } from './types';

// CodeChef commonly runs the same contest across several rating divisions on
// the same day (e.g. "Starters 101 Division 2 (Rated)" and "...Division 4
// (Rated)" are the SAME real-world contest — a student is auto-assigned a
// division by their current rating). Grouping strictly by `code` would
// wrongly mark a student "did not participate" just because they played a
// different division than whichever code happens to be selected. So contests
// are grouped into logical "events" by a normalized name + calendar date.
function normalizeContestName(name: string): string {
  return name
    .replace(/division\s*\d+/i, '')
    .replace(/\((?:un)?rated\)/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function dateOnly(end_date: string): string {
  return end_date.slice(0, 10); // "YYYY-MM-DD"
}

function eventKeyFor(entry: ContestHistoryEntry): string {
  return `${normalizeContestName(entry.name)}__${dateOnly(entry.end_date)}`;
}

export interface ContestEventOption {
  key: string;
  label: string; // "Starters 101 — 2023-09-20"
  displayName: string; // "Starters 101"
  date: string; // "YYYY-MM-DD", for sorting
  participantCount: number; // how many students in this roster have an entry under this event
}

/** Every distinct contest event seen across the whole roster, most recent first. */
export function getContestEventOptions(records: JoinedRecord[]): ContestEventOption[] {
  const byKey = new Map<string, ContestEventOption>();

  for (const r of records) {
    const history = r.result.contestHistory || [];
    for (const entry of history) {
      const key = eventKeyFor(entry);
      const date = dateOnly(entry.end_date);
      const displayName = normalizeContestName(entry.name);
      const existing = byKey.get(key);
      if (existing) {
        existing.participantCount++;
        if (date > existing.date) existing.date = date; // keep the latest, in case of odd cross-midnight variance
      } else {
        byKey.set(key, { key, label: `${displayName} — ${date}`, displayName, date, participantCount: 1 });
      }
    }
  }

  return Array.from(byKey.values()).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export interface ContestParticipant {
  name: string;
  batch: string;
  university: string;
  handle: string;
  contestName: string; // the specific division/code they actually played, e.g. "Starters 101 Division 3 (Rated)"
  ratingBefore: number;
  ratingAfter: number;
  delta: number;
}

export interface ContestBreakdown {
  eventLabel: string;
  increased: ContestParticipant[];
  decreased: ContestParticipant[];
  unchanged: ContestParticipant[];
  didNotParticipate: JoinedRecord[]; // resolved CodeChef data, but no entry for this event
  unresolved: JoinedRecord[]; // CodeChef status isn't 'ok' yet (pending/blocked/not_found/unrated/etc) — can't tell either way
}

export function computeContestBreakdown(records: JoinedRecord[], eventKey: string): ContestBreakdown {
  const increased: ContestParticipant[] = [];
  const decreased: ContestParticipant[] = [];
  const unchanged: ContestParticipant[] = [];
  const didNotParticipate: JoinedRecord[] = [];
  const unresolved: JoinedRecord[] = [];
  let eventLabel = '';

  for (const r of records) {
    if (r.result.status !== 'ok') {
      unresolved.push(r);
      continue;
    }

    const history = r.result.contestHistory || [];
    if (history.length === 0) {
      didNotParticipate.push(r);
      continue;
    }

    // history is stored chronologically ascending (see parseBotScraper.ts).
    const idx = history.findIndex((e) => eventKeyFor(e) === eventKey);
    if (idx === -1) {
      didNotParticipate.push(r);
      continue;
    }

    const entry = history[idx];
    if (!eventLabel) eventLabel = normalizeContestName(entry.name);

    const ratingBefore = idx === 0 ? r.result.initialRating ?? entry.rating : history[idx - 1].rating;
    const ratingAfter = entry.rating;
    const delta = ratingAfter - ratingBefore;

    const participant: ContestParticipant = {
      name: r.name,
      batch: r.batch,
      university: r.universityNormalized,
      handle: r.handle,
      contestName: entry.name,
      ratingBefore,
      ratingAfter,
      delta,
    };

    if (delta > 0) increased.push(participant);
    else if (delta < 0) decreased.push(participant);
    else unchanged.push(participant);
  }

  increased.sort((a, b) => b.delta - a.delta);
  decreased.sort((a, b) => a.delta - b.delta);

  return { eventLabel, increased, decreased, unchanged, didNotParticipate, unresolved };
}
