// Mirrors CodeChef's own star-rating colors so the dashboard's palette reads
// as "native" to the subject matter rather than an arbitrary chart theme.
export const TIER_COLORS: Record<string, string> = {
  '1\u2605': '#6b7280', // grey
  '2\u2605': '#1f9d55', // green
  '3\u2605': '#2f6fd6', // blue
  '4\u2605': '#7b3fa0', // violet
  '5\u2605': '#caa000', // yellow/gold
  '6\u2605': '#e07a1f', // orange
  '7\u2605': '#d0332c', // red
  Unrated: '#c7cad4', // neutral
};

export function tierColor(tier: string): string {
  return TIER_COLORS[tier] || '#94a3b8';
}
