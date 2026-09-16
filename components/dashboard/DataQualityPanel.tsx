import { JoinedRecord } from '@/lib/types';
import { OverallSummary } from '@/lib/stats';

const STATUS_LABEL: Record<string, string> = {
  not_found: 'Not found',
  unrated: 'Unrated',
  invalid_handle: 'Invalid handle format',
  no_handle: 'No handle provided',
  blocked: 'Blocked / rate-limited',
  error: 'Error',
};

const STATUS_TONE: Record<string, string> = {
  not_found: 'text-amber-700 bg-amber-50',
  invalid_handle: 'text-amber-700 bg-amber-50',
  no_handle: 'text-gray-600 bg-gray-100',
  blocked: 'text-red-700 bg-red-50',
  error: 'text-red-700 bg-red-50',
};

interface Props {
  records: JoinedRecord[];
  summary: OverallSummary;
  onRetry: (handles: string[]) => void;
  retrying: boolean;
}

export default function DataQualityPanel({ records, summary, onRetry, retrying }: Props) {
  const problems = records.filter((r) => r.result.status !== 'ok' && r.result.status !== 'unrated');
  const retryable = problems.filter((r) => ['blocked', 'error'].includes(r.result.status));

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Needs attention</h3>
        {retryable.length > 0 && (
          <button
            disabled={retrying}
            onClick={() => onRetry(retryable.map((r) => r.handle))}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:bg-gray-300"
          >
            {retrying ? 'Retrying…' : `Retry ${retryable.length} blocked/error handles`}
          </button>
        )}
      </div>

      {summary.duplicateHandles.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <strong>{summary.duplicateHandles.length} handle(s) shared by multiple students</strong> — worth a manual
          check: {summary.duplicateHandles.slice(0, 5).map((d) => `"${d.handle}" (${d.names.join(', ')})`).join('; ')}
          {summary.duplicateHandles.length > 5 ? '…' : ''}
        </div>
      )}

      {problems.length === 0 ? (
        <p className="text-sm text-gray-500">Nothing outstanding — every handle resolved cleanly.</p>
      ) : (
        <div className="scroll-box">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Batch</th>
                <th>Handle (as typed)</th>
                <th>Status</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {problems.map((r, i) => (
                <tr key={r.handleRaw + i}>
                  <td>{r.name}</td>
                  <td>{r.batch}</td>
                  <td className="font-mono">{r.handleRaw || '—'}</td>
                  <td>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[r.result.status] || ''}`}>
                      {STATUS_LABEL[r.result.status] || r.result.status}
                    </span>
                  </td>
                  <td className="max-w-xs truncate text-gray-500">{r.result.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
