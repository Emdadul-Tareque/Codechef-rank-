import { JoinedRecord } from '@/lib/types';
import { tierLabelForResult } from '@/lib/starTier';
import TierBadge from '@/components/TierBadge';

export default function LeaderboardTable({ records }: { records: JoinedRecord[] }) {
  return (
    <div className="card p-5">
      <h3 className="mb-3 text-sm font-semibold text-gray-800">Top performers</h3>
      <div className="scroll-box">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Batch</th>
              <th>Handle</th>
              <th>University</th>
              <th className="text-right">Max Rank</th>
              <th className="text-right">Tier</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => (
              <tr key={r.handle + i}>
                <td className="font-mono">{i + 1}</td>
                <td className="font-medium text-gray-800">{r.name}</td>
                <td>{r.batch}</td>
                <td className="font-mono text-brand-700">
                  <a
                    href={`https://www.codechef.com/users/${encodeURIComponent(r.handle)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                  >
                    {r.handle}
                  </a>
                </td>
                <td className="max-w-[220px] truncate">{r.universityNormalized}</td>
                <td className="text-right font-mono font-semibold">{r.result.highestRating}</td>
                <td className="text-right">
                  <TierBadge tier={tierLabelForResult(r.result.highestRating)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
