import { TIER_ORDER } from '@/lib/stats';
import TierBadge from '@/components/TierBadge';

interface Row {
  label: string;
  total: number;
  foundCount: number;
  tierCounts: Record<string, number>;
  avgHighestRating: number | null;
}

export default function BreakdownTable({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="card p-5">
      <h3 className="mb-3 text-sm font-semibold text-gray-800">{title}</h3>
      <div className="scroll-box">
        <table className="data-table">
          <thead>
            <tr>
              <th>{title.includes('Batch') ? 'Batch' : 'University / Institute'}</th>
              <th className="text-right">Total</th>
              <th className="text-right">Found</th>
              {TIER_ORDER.map((t) => (
                <th key={t} className="text-right">
                  <TierBadge tier={t} />
                </th>
              ))}
              <th className="text-right">Avg. Rating</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="max-w-xs truncate font-medium text-gray-800">{r.label}</td>
                <td className="text-right font-mono">{r.total}</td>
                <td className="text-right font-mono">{r.foundCount}</td>
                {TIER_ORDER.map((t) => (
                  <td key={t} className="text-right font-mono">
                    {r.tierCounts[t] || 0}
                  </td>
                ))}
                <td className="text-right font-mono">
                  {r.avgHighestRating ? Math.round(r.avgHighestRating) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
