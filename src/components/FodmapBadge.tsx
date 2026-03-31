import type { FodmapRating } from '../types';

const config: Record<FodmapRating, { bg: string; text: string; label: string }> = {
  green: { bg: 'bg-fodmap-green/15', text: 'text-fodmap-green', label: 'Low FODMAP' },
  amber: { bg: 'bg-fodmap-amber/15', text: 'text-fodmap-amber', label: 'Moderate' },
  red: { bg: 'bg-fodmap-red/15', text: 'text-fodmap-red', label: 'High FODMAP' },
};

export default function FodmapBadge({ rating }: { rating: FodmapRating }) {
  const { bg, text, label } = config[rating];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${bg} ${text}`}>
      <span className={`w-2 h-2 rounded-full ${rating === 'green' ? 'bg-fodmap-green' : rating === 'amber' ? 'bg-fodmap-amber' : 'bg-fodmap-red'}`} />
      {label}
    </span>
  );
}
