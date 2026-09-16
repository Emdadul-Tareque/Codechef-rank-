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

export default function BatchChart({ stats }: { stats: BatchStat[] }) {
  const data = stats.map((s) => {
    const row: Record<string, string | number> = { batch: s.batch };
    for (const tier of TIER_ORDER) row[tier] = s.tierCounts[tier] || 0;
    return row;
  });

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-gray-800">Star tier by batch</h3>
      <p className="mb-3 text-xs text-gray-500">How many students in each batch reached each CodeChef star tier.</p>
      <div style={{ width: '100%', height: Math.max(260, stats.length * 34) }}>
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="batch" width={110} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {TIER_ORDER.map((tier) => (
              <Bar key={tier} dataKey={tier} stackId="stack" fill={tierColor(tier)} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
