import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { UniversityStat } from '@/lib/excelIO';
import { TIER_ORDER } from '@/lib/stats';
import { tierColor } from '@/lib/tierColors';
import { CHART_GRID_STROKE, CHART_AXIS_TICK, CHART_LEGEND_STYLE, CHART_TOOLTIP_STYLE } from '@/lib/chartTheme';

export default function UniversityChart({ stats, topN = 15 }: { stats: UniversityStat[]; topN?: number }) {
  const top = stats.slice(0, topN);
  const rest = stats.slice(topN);

  const data = top.map((s) => {
    const row: Record<string, string | number> = { university: truncate(s.university, 28) };
    for (const tier of TIER_ORDER) row[tier] = s.tierCounts[tier] || 0;
    return row;
  });

  if (rest.length > 0) {
    const row: Record<string, string | number> = { university: `Other (${rest.length} universities)` };
    for (const tier of TIER_ORDER) row[tier] = rest.reduce((sum, s) => sum + (s.tierCounts[tier] || 0), 0);
    data.push(row);
  }

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-slate-200">Star tier by university</h3>
      <p className="mb-3 text-xs text-slate-400">
        Top {topN} universities by student count{rest.length > 0 ? `, remaining ${rest.length} grouped as "Other"` : ''}.
      </p>
      <div style={{ width: '100%', height: Math.max(300, data.length * 30) }}>
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={CHART_GRID_STROKE} />
            <XAxis type="number" allowDecimals={false} tick={CHART_AXIS_TICK} stroke={CHART_GRID_STROKE} />
            <YAxis type="category" dataKey="university" width={190} tick={{ ...CHART_AXIS_TICK, fontSize: 11 }} stroke={CHART_GRID_STROKE} />
            <Tooltip {...CHART_TOOLTIP_STYLE} />
            <Legend wrapperStyle={CHART_LEGEND_STYLE} />
            {TIER_ORDER.map((tier) => (
              <Bar key={tier} dataKey={tier} stackId="stack" fill={tierColor(tier)} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
