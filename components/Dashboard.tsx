import { JoinedRecord } from '@/lib/types';
import { computeBatchStats, computeUniversityStats, computeLeaderboard, computeOverallSummary } from '@/lib/stats';
import { exportResultWorkbook, exportFullReportWorkbook } from '@/lib/excelIO';
import { UniversityCluster } from '@/lib/types';
import { TIER_ORDER } from '@/lib/stats';
import SummaryCards from '@/components/dashboard/SummaryCards';
import BatchChart from '@/components/dashboard/BatchChart';
import UniversityChart from '@/components/dashboard/UniversityChart';
import BreakdownTable from '@/components/dashboard/BreakdownTable';
import LeaderboardTable from '@/components/dashboard/LeaderboardTable';
import DataQualityPanel from '@/components/dashboard/DataQualityPanel';
import FetchProgressBar from '@/components/dashboard/FetchProgressBar';
import ContestAnalysis from '@/components/dashboard/ContestAnalysis';

interface FetchCounts {
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
  records: JoinedRecord[];
  universityClusters: UniversityCluster[];
  onRetryHandles: (handles: string[]) => void;
  retrying: boolean;
  onEditUniversityMapping: () => void;
  onStartOver: () => void;
  isFetching: boolean;
  fetchDone: number;
  fetchTotal: number;
  fetchCounts: FetchCounts;
  fetchStatusLine: string;
  onCancelFetch: () => void;
}

export default function Dashboard({
  records,
  universityClusters,
  onRetryHandles,
  retrying,
  onEditUniversityMapping,
  onStartOver,
  isFetching,
  fetchDone,
  fetchTotal,
  fetchCounts,
  fetchStatusLine,
  onCancelFetch,
}: Props) {
  const summary = computeOverallSummary(records);
  const batchStats = computeBatchStats(records);
  const universityStats = computeUniversityStats(records);
  const leaderboard = computeLeaderboard(records, 20);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">CodeChef Performance Dashboard</h1>
          <p className="text-sm text-gray-500">Phitron student roster — batch &amp; university breakdown by CodeChef rank</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onEditUniversityMapping}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Edit university mapping
          </button>
          <button
            onClick={() => exportResultWorkbook(records)}
            className="rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100"
          >
            Download Result Excel
          </button>
          <button
            onClick={() =>
              exportFullReportWorkbook({
                records,
                batchStats,
                universityStats,
                universityClusters,
                leaderboard,
                tierOrder: TIER_ORDER,
              })
            }
            className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Download Full Report Excel
          </button>
          <button
            onClick={onStartOver}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50"
          >
            Start over
          </button>
        </div>
      </div>

      <FetchProgressBar
        total={fetchTotal}
        done={fetchDone}
        counts={fetchCounts}
        isRunning={isFetching}
        statusLine={fetchStatusLine}
        onCancel={onCancelFetch}
      />

      <SummaryCards summary={summary} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BatchChart stats={batchStats} />
        <UniversityChart stats={universityStats} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BreakdownTable
          title="Batch breakdown"
          rows={batchStats.map((b) => ({
            label: b.batch,
            total: b.total,
            foundCount: b.foundCount,
            tierCounts: b.tierCounts,
            avgHighestRating: b.avgHighestRating,
          }))}
        />
        <BreakdownTable
          title="University breakdown"
          rows={universityStats.map((u) => ({
            label: u.university,
            total: u.total,
            foundCount: u.foundCount,
            tierCounts: u.tierCounts,
            avgHighestRating: u.avgHighestRating,
          }))}
        />
      </div>

      <LeaderboardTable records={leaderboard} />

      <ContestAnalysis records={records} />

      <DataQualityPanel records={records} summary={summary} onRetry={onRetryHandles} retrying={retrying} />
    </div>
  );
}
