// Recharts renders with light-theme-assuming defaults (near-black text,
// light grid lines) — these get passed explicitly to every chart so they're
// legible against this app's dark card surfaces.
export const CHART_GRID_STROKE = '#1e293b'; // slate-800
export const CHART_AXIS_TICK = { fontSize: 12, fill: '#94a3b8' }; // slate-400
export const CHART_LEGEND_STYLE = { fontSize: 12, color: '#cbd5e1' }; // slate-300
export const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    background: '#0f172a', // slate-900, matches .card
    border: '1px solid #1e293b',
    borderRadius: 8,
    color: '#e2e8f0',
    fontSize: 12,
  },
  labelStyle: { color: '#e2e8f0' },
  itemStyle: { color: '#e2e8f0' },
  cursor: { fill: 'rgba(148, 163, 184, 0.08)' },
};
