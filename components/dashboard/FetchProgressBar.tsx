interface Counts {
  ok: number;
  not_found: number;
  unrated: number;
  blocked: number;
  error: number;
  invalid_handle: number;
  no_handle: number;
  pending: number;
}

interface Props {
  total: number;
  done: number;
  counts: Counts;
  isRunning: boolean;
  statusLine: string;
  onCancel: () => void;
}

export default function FetchProgressBar({ total, done, counts, isRunning, statusLine, onCancel }: Props) {
  if (!isRunning && done >= total) return null; // fully finished — nothing to show

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const needsRetry = counts.blocked + counts.error;

  return (
    <div className="card sticky top-4 z-10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[220px] flex-1">
          <div className="mb-1 flex items-center justify-between text-sm text-slate-300">
            <span>
              {isRunning ? 'Fetching CodeChef profiles…' : 'Paused'} — {done}/{total} ({pct}%)
              {needsRetry > 0 ? ` · ${needsRetry} need retry` : ''}
            </span>
            {statusLine && <span className="text-xs text-slate-500">{statusLine}</span>}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        {isRunning && (
          <button
            onClick={onCancel}
            className="shrink-0 rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            Pause
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Charts and tables below update live as each profile comes back — no need to wait for the full run.
      </p>
    </div>
  );
}
