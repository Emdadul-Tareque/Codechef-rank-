import { useMemo, useState } from 'react';
import { JoinedRecord } from '@/lib/types';
import { getContestEventOptions, computeContestBreakdown, ContestParticipant } from '@/lib/contestAnalysis';
import { exportContestBreakdownWorkbook } from '@/lib/excelIO';

type Tab = 'increased' | 'decreased' | 'not_participated';

export default function ContestAnalysis({ records }: { records: JoinedRecord[] }) {
  const options = useMemo(() => getContestEventOptions(records), [records]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('increased');

  const activeKey = selectedKey ?? options[0]?.key ?? null;
  const breakdown = useMemo(
    () => (activeKey ? computeContestBreakdown(records, activeKey) : null),
    [records, activeKey]
  );

  if (options.length === 0) {
    return (
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-200">Contest analysis</h3>
        <p className="mt-2 text-sm text-slate-400">
          No contest history yet — this fills in once handles start resolving (needs the Parse.bot data source, which
          returns full contest history).
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Contest analysis</h3>
          <p className="text-xs text-slate-400">Who gained, who lost, and who sat out a specific contest.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            value={activeKey ?? ''}
            onChange={(e) => {
              setSelectedKey(e.target.value);
              setTab('increased');
            }}
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
              className="rounded-md border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-xs font-medium text-brand-300 hover:bg-brand-500/20"
            >
              Download all (Excel)
            </button>
          )}
        </div>
      </div>

      {breakdown && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Rank increased" value={breakdown.increased.length} tone="bg-emerald-500/15 text-emerald-400" />
            <Stat label="Rank decreased" value={breakdown.decreased.length} tone="bg-red-500/15 text-red-400" />
            <Stat label="Unchanged" value={breakdown.unchanged.length} tone="bg-slate-700 text-slate-300" />
            <Stat
              label="Did not participate"
              value={breakdown.didNotParticipate.length}
              tone="bg-amber-500/15 text-amber-400"
            />
          </div>

          {breakdown.unresolved.length > 0 && (
            <p className="mt-3 text-xs text-slate-500">
              {breakdown.unresolved.length} student(s) don&apos;t have resolved CodeChef data yet (still
              fetching/blocked/not found) — excluded from every tab below since it&apos;s not known whether they
              played.
            </p>
          )}

          {/* Tabs */}
          <div className="mt-5 flex gap-1 border-b border-slate-800">
            <TabButton active={tab === 'increased'} onClick={() => setTab('increased')} tone="text-emerald-400">
              Rating Increased ({breakdown.increased.length})
            </TabButton>
            <TabButton active={tab === 'decreased'} onClick={() => setTab('decreased')} tone="text-red-400">
              Rating Decreased ({breakdown.decreased.length})
            </TabButton>
            <TabButton active={tab === 'not_participated'} onClick={() => setTab('not_participated')} tone="text-amber-400">
              Did Not Participate ({breakdown.didNotParticipate.length})
            </TabButton>
          </div>

          <div className="mt-4">
            {tab === 'increased' && <ParticipantTable rows={breakdown.increased} />}
            {tab === 'decreased' && <ParticipantTable rows={breakdown.decreased} />}
            {tab === 'not_participated' && <NotParticipatedTable records={breakdown.didNotParticipate} />}
          </div>

          {breakdown.unchanged.length > 0 && (
            <p className="mt-3 text-xs text-slate-500">
              {breakdown.unchanged.length} student(s) played with no rating change — included in the Excel download
              (&quot;Rating Unchanged&quot; sheet), not shown as a separate tab here.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  tone,
  children,
}: {
  active: boolean;
  onClick: () => void;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
        active ? `border-current ${tone}` : 'border-transparent text-slate-500 hover:text-slate-300'
      }`}
    >
      {children}
    </button>
  );
}

function ParticipantTable({ rows }: { rows: ContestParticipant[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400">Nobody in this category for the selected contest.</p>;
  }
  return (
    <div className="scroll-box">
      <table className="data-table">
        <thead>
          <tr>
            <th>Batch</th>
            <th>Name</th>
            <th>Email</th>
            <th>Phone Number</th>
            <th>Institute Name</th>
            <th>CodeChef Handle</th>
            <th>Contest</th>
            <th className="text-right">Rating Before</th>
            <th className="text-right">Rating After</th>
            <th className="text-right">Change</th>
            <th className="text-right">Rank Before</th>
            <th className="text-right">Rank After</th>
            <th>Rank Improved?</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={p.handle + i}>
              <td>{p.batch}</td>
              <td className="font-medium text-slate-200">{p.name}</td>
              <td>{p.email || '—'}</td>
              <td>{p.phone || '—'}</td>
              <td className="max-w-[200px] truncate">{p.university}</td>
              <td className="font-mono">{p.handle}</td>
              <td className="max-w-[220px] truncate text-slate-400">{p.contestName}</td>
              <td className="text-right font-mono">{p.ratingBefore}</td>
              <td className="text-right font-mono">{p.ratingAfter}</td>
              <td
                className={`text-right font-mono font-semibold ${
                  p.delta > 0 ? 'text-emerald-400' : p.delta < 0 ? 'text-red-400' : 'text-slate-400'
                }`}
              >
                {p.delta > 0 ? '+' : ''}
                {p.delta}
              </td>
              <td className="text-right font-mono">{p.rankBefore ?? '—'}</td>
              <td className="text-right font-mono">{p.rankAfter}</td>
              <td>
                {p.rankImproved === null ? (
                  <span className="text-slate-500">—</span>
                ) : p.rankImproved ? (
                  <span className="text-emerald-400">Yes</span>
                ) : (
                  <span className="text-red-400">No</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NotParticipatedTable({ records }: { records: JoinedRecord[] }) {
  if (records.length === 0) {
    return <p className="text-sm text-slate-400">Everyone with resolved CodeChef data played this contest.</p>;
  }
  return (
    <div className="scroll-box">
      <table className="data-table">
        <thead>
          <tr>
            <th>Batch</th>
            <th>Name</th>
            <th>Email</th>
            <th>Phone Number</th>
            <th>Institute Name</th>
            <th>CodeChef Handle</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr key={r.handle + i}>
              <td>{r.batch}</td>
              <td className="font-medium text-slate-200">{r.name}</td>
              <td>{r.email || '—'}</td>
              <td>{r.phone || '—'}</td>
              <td className="max-w-[200px] truncate">{r.universityNormalized}</td>
              <td className="font-mono">{r.handle}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
