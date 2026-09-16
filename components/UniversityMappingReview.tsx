import { useState } from 'react';
import { UniversityMappingResult, mergeClusters, renameCluster } from '@/lib/universityMap';

interface Props {
  initial: UniversityMappingResult;
  onConfirm: (result: UniversityMappingResult) => void;
  onBack: () => void;
}

export default function UniversityMappingReview({ initial, onConfirm, onBack }: Props) {
  const [result, setResult] = useState<UniversityMappingResult>(initial);
  const [mergeSource, setMergeSource] = useState<string>('');
  const [mergeTarget, setMergeTarget] = useState<string>('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const sorted = [...result.clusters].sort((a, b) => b.count - a.count);
  const multiVariant = sorted.filter((c) => c.variants.length > 1);
  const singleVariant = sorted.filter((c) => c.variants.length === 1);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-slate-100">Review university name mapping</h2>
        <p className="mt-1 text-sm text-slate-400">
          {sorted.length} distinct spellings were found and grouped into <strong>{sorted.length}</strong> buckets
          below. Rename a bucket&apos;s display name, or merge two buckets that are really the same school.
        </p>

        {multiVariant.length > 0 && (
          <>
            <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-300">
              Grouped automatically ({multiVariant.length})
            </h3>
            <div className="scroll-box divide-y divide-slate-800">
              {multiVariant.map((c) => (
                <div key={c.canonical} className="flex items-start justify-between gap-4 p-3">
                  <div className="min-w-0 flex-1">
                    {editing === c.canonical ? (
                      <div className="flex gap-2">
                        <input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-100"
                        />
                        <button
                          className="shrink-0 rounded bg-brand-600 px-2 py-1 text-xs font-medium text-white"
                          onClick={() => {
                            setResult((r) => renameCluster(r, c.canonical, editValue.trim() || c.canonical));
                            setEditing(null);
                          }}
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <p className="truncate font-medium text-slate-100">
                        {c.canonical}{' '}
                        <span className="font-normal text-slate-500">
                          ({c.count} student{c.count === 1 ? '' : 's'})
                        </span>
                      </p>
                    )}
                    <p className="mt-1 truncate text-xs text-slate-400">
                      as typed: {c.variants.slice(0, 6).join(' · ')}
                      {c.variants.length > 6 ? ` · +${c.variants.length - 6} more` : ''}
                    </p>
                  </div>
                  <button
                    className="shrink-0 text-xs font-medium text-brand-600 hover:underline"
                    onClick={() => {
                      setEditing(c.canonical);
                      setEditValue(c.canonical);
                    }}
                  >
                    Rename
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {singleVariant.length > 0 && (
          <>
            <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-300">
              Only one spelling seen ({singleVariant.length}) — likely fine as-is, or merge below if it&apos;s a
              duplicate of another entry
            </h3>
            <div className="flex max-h-40 flex-wrap gap-2 overflow-auto rounded-lg border border-slate-800 p-3">
              {singleVariant.map((c) => (
                <span key={c.canonical} className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                  {c.canonical} ({c.count})
                </span>
              ))}
            </div>
          </>
        )}

        <div className="mt-6 rounded-lg border border-slate-700 p-4">
          <p className="mb-2 text-sm font-semibold text-slate-300">Merge two buckets manually</p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
              value={mergeSource}
              onChange={(e) => setMergeSource(e.target.value)}
            >
              <option value="">Select bucket…</option>
              {sorted.map((c) => (
                <option key={c.canonical} value={c.canonical}>
                  {c.canonical} ({c.count})
                </option>
              ))}
            </select>
            <span className="text-sm text-slate-500">merge into</span>
            <select
              className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
              value={mergeTarget}
              onChange={(e) => setMergeTarget(e.target.value)}
            >
              <option value="">Select bucket…</option>
              {sorted.map((c) => (
                <option key={c.canonical} value={c.canonical}>
                  {c.canonical} ({c.count})
                </option>
              ))}
            </select>
            <button
              disabled={!mergeSource || !mergeTarget || mergeSource === mergeTarget}
              onClick={() => {
                setResult((r) => mergeClusters(r, mergeSource, mergeTarget));
                setMergeSource('');
                setMergeTarget('');
              }}
              className="rounded-md bg-slate-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-600 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
            >
              Merge
            </button>
          </div>
        </div>

        <div className="mt-6 flex justify-between">
          <button onClick={onBack} className="rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800">
            Back
          </button>
          <button
            onClick={() => onConfirm(result)}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500"
          >
            Looks good — start fetching CodeChef data
          </button>
        </div>
      </div>
    </div>
  );
}
