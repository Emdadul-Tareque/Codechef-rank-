// Cleans a raw "CodeChef handle" cell value into something safe to hit
// https://www.codechef.com/users/<handle> with. Handles the messy real-world
// ways people paste these into a spreadsheet.
export function cleanHandle(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  let h = String(raw);

  // Excel sometimes hands us a number (e.g. a fully-numeric handle like "12345"
  // gets auto-cast) or a floating value like 12345.0 — normalize both.
  if (typeof raw === 'number') {
    h = Number.isInteger(raw) ? String(raw) : String(raw);
  }

  h = h.normalize('NFKC');
  // Strip zero-width/invisible unicode that sneaks in from copy-paste.
  h = h.replace(/[\u200B-\u200D\uFEFF]/g, '');
  h = h.trim();

  // Full profile URL pasted instead of a bare handle.
  h = h.replace(/^https?:\/\/(www\.)?codechef\.com\/users\/?/i, '');
  // Leading '@' some people prefix handles with.
  h = h.replace(/^@/, '');
  // Trailing slash / query string if a URL was pasted.
  h = h.split('?')[0];
  h = h.replace(/\/+$/, '');

  h = h.trim();
  return h;
}

const HANDLE_FORMAT = /^[A-Za-z0-9_.-]{2,40}$/;

export function isPlausibleHandle(handle: string): boolean {
  if (!handle) return false;
  return HANDLE_FORMAT.test(handle);
}

/** Normalizes free-text header names for flexible column matching (case/space/punct-insensitive). */
export function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^a-z0-9]/g, '');
}
