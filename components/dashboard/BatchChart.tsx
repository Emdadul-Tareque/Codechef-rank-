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
import { BatchStat } from '@/lib/excelIO';
import { TIER_ORDER } from '@/lib/stats';
import { tierColor } from '@/lib/tierColors';
import { CHART_GRID_STROKE, CHART_AXIS_TICK, CHART_LEGEND_STYLE, CHART_TOOLTIP_STYLE } from '@/lib/chartTheme';

export default function BatchChart({ stats }: { stats: BatchStat[] }) {
  const data = stats.map((s) => {
    const row: Record<string, string | number> = { batch: s.batch };
    for (const tier of TIER_ORDER) row[tier] = s.tierCounts[tier] || 0;
    return row;
  });

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-slate-200">Star tier by batch</h3>
      <p className="mb-3 text-xs text-slate-400">How many students in each batch reached each CodeChef star tier.</p>
      <div style={{ width: '100%', height: Math.max(260, stats.length * 34) }}>
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={CHART_GRID_STROKE} />
            <XAxis type="number" allowDecimals={false} tick={CHART_AXIS_TICK} stroke={CHART_GRID_STROKE} />
            <YAxis type="category" dataKey="batch" width={110} tick={CHART_AXIS_TICK} stroke={CHART_GRID_STROKE} />
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
