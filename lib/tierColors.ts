// Mirrors CodeChef's own star-rating colors so the dashboard's palette reads
// as "native" to the subject matter rather than an arbitrary chart theme.
// Brightened relative to CodeChef's own (light-background) hues so each tier
// still reads clearly as text/fill color against this app's dark surfaces —
// a color tuned for a white page goes muddy on a dark card.
export const TIER_COLORS: Record<string, string> = {
  '1\u2605': '#94a3b8', // slate — grey tier
  '2\u2605': '#34d399', // brightened green
  '3\u2605': '#60a5fa', // brightened blue
  '4\u2605': '#c084fc', // brightened violet
  '5\u2605': '#fbbf24', // brightened gold
  '6\u2605': '#fb923c', // brightened orange
  '7\u2605': '#f87171', // brightened red
  Unrated: '#64748b', // muted slate, recedes against dark bg
};

export function tierColor(tier: string): string {
  return TIER_COLORS[tier] || '#94a3b8';
}
