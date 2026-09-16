import Head from 'next/head';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import UploadStep from '@/components/UploadStep';
import ColumnMappingStep from '@/components/ColumnMappingStep';
import UniversityMappingReview from '@/components/UniversityMappingReview';
import ProcessingStep from '@/components/ProcessingStep';
import Dashboard from '@/components/Dashboard';
import { ColumnMapping, RawSheet, buildSourceRows, guessColumnMapping } from '@/lib/excelIO';
import { buildUniversityMapping, UniversityMappingResult } from '@/lib/universityMap';
import { cleanHandle, isPlausibleHandle } from '@/lib/handleUtils';
import { BatchApiResponse, CodeChefResult, FetchStatus, JoinedRecord, SourceRow } from '@/lib/types';

type Step = 'upload' | 'mapping' | 'university_review' | 'processing' | 'dashboard';

const SESSION_KEY = 'phitron_codechef_session_v1';
const BATCH_SIZE = 25;

interface SessionState {
  fingerprint: string;
  sourceRows: SourceRow[];
  universityMapping: UniversityMappingResult;
  results: Record<string, CodeChefResult>;
  savedAt: number;
}

function fingerprintFor(rows: SourceRow[]): string {
  const handles = rows.map((r) => r.handle).filter(Boolean);
  return `${handles.length}:${handles.slice(0, 3).join(',')}:${handles.slice(-3).join(',')}`;
}

function loadSession(): SessionState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionState;
  } catch {
    return null;
  }
}

function saveSession(state: SessionState) {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded or storage disabled — non-fatal, just means no resume.
  }
}

function clearSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* noop */
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function emptyCounts() {
  return { ok: 0, not_found: 0, unrated: 0, blocked: 0, error: 0, invalid_handle: 0, no_handle: 0, pending: 0 };
}

