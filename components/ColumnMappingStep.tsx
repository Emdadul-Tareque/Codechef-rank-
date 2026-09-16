import { useState } from 'react';
import { ColumnMapping, RawSheet } from '@/lib/excelIO';

interface Props {
  sheet: RawSheet;
  initialMapping: ColumnMapping;
  onConfirm: (mapping: ColumnMapping) => void;
  onBack: () => void;
}

const FIELD_LABELS: Array<{ key: keyof ColumnMapping; label: string; required: boolean }> = [
  { key: 'name', label: 'Name', required: true },
  { key: 'batch', label: 'Batch', required: true },
  { key: 'handle', label: 'CodeChef Handle', required: true },
  { key: 'university', label: 'University / Institute', required: true },
];

export default function ColumnMappingStep({ sheet, initialMapping, onConfirm, onBack }: Props) {
  const [mapping, setMapping] = useState<ColumnMapping>(initialMapping);

  const missing = FIELD_LABELS.filter((f) => f.required && mapping[f.key] === undefined);

  // Guard against two different fields silently pointing at the same source
  // column (e.g. Name and Batch both set to column 3) — this produces
  // confusing joined data (every "name" showing a batch number, etc.) with
  // no obvious error, so it's blocked outright rather than just warned about.
  const indexToFields = new Map<number, string[]>();
  for (const f of FIELD_LABELS) {
    const idx = mapping[f.key];
    if (idx === undefined) continue;
    if (!indexToFields.has(idx)) indexToFields.set(idx, []);
    indexToFields.get(idx)!.push(f.label);
  }
  const conflicts = Array.from(indexToFields.entries()).filter(([, fields]) => fields.length > 1);
  const hasConflicts = conflicts.length > 0;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-slate-100">Confirm which column is which</h2>
        <p className="mt-1 text-sm text-slate-400">
          Detected automatically from &quot;{sheet.sheetName}&quot; ({sheet.rows.length} rows). Override anything
          that&apos;s wrong.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FIELD_LABELS.map((f) => (
            <label key={f.key} className="block">
              <span className="text-sm font-medium text-slate-300">
                {f.label} {f.required && <span className="text-red-500">*</span>}
              </span>
              <select
                className={`mt-1 w-full rounded-md border bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 ${
                  mapping[f.key] !== undefined && (indexToFields.get(mapping[f.key]!)?.length ?? 0) > 1
                    ? 'border-red-500/50 focus:border-red-400 focus:ring-red-400'
                    : 'border-slate-600 focus:border-brand-500 focus:ring-brand-500'
                }`}
                value={mapping[f.key] ?? ''}
                onChange={(e) =>
                  setMapping((m) => ({
                    ...m,
                    [f.key]: e.target.value === '' ? undefined : Number(e.target.value),
                  }))
                }
              >
                <option value="">— not mapped —</option>
                {sheet.headers.map((h, i) => {
                  const usedByOthers = (indexToFields.get(i) || []).filter((label) => label !== f.label);
                  return (
                    <option key={i} value={i}>
                      {h || `(column ${i + 1})`}
                      {usedByOthers.length > 0 ? ` — also picked for ${usedByOthers.join(', ')}` : ''}
                    </option>
                  );
                })}
              </select>
            </label>
          ))}
        </div>

        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-slate-300">Preview (first 5 rows)</p>
          <div className="scroll-box">
            <table className="data-table">
              <thead>
                <tr>
                  {FIELD_LABELS.map((f) => (
                    <th key={f.key}>{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.rows.slice(0, 5).map((r, i) => (
                  <tr key={i}>
                    {FIELD_LABELS.map((f) => (
                      <td key={f.key}>{mapping[f.key] !== undefined ? r[mapping[f.key]!] || '—' : '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Double-check this preview before continuing — if a column looks wrong here (e.g. Name showing numbers),
            fix the dropdown above rather than continuing and fixing it later.
          </p>
        </div>

        {hasConflicts && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            <strong>Same column picked for more than one field:</strong>{' '}
            {conflicts
              .map(([idx, fields]) => `"${sheet.headers[idx] || `column ${idx + 1}`}" → ${fields.join(' & ')}`)
              .join('; ')}
            . Pick a different column for each before continuing.
          </div>
        )}

        {!hasConflicts && missing.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
            Still need: {missing.map((m) => m.label).join(', ')}
          </div>
        )}

        <div className="mt-6 flex justify-between">
          <button onClick={onBack} className="rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800">
            Back
          </button>
          <button
            disabled={missing.length > 0 || hasConflicts}
            onClick={() => onConfirm(mapping)}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
