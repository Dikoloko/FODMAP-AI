import type { FoodCorrelation, WeekTrend, LifestyleCorrelation } from '../../utils/insightEngine';

export function TriggerFoodCard({ c }: { c: FoodCorrelation }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2.5">
        <span className="w-2.5 h-2.5 rounded-full bg-fodmap-red shrink-0" />
        <div>
          <span className="text-sm text-gray-900 capitalize font-medium">{c.food}</span>
          <p className="text-xs text-gray-400">
            Eaten {c.timesEaten}x · Bad {Math.round(c.badRate * 100)}% of the time
          </p>
        </div>
      </div>
      <div className="text-right">
        <span className="text-xs font-semibold text-fodmap-red">
          {Math.round(c.avgSymptomScore * 100)}%
        </span>
        <p className="text-[10px] text-gray-400">severity</p>
      </div>
    </div>
  );
}

export function SafeFoodCard({ c }: { c: FoodCorrelation }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2.5">
        <span className="w-2.5 h-2.5 rounded-full bg-fodmap-green shrink-0" />
        <div>
          <span className="text-sm text-gray-900 capitalize font-medium">{c.food}</span>
          <p className="text-xs text-gray-400">
            Eaten {c.timesEaten}x · Good {Math.round(c.goodRate * 100)}% of the time
          </p>
        </div>
      </div>
      <span className="text-xs font-semibold text-fodmap-green">Safe</span>
    </div>
  );
}

export function TrendBar({ trend, maxScore }: { trend: WeekTrend; maxScore: number }) {
  const height = maxScore > 0 ? (trend.avgScore / maxScore) * 100 : 0;
  const color = trend.avgScore > 0.3 ? 'bg-fodmap-red' : trend.avgScore > 0.15 ? 'bg-fodmap-amber' : 'bg-fodmap-green';

  return (
    <div className="flex flex-col items-center gap-1 flex-1">
      <div className="w-full h-24 bg-gray-50 rounded-lg relative overflow-hidden flex items-end">
        {trend.daysLogged > 0 ? (
          <div
            className={`w-full ${color} rounded-lg transition-all duration-300`}
            style={{ height: `${Math.max(height, 8)}%` }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-[10px] text-gray-300">—</span>
          </div>
        )}
      </div>
      <span className="text-[10px] text-gray-400 text-center leading-tight">{trend.weekLabel}</span>
      {trend.daysLogged > 0 && (
        <div className="flex gap-1">
          {trend.goodDays > 0 && <span className="text-[10px] text-fodmap-green">{trend.goodDays}😊</span>}
          {trend.badDays > 0 && <span className="text-[10px] text-fodmap-red">{trend.badDays}😣</span>}
        </div>
      )}
    </div>
  );
}

export function LifestyleInsight({ lc }: { lc: LifestyleCorrelation }) {
  const isWorse = lc.difference > 0.05;
  const isBetter = lc.difference < -0.05;

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <span className="text-lg">{lc.emoji}</span>
        <div>
          <span className="text-sm text-gray-900 font-medium">{lc.factor}</span>
          <p className="text-xs text-gray-400">{lc.daysPresent} days logged</p>
        </div>
      </div>
      <span className={`text-xs font-semibold ${
        isWorse ? 'text-fodmap-red' : isBetter ? 'text-fodmap-green' : 'text-gray-400'
      }`}>
        {isWorse ? `+${Math.round(lc.difference * 100)}% worse`
          : isBetter ? `${Math.round(lc.difference * 100)}% better`
          : 'No clear effect'}
      </span>
    </div>
  );
}
