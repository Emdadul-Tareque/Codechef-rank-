import { useCallback, useRef, useState } from 'react';
import { readWorkbookFile, RawSheet } from '@/lib/excelIO';

interface Props {
  onLoaded: (sheet: RawSheet, file: File) => void;
  savedProgressBanner?: { count: number; total: number } | null;
  onResume?: () => void;
  onDiscardSaved?: () => void;
}

export default function UploadStep({ onLoaded, savedProgressBanner, onResume, onDiscardSaved }: Props) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File | undefined | null) => {
      if (!file) return;
      const okExt = /\.(xlsx|xls|csv)$/i.test(file.name);
      if (!okExt) {
        setError(`"${file.name}" doesn't look like an Excel/CSV file. Please upload .xlsx, .xls, or .csv.`);
        return;
      }
      setError(null);
      setLoading(true);
      try {
        const sheet = await readWorkbookFile(file);
        if (sheet.rows.length === 0) {
          setError(`"${sheet.sheetName}" has a header row but no data rows below it.`);
          setLoading(false);
          return;
        }
        onLoaded(sheet, file);
      } catch (e: any) {
        setError(e?.message || 'Could not read that file.');
      } finally {
        setLoading(false);
      }
    },
    [onLoaded]
  );

  return (
    <div className="mx-auto max-w-2xl">
      {savedProgressBanner && (
        <div className="card mb-6 flex items-center justify-between gap-4 border-brand-200 bg-brand-50 p-4">
          <div className="text-sm text-brand-900">
            <strong>Unfinished run found</strong> — {savedProgressBanner.count} of{' '}
            {savedProgressBanner.total} handles were already fetched last time.
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={onResume}
              className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              Resume
            </button>
            <button
              onClick={onDiscardSaved}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={`card flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed p-14 text-center transition-colors ${
          dragActive ? 'border-brand-500 bg-brand-50' : 'border-gray-300 hover:border-brand-300'
        }`}
      >
        <div className="rounded-full bg-brand-50 p-3">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3550f5" strokeWidth="1.8">
            <path d="M12 16V4M12 4l-4 4M12 4l4 4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <p className="font-medium text-gray-800">
            {loading ? 'Reading file…' : 'Drop your roster here, or click to browse'}
          </p>
          <p className="mt-1 text-sm text-gray-500">.xlsx, .xls, or .csv — Name, Batch, CodeChef Handle, University/Institute</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <p className="mt-6 text-center text-xs text-gray-400">
        Nothing leaves your browser except CodeChef profile requests, which run through this app&apos;s own server.
      </p>
    </div>
  );
}
