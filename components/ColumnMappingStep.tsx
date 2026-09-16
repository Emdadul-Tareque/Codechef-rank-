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

  return (
    <div className="mx-auto max-w-4xl">
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900">Confirm which column is which</h2>
        <p className="mt-1 text-sm text-gray-500">
          Detected automatically from &quot;{sheet.sheetName}&quot; ({sheet.rows.length} rows). Override anything
          that&apos;s wrong.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FIELD_LABELS.map((f) => (
            <label key={f.key} className="block">
              <span className="text-sm font-medium text-gray-700">
                {f.label} {f.required && <span className="text-red-500">*</span>}
              </span>
              <select
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                value={mapping[f.key] ?? ''}
                onChange={(e) =>
                  setMapping((m) => ({
                    ...m,
                    [f.key]: e.target.value === '' ? undefined : Number(e.target.value),
                  }))
                }
              >
                <option value="">— not mapped —</option>
                {sheet.headers.map((h, i) => (
                  <option key={i} value={i}>
                    {h || `(column ${i + 1})`}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-gray-700">Preview (first 5 rows)</p>
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
        </div>

        {missing.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Still need: {missing.map((m) => m.label).join(', ')}
          </div>
        )}

        <div className="mt-6 flex justify-between">
          <button onClick={onBack} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Back
          </button>
          <button
            disabled={missing.length > 0}
            onClick={() => onConfirm(mapping)}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
