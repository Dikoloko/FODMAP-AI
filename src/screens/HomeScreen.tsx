import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '../types';
import UserSelector from '../components/UserSelector';
import FoodCard from '../components/FoodCard';
import { searchFoods } from '../utils/fodmapAnalyzer';
import { useDiary } from '../hooks/useDiary';
import { useDataExport } from '../hooks/useDataExport';

function getGreeting(user: User): string {
  const hour = new Date().getHours();
  const name = user === 'bram' ? 'Bram' : 'Helena';
  if (hour < 12) return `Goeiemorgen, ${name}`;
  if (hour < 18) return `Goedemiddag, ${name}`;
  return `Goedenavond, ${name}`;
}

const actions = [
  { label: 'Scan Product', icon: '📷', route: '/scan', desc: 'Barcode lookup' },
  { label: 'Analyze Photo', icon: '🍽️', route: '/photo', desc: 'AI food analysis' },
  { label: 'Log Meal', icon: '📝', route: '/diary', desc: 'Food diary' },
  { label: 'Get Recipe', icon: '🧑‍🍳', route: '/recipes', desc: 'AI recipe ideas' },
];

interface Props {
  user: User;
  onSwitchUser: (user: User) => void;
}

function toDateString(date: Date) {
  return date.toISOString().split('T')[0];
}

export default function HomeScreen({ user, onSwitchUser }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const { exportData, importData, importing, importError, importSuccess } = useDataExport();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { getEntriesForDate, getSymptomsForDate, addEntry } = useDiary(user);

  const today = toDateString(new Date());
  const todayEntries = getEntriesForDate(today);
  const todaySymptoms = getSymptomsForDate(today);
  const todayFoods = todayEntries.flatMap(e => e.foods);

  const results = useMemo(() => searchFoods(query), [query]);

  // Guess meal from time of day
  const guessedMeal = (() => {
    const h = new Date().getHours();
    if (h < 11) return 'breakfast' as const;
    if (h < 15) return 'lunch' as const;
    if (h < 21) return 'dinner' as const;
    return 'snack' as const;
  })();

  return (
    <div className="flex-1 px-4 pt-4 pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{getGreeting(user)}</h1>
        <UserSelector user={user} onSwitch={onSwitchUser} />
      </div>

      {/* Food search */}
      <div className="relative mb-6">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search any food (EN, NL, or FR)..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Search results */}
      {query.length >= 2 && (
        <div className="mb-6">
          <p className="text-xs text-gray-400 mb-3">
            {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
          </p>
          <div className="flex flex-col gap-3">
            {results.map((food) => (
              <FoodCard
                key={food.name}
                food={food}
                onLog={() => addEntry(today, guessedMeal, [{
                  name: food.name,
                  rating: food.rating,
                  fodmapTypes: food.fodmapTypes,
                  portion: food.safeServing || undefined,
                }])}
              />
            ))}
            {results.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No foods found. Try a different search term or use Photo Analysis for AI-powered lookup.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Quick actions — hide when searching */}
      {query.length < 2 && (
        <>
          <p className="text-gray-500 mb-4">What would you like to check?</p>

          <div className="grid grid-cols-2 gap-3">
            {actions.map(({ label, icon, route, desc }) => (
              <button
                key={route}
                onClick={() => navigate(route)}
                className="flex flex-col items-start gap-2 p-4 bg-white rounded-xl shadow-sm border border-gray-100 active:scale-[0.98] transition-transform min-h-[100px]"
              >
                <span className="text-3xl">{icon}</span>
                <div className="text-left">
                  <div className="font-semibold text-gray-900 text-sm">{label}</div>
                  <div className="text-xs text-gray-400">{desc}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-8 p-4 bg-primary-light/50 rounded-xl">
            <h2 className="font-semibold text-gray-900 text-sm mb-1">Today's Summary</h2>
            {todayFoods.length === 0 ? (
              <div className="flex items-center gap-3">
                <span className="text-2xl">📝</span>
                <p className="text-sm text-gray-500">No meals logged yet today. Tap "Log Meal" to start tracking.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 mt-2">
                <p className="text-sm text-gray-600">
                  {todayFoods.length} food{todayFoods.length !== 1 ? 's' : ''} logged
                  {todayFoods.filter(f => f.rating === 'red').length > 0 && (
                    <span className="text-fodmap-red font-medium">
                      {' '}({todayFoods.filter(f => f.rating === 'red').length} high FODMAP)
                    </span>
                  )}
                </p>
                {todaySymptoms && (
                  <p className="text-sm text-gray-600">
                    Feeling: {todaySymptoms.overallFeeling === 'good' ? '😊 Good' : todaySymptoms.overallFeeling === 'okay' ? '😐 Okay' : '😣 Bad'}
                    {todaySymptoms.bloating > 0 && ` · Bloating ${todaySymptoms.bloating}/5`}
                    {todaySymptoms.pain > 0 && ` · Pain ${todaySymptoms.pain}/5`}
                  </p>
                )}
              </div>
            )}
          </div>
          {/* Data backup */}
          <div className="mt-4">
            <div className="flex gap-2">
              <button
                onClick={() => exportData()}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-white rounded-xl border border-gray-100 shadow-sm text-xs text-gray-500 font-medium active:bg-gray-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Export data
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-white rounded-xl border border-gray-100 shadow-sm text-xs text-gray-500 font-medium active:bg-gray-50 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                {importing ? 'Importing...' : 'Import data'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importData(file);
                  e.target.value = '';
                }}
              />
            </div>
            {importError && (
              <p className="mt-1.5 text-xs text-fodmap-red text-center">{importError}</p>
            )}
            {importSuccess && (
              <p className="mt-1.5 text-xs text-fodmap-green font-medium text-center">Data imported — reload to see changes</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
