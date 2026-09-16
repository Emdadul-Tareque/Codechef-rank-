import { tierColor } from '@/lib/tierColors';

export default function TierBadge({ tier }: { tier: string }) {
  const color = tierColor(tier);
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: `${color}26`, color }}
    >
      {tier}
    </span>
  );
}
