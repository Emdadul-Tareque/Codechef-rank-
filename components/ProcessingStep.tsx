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
  onFinishEarly: () => void;
}

export default function ProcessingStep({ total, done, counts, isRunning, statusLine, onCancel, onFinishEarly }: Props) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900">Fetching CodeChef profiles</h2>
        <p className="mt-1 text-sm text-gray-500">{statusLine}</p>

        <div className="mt-5">
          <div className="mb-1 flex justify-between text-sm text-gray-600">
            <span>
              {done} / {total}
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Found" value={counts.ok} tone="text-green-700 bg-green-50" />
          <Stat label="Unrated" value={counts.unrated} tone="text-gray-600 bg-gray-100" />
          <Stat label="Not found" value={counts.not_found} tone="text-amber-700 bg-amber-50" />
          <Stat
            label="Needs retry"
            value={counts.blocked + counts.error}
            tone="text-red-700 bg-red-50"
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          {isRunning ? (
            <button
              onClick={onCancel}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel run
            </button>
          ) : (
            <button
              onClick={onFinishEarly}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              View dashboard
            </button>
          )}
        </div>
      </div>
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