export default function Home() {
  const [step, setStep] = useState<Step>('upload');
  const [rawSheet, setRawSheet] = useState<RawSheet | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [sourceRows, setSourceRows] = useState<SourceRow[]>([]);
  const [universityMapping, setUniversityMapping] = useState<UniversityMappingResult | null>(null);
  const [results, setResults] = useState<Record<string, CodeChefResult>>({});
  const [isFetching, setIsFetching] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [statusLine, setStatusLine] = useState('');
  const [savedSession, setSavedSession] = useState<SessionState | null>(null);

  const cancelRef = useRef(false);
  const resultsRef = useRef(results);
  resultsRef.current = results;

  useEffect(() => {
    setSavedSession(loadSession());
  }, []);

  const persist = useCallback((rows: SourceRow[], uniMap: UniversityMappingResult, res: Record<string, CodeChefResult>) => {
    saveSession({ fingerprint: fingerprintFor(rows), sourceRows: rows, universityMapping: uniMap, results: res, savedAt: Date.now() });
  }, []);

  // ---------------------------------------------------------------------
  // Step 1: upload
  // ---------------------------------------------------------------------
  const handleLoaded = (sheet: RawSheet, _file: File) => {
    setRawSheet(sheet);
    setColumnMapping(guessColumnMapping(sheet.headers));
    setStep('mapping');
  };

  const handleResume = () => {
    if (!savedSession) return;
    setSourceRows(savedSession.sourceRows);
    setUniversityMapping(savedSession.universityMapping);
    setResults(savedSession.results);
    const total = savedSession.sourceRows.length;
    const done = Object.keys(savedSession.results).length;
    setStep(done >= total ? 'dashboard' : 'processing');
  };

  const handleDiscardSaved = () => {
    clearSession();
    setSavedSession(null);
  };

  // ---------------------------------------------------------------------
  // Step 2: column mapping confirmed -> build source rows
  // ---------------------------------------------------------------------
  const handleMappingConfirm = (mapping: ColumnMapping) => {
    if (!rawSheet) return;
    setColumnMapping(mapping);
    const { rows } = buildSourceRows(rawSheet, mapping);
    setSourceRows(rows);
    const uniResult = buildUniversityMapping(rows.map((r) => r.university));
    setUniversityMapping(uniResult);
    setStep('university_review');
  };

  // ---------------------------------------------------------------------
  // Step 3: university mapping confirmed -> apply + start fetching
  // ---------------------------------------------------------------------
  const handleUniversityConfirm = (uniResult: UniversityMappingResult) => {
    const updatedRows = sourceRows.map((r) => ({
      ...r,
      universityNormalized: uniResult.applyMap[r.university.trim()] || r.university,
    }));
    setSourceRows(updatedRows);
    setUniversityMapping(uniResult);
    setResults({});
    persist(updatedRows, uniResult, {});
    setStep('processing');
    // Kick off in the next tick so state above has committed.
    setTimeout(() => runFetchLoop(updatedRows.map((r) => r.handle), uniResult, updatedRows), 0);
  };

  // ---------------------------------------------------------------------
  // Core fetch loop — shared by the initial run and the "retry" action.
  // ---------------------------------------------------------------------
  const runFetchLoop = useCallback(
    async (handles: string[], uniMap: UniversityMappingResult, rows: SourceRow[]) => {
      cancelRef.current = false;
      setIsFetching(true);

      const unique = Array.from(new Set(handles));
      const toFetch: string[] = [];
      const immediate: Record<string, CodeChefResult> = {};

      for (const h of unique) {
        if (!h) continue; // blank handled by JoinedRecord default ('no_handle')
        if (!isPlausibleHandle(h)) {
          immediate[h] = {
            handle: h,
            status: 'invalid_handle',
            currentRating: null,
            highestRating: null,
            stars: null,
            countryName: null,
            note: `"${h}" doesn't look like a valid CodeChef handle`,
          };
        } else {
          toFetch.push(h);
        }
      }

      let current = { ...resultsRef.current, ...immediate };
      setResults(current);

      const batches: string[][] = [];
      for (let i = 0; i < toFetch.length; i += BATCH_SIZE) batches.push(toFetch.slice(i, i + BATCH_SIZE));

      for (let bi = 0; bi < batches.length; bi++) {
        if (cancelRef.current) break;
        const batch = batches[bi];
        setStatusLine(`Batch ${bi + 1} of ${batches.length}…`);

        try {
          const resp = await fetch('/api/fetch-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ handles: batch }),
          });
          if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err?.error || `HTTP ${resp.status}`);
          }
          const data: BatchApiResponse = await resp.json();
          const updated = { ...current };
          for (const item of data.results) updated[item.handle] = item.result;
          current = updated;
          setResults(current);
          persist(rows, uniMap, current);

          if (data.meta.blockedCount > 0) {
            setStatusLine(
              `CodeChef pushed back on ${data.meta.blockedCount}/${batch.length} in this batch — slowing down…`
            );
          }
          if (bi < batches.length - 1) {
            await sleep(data.meta.suggestedDelayMs + Math.random() * 300);
          }
        } catch (e: any) {
          const updated = { ...current };
          for (const h of batch) {
            updated[h] = {
              handle: h,
              status: 'error' as FetchStatus,
              currentRating: null,
              highestRating: null,
              stars: null,
              countryName: null,
              note: `Batch request failed: ${e?.message || e}. Safe to retry from the dashboard.`,
            };
          }
          current = updated;
          setResults(current);
          persist(rows, uniMap, current);
          await sleep(4000); // back off harder after an outright failure
        }
      }

      setIsFetching(false);
      setStatusLine(cancelRef.current ? 'Cancelled.' : 'Done.');
    },
    [persist]
  );

  const handleCancel = () => {
    cancelRef.current = true;
  };

  const handleFinishEarly = () => setStep('dashboard');

  const handleRetryHandles = async (handles: string[]) => {
    if (!universityMapping) return;
    setRetrying(true);
    await runFetchLoop(handles, universityMapping, sourceRows);
    setRetrying(false);
  };

  const handleStartOver = () => {
    clearSession();
    setRawSheet(null);
    setColumnMapping({});
    setSourceRows([]);
    setUniversityMapping(null);
    setResults({});
    setSavedSession(null);
    setStep('upload');
  };

  // ---------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------
  const records: JoinedRecord[] = useMemo(
    () =>
      sourceRows.map((row) => ({
        ...row,
        result:
          results[row.handle] ||
          ({
            handle: row.handle,
            status: (row.handle ? 'pending' : 'no_handle') as FetchStatus,
            currentRating: null,
            highestRating: null,
            stars: null,
            countryName: null,
            note: row.handle ? '' : 'No handle provided',
          } as CodeChefResult),
      })),
    [sourceRows, results]
  );

  const progressCounts = useMemo(() => {
    const c = emptyCounts();
    for (const r of records) {
      const s = r.result.status;
      if (s in c) (c as any)[s]++;
    }
    return c;
  }, [records]);

  const done = records.length - progressCounts.pending;

  return (
    <>
      <Head>
        <title>Phitron · CodeChef Performance Dashboard</title>
        <meta name="description" content="Bulk CodeChef rating lookup and batch/university leaderboard for Phitron." />
      </Head>
      <div className="min-h-screen bg-[#f6f7fb] px-4 py-10">
        <header className="mx-auto mb-8 max-w-6xl">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-500">Phitron</p>
          <h1 className="text-2xl font-bold text-gray-900">CodeChef Performance Dashboard</h1>
        </header>

        {step === 'upload' && (
          <UploadStep
            onLoaded={handleLoaded}
            savedProgressBanner={
              savedSession
                ? { count: Object.keys(savedSession.results).length, total: savedSession.sourceRows.length }
                : null
            }
            onResume={handleResume}
            onDiscardSaved={handleDiscardSaved}
          />
        )}

        {step === 'mapping' && rawSheet && (
          <ColumnMappingStep
            sheet={rawSheet}
            initialMapping={columnMapping}
            onConfirm={handleMappingConfirm}
            onBack={() => setStep('upload')}
          />
        )}

        {step === 'university_review' && universityMapping && (
          <UniversityMappingReview
            initial={universityMapping}
            onConfirm={handleUniversityConfirm}
            onBack={() => setStep('mapping')}
          />
        )}

        {step === 'processing' && (
          <ProcessingStep
            total={records.length}
            done={done}
            counts={progressCounts}
            isRunning={isFetching}
            statusLine={statusLine}
            onCancel={handleCancel}
            onFinishEarly={handleFinishEarly}
          />
        )}

        {step === 'dashboard' && universityMapping && (
          <Dashboard
            records={records}
            universityClusters={universityMapping.clusters}
            onRetryHandles={handleRetryHandles}
            retrying={retrying}
            onEditUniversityMapping={() => setStep('university_review')}
            onStartOver={handleStartOver}
          />
        )}
      </div>
    </>
  );
}
