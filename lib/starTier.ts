// CodeChef's public star bands, based on rating. Source: codechef.com rating badge.
// (Ordered high-to-low so we can walk down and stop at the first match.)
const BANDS: Array<{ floor: number; stars: number }> = [
  { floor: 2500, stars: 7 },
  { floor: 2200, stars: 6 },
  { floor: 2000, stars: 5 },
  { floor: 1800, stars: 4 },
  { floor: 1600, stars: 3 },
  { floor: 1400, stars: 2 },
  { floor: 0, stars: 1 },
];

export function starsForRating(rating: number | null | undefined): number | null {
  if (rating === null || rating === undefined || Number.isNaN(rating)) return null;
  for (const band of BANDS) {
    if (rating >= band.floor) return band.stars;
  }
  return 1;
}

export function starLabel(stars: number | null): string {
  if (!stars) return 'Unrated';
  return `${stars}\u2605`;
}

/** All possible tier labels, used to build a stable, ordered dashboard axis. */
export const ALL_TIER_LABELS = [
  '1\u2605',
  '2\u2605',
  '3\u2605',
  '4\u2605',
  '5\u2605',
  '6\u2605',
  '7\u2605',
  'Unrated',
];

export function tierLabelForResult(highestRating: number | null): string {
  const s = starsForRating(highestRating);
  return starLabel(s);
}
