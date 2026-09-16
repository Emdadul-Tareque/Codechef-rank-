import { OverallSummary } from '@/lib/stats';

export default function SummaryCards({ summary }: { summary: OverallSummary }) {
  const cards = [
    { label: 'Students on roster', value: summary.total },
    { label: 'Rated on CodeChef', value: summary.found },
    { label: 'Batches', value: summary.distinctBatches },
    { label: 'Universities', value: summary.distinctUniversities },
    {
      label: 'Avg. Highest Rating',
      value: summary.avgHighestRating ? Math.round(summary.avgHighestRating) : '—',
    },
    { label: 'Needs attention', value: summary.needsAttention },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <div key={c.label} className="card p-4">
          <div className="font-mono text-2xl font-semibold text-slate-100">{c.value}</div>
          <div className="mt-1 text-xs text-slate-400">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
