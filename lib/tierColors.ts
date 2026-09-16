// Mirrors CodeChef's own star-rating colors so the dashboard's palette reads
// as "native" to the subject matter rather than an arbitrary chart theme.
// Hues are deliberately spread far apart around the color wheel (not just
// brightened CodeChef values) so adjacent tiers stay distinguishable even as
// small badge chips — 3★/4★ previously sat too close (blue vs violet);
// 4★ now jumps to magenta/fuchsia, well clear of 3★'s cyan.
export const TIER_COLORS: Record<string, string> = {
  '1\u2605': '#94a3b8', // slate — grey tier
  '2\u2605': '#34d399', // emerald green
  '3\u2605': '#22d3ee', // cyan
  '4\u2605': '#e879f9', // fuchsia/magenta — far from 3★'s cyan on the wheel
  '5\u2605': '#facc15', // yellow
  '6\u2605': '#fb923c', // orange
  '7\u2605': '#f87171', // red
  Unrated: '#64748b', // muted slate, recedes against dark bg
};

export function tierColor(tier: string): string {
  return TIER_COLORS[tier] || '#94a3b8';
}
