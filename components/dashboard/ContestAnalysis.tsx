import { useMemo, useState } from 'react';
import { JoinedRecord } from '@/lib/types';
import { getContestEventOptions, computeContestBreakdown } from '@/lib/contestAnalysis';
import { exportContestBreakdownWorkbook } from '@/lib/excelIO';

export default function ContestAnalysis({ records }: { records: JoinedRecord[] }) {
  const options = useMemo(() => getContestEventOptions(records), [records]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const activeKey = selectedKey ?? options[0]?.key ?? null;
  const breakdown = useMemo(
    () => (activeKey ? computeContestBreakdown(records, activeKey) : null),
    [records, activeKey]
  );

  if (options.length === 0) {
    return (
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-800">Contest analysis</h3>
        <p className="mt-2 text-sm text-gray-500">
          No contest history yet — this fills in once handles start resolving (needs the Parse.bot data source, which
          returns full contest history).
        </p>
      </div>
    );
  }

  const participated =
    (breakdown?.increased.length || 0) + (breakdown?.decreased.length || 0) + (breakdown?.unchanged.length || 0);

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Contest analysis</h3>
          <p className="text-xs text-gray-500">Who gained, who lost, and who sat out a specific contest.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            value={activeKey ?? ''}
            onChange={(e) => setSelectedKey(e.target.value)}
          >
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label} ({o.participantCount} played)
              </option>
            ))}
          </select>
          {breakdown && (
            <button
              onClick={() => exportContestBreakdownWorkbook({ ...breakdown, eventLabel: breakdown.eventLabel || 'contest' })}
              className="rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700 hover:bg-brand-100"
            >
              Download this breakdown
            </button>
          )}
        </div>
      </div>

      {breakdown && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Rank increased" value={breakdown.increased.length} tone="bg-green-50 text-green-700" />
            <Stat label="Rank decreased" value={breakdown.decreased.length} tone="bg-red-50 text-red-700" />
            <Stat label="Unchanged" value={breakdown.unchanged.length} tone="bg-gray-100 text-gray-600" />
            <Stat
              label="Did not participate"
              value={breakdown.didNotParticipate.length}
              tone="bg-amber-50 text-amber-700"
            />
          </div>

          {breakdown.unresolved.length > 0 && (
            <p className="mt-3 text-xs text-gray-400">
              {breakdown.unresolved.length} student(s) don&apos;t have resolved CodeChef data yet (still
              fetching/blocked/not found) — excluded from the counts above since it&apos;s not known whether they
              played.
            </p>
          )}

          {participated > 0 ? (
            <div className="scroll-box mt-4">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Batch</th>
                    <th>University</th>
                    <th>Handle</th>
                    <th className="text-right">Before</th>
                    <th className="text-right">After</th>
                    <th className="text-right">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {[...breakdown.increased, ...breakdown.decreased, ...breakdown.unchanged].map((p, i) => (
                    <tr key={p.handle + i}>
                      <td className="font-medium text-gray-800">{p.name}</td>
                      <td>{p.batch}</td>
                      <td className="max-w-[200px] truncate">{p.university}</td>
                      <td className="font-mono">{p.handle}</td>
                      <td className="text-right font-mono">{p.ratingBefore}</td>
                      <td className="text-right font-mono">{p.ratingAfter}</td>
                      <td
                        className={`text-right font-mono font-semibold ${
                          p.delta > 0 ? 'text-green-700' : p.delta < 0 ? 'text-red-700' : 'text-gray-500'
                        }`}
                      >
                        {p.delta > 0 ? '+' : ''}
                        {p.delta}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-500">Nobody in this roster played this contest.</p>
          )}

          {breakdown.didNotParticipate.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs font-medium text-gray-500">
                Show the {breakdown.didNotParticipate.length} who didn&apos;t participate
              </summary>
              <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-auto">
                {breakdown.didNotParticipate.map((r, i) => (
                  <span key={r.handle + i} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
                    {r.name} ({r.batch})
                  </span>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-lg p-3 text-center ${tone}`}>
      <div className="font-mono text-xl font-semibold">{value}</div>
      <div className="text-xs opacity-80">{label}</div>
    </div>
  );
}
