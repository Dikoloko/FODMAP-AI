import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { MealType, DiaryFood, FodmapRating, OverallFeeling, User, BristolScore } from '../types';
import { useDiary } from '../hooks/useDiary';
import { searchFoods } from '../utils/fodmapAnalyzer';
import FodmapBadge from '../components/FodmapBadge';

const MEALS: { key: MealType; label: string; icon: string }[] = [
  { key: 'breakfast', label: 'Breakfast', icon: '🌅' },
  { key: 'lunch', label: 'Lunch', icon: '☀️' },
  { key: 'dinner', label: 'Dinner', icon: '🌙' },
  { key: 'snack', label: 'Snacks', icon: '🍎' },
];

const FEELINGS: { value: OverallFeeling; emoji: string; label: string }[] = [
  { value: 'good', emoji: '😊', label: 'Good' },
  { value: 'okay', emoji: '😐', label: 'Okay' },
  { value: 'bad', emoji: '😣', label: 'Bad' },
];

function formatDate(date: string) {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function toDateString(date: Date) {
  return date.toISOString().split('T')[0];
}

interface Props {
  user: User;
}

// Undo toast component
function UndoToast({ message, onUndo, onDismiss }: { message: string; onUndo: () => void; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-20 left-4 right-4 max-w-lg mx-auto z-50 animate-[slideUp_0.2s_ease-out]">
      <div className="bg-gray-900 text-white rounded-xl px-4 py-3 flex items-center justify-between shadow-lg">
        <span className="text-sm">{message}</span>
        <button onClick={onUndo} className="text-primary font-semibold text-sm ml-3 shrink-0">
          Undo
        </button>
      </div>
    </div>
  );
}

// Add food modal
function AddFoodForm({ onAdd, onCancel }: { onAdd: (food: DiaryFood) => void; onCancel: () => void }) {
  const [query, setQuery] = useState('');
  const [customName, setCustomName] = useState('');
  const [customRating, setCustomRating] = useState<FodmapRating>('green');

  const results = useMemo(() => searchFoods(query), [query]);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <h4 className="text-sm font-semibold text-gray-900 mb-3">Add food</h4>

      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setCustomName(e.target.value); }}
        placeholder="Search food or type name..."
        autoFocus
        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 mb-2"
      />

      {/* Search results */}
      {query.length >= 2 && results.length > 0 && (
        <div className="max-h-48 overflow-y-auto mb-2 flex flex-col gap-1">
          {results.slice(0, 6).map((food) => (
            <button
              key={food.name}
              onClick={() => onAdd({
                name: food.name,
                rating: food.rating,
                fodmapTypes: food.fodmapTypes,
                portion: food.safeServing || undefined,
              })}
              className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 active:bg-gray-100 text-left"
            >
              <span className="text-sm text-gray-900 capitalize">{food.name}</span>
              <FodmapBadge rating={food.rating} />
            </button>
          ))}
        </div>
      )}

      {/* Custom entry if no match */}
      {query.length >= 2 && (
        <div className="border-t border-gray-100 pt-2 mt-1">
          <p className="text-xs text-gray-400 mb-2">Or add as custom entry:</p>
          <div className="flex gap-2 mb-2">
            {(['green', 'amber', 'red'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setCustomRating(r)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  customRating === r
                    ? r === 'green' ? 'bg-fodmap-green/15 text-fodmap-green'
                    : r === 'amber' ? 'bg-fodmap-amber/15 text-fodmap-amber'
                    : 'bg-fodmap-red/15 text-fodmap-red'
                    : 'bg-gray-50 text-gray-400'
                }`}
              >
                {r === 'green' ? 'Low' : r === 'amber' ? 'Moderate' : 'High'}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              const name = (customName || query).trim();
              if (!name) return;
              onAdd({ name, rating: customRating, fodmapTypes: [] });
            }}
            disabled={!(customName || query).trim()}
            className="w-full py-2 bg-primary text-white text-sm font-medium rounded-lg active:scale-[0.98] disabled:opacity-40"
          >
            Add "{customName || query}"
          </button>
        </div>
      )}

      <button onClick={onCancel} className="w-full py-2 text-xs text-gray-400 mt-2">
        Cancel
      </button>
    </div>
  );
}

// Reusable slider row
function SymptomSlider({ label, emoji, value, hint, onChange }: {
  label: string; emoji: string; value: number; hint: string; onChange: (v: number) => void;
}) {
  return (
    <div className="mb-2.5">
      <div className="flex justify-between text-xs text-gray-500 mb-0.5">
        <span title={hint}>{emoji} {label}</span>
        <span className={value > 3 ? 'text-fodmap-red font-medium' : ''}>{value > 0 ? `${value}/5` : '—'}</span>
      </div>
      {value === 0 && <p className="text-[10px] text-gray-300 mb-0.5">{hint}</p>}
      <input
        type="range" min={0} max={5} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary h-1.5"
      />
    </div>
  );
}

const BRISTOL_LABELS = [
  '', // 0 = not logged
  '1 — Hard lumps',
  '2 — Lumpy sausage',
  '3 — Cracked sausage',
  '4 — Smooth (ideal)',
  '5 — Soft blobs',
  '6 — Mushy',
  '7 — Watery',
];

// Symptom tracker with auto-save — expanded with full symptom types + lifestyle
function SymptomTracker({ date, user }: { date: string; user: User }) {
  const { getSymptomsForDate, setSymptomsForDate } = useDiary(user);
  const existing = getSymptomsForDate(date);

  const [feeling, setFeeling] = useState<OverallFeeling>(existing?.overallFeeling ?? 'good');
  const [bloating, setBloating] = useState(existing?.bloating ?? 0);
  const [pain, setPain] = useState(existing?.pain ?? 0);
  const [gas, setGas] = useState(existing?.gas ?? 0);
  const [diarrhea, setDiarrhea] = useState(existing?.diarrhea ?? 0);
  const [constipation, setConstipation] = useState(existing?.constipation ?? 0);
  const [nausea, setNausea] = useState(existing?.nausea ?? 0);
  const [fatigue, setFatigue] = useState(existing?.fatigue ?? 0);
  const [urgency, setUrgency] = useState(existing?.urgency ?? 0);
  const [bristol, setBristol] = useState<BristolScore>(existing?.bristol ?? 0);
  const [stress, setStress] = useState(existing?.stress ?? 0);
  const [sleepQuality, setSleepQuality] = useState(existing?.sleepQuality ?? 0);
  const [exercise, setExercise] = useState(existing?.exercise ?? false);
  const [menstruation, setMenstruation] = useState(existing?.menstruation ?? false);
  const [otherSymptoms, setOtherSymptoms] = useState(existing?.otherSymptoms ?? '');
  const [saved, setSaved] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Reset state when date changes
  useEffect(() => {
    const s = getSymptomsForDate(date);
    setFeeling(s?.overallFeeling ?? 'good');
    setBloating(s?.bloating ?? 0);
    setPain(s?.pain ?? 0);
    setGas(s?.gas ?? 0);
    setDiarrhea(s?.diarrhea ?? 0);
    setConstipation(s?.constipation ?? 0);
    setNausea(s?.nausea ?? 0);
    setFatigue(s?.fatigue ?? 0);
    setUrgency(s?.urgency ?? 0);
    setBristol(s?.bristol ?? 0);
    setStress(s?.stress ?? 0);
    setSleepQuality(s?.sleepQuality ?? 0);
    setExercise(s?.exercise ?? false);
    setMenstruation(s?.menstruation ?? false);
    setOtherSymptoms(s?.otherSymptoms ?? '');
    setSaved(false);
  }, [date, getSymptomsForDate]);

  // Auto-save with debounce
  const allValues = useMemo(() => ({
    date, bloating, pain, gas, diarrhea, constipation, nausea, fatigue, urgency,
    bristol, otherSymptoms, overallFeeling: feeling,
    stress, sleepQuality, exercise, menstruation,
  }), [date, bloating, pain, gas, diarrhea, constipation, nausea, fatigue, urgency,
    bristol, otherSymptoms, feeling, stress, sleepQuality, exercise, menstruation]);

  const autoSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSymptomsForDate(allValues);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }, 800);
  }, [allValues, setSymptomsForDate]);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    autoSave();
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [autoSave]);

  useEffect(() => { isFirstRender.current = true; }, [date]);

  // Count active symptoms for badge
  const activeSymptomCount = [bloating, pain, gas, diarrhea, constipation, nausea, fatigue, urgency]
    .filter(v => v > 0).length;

  return (
    <div className="flex flex-col gap-3">
      {/* Overall feeling card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">How are you feeling?</h3>
          {saved && (
            <span className="text-xs text-fodmap-green font-medium animate-[fadeIn_0.2s_ease-out]">
              Saved
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {FEELINGS.map(({ value, emoji, label }) => (
            <button
              key={value}
              onClick={() => setFeeling(value)}
              className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg transition-colors ${
                feeling === value ? 'bg-primary-light ring-2 ring-primary/30' : 'bg-gray-50'
              }`}
            >
              <span className="text-2xl">{emoji}</span>
              <span className="text-xs text-gray-600">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Digestive symptoms */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">
            Symptoms
            {activeSymptomCount > 0 && (
              <span className="ml-1.5 text-xs font-normal text-fodmap-red">({activeSymptomCount} active)</span>
            )}
          </h3>
        </div>

        <SymptomSlider label="Bloating" emoji="🫧" hint="Swollen, tight feeling in your belly" value={bloating} onChange={setBloating} />
        <SymptomSlider label="Pain" emoji="🔥" hint="Cramping or aching in your abdomen" value={pain} onChange={setPain} />
        <SymptomSlider label="Gas" emoji="💨" hint="Excessive flatulence or trapped wind" value={gas} onChange={setGas} />

        {/* Expandable extra symptoms */}
        {!showMore && (
          <button
            onClick={() => setShowMore(true)}
            className="w-full py-1.5 text-xs text-primary font-medium mt-1"
          >
            + More symptoms (diarrhea, nausea, fatigue...)
          </button>
        )}
        {showMore && (
          <>
            <SymptomSlider label="Diarrhea" emoji="💧" hint="Loose or watery stools" value={diarrhea} onChange={setDiarrhea} />
            <SymptomSlider label="Constipation" emoji="🧱" hint="Difficulty or infrequent bowel movements" value={constipation} onChange={setConstipation} />
            <SymptomSlider label="Nausea" emoji="🤢" hint="Feeling sick or queasy" value={nausea} onChange={setNausea} />
            <SymptomSlider label="Fatigue" emoji="😴" hint="Unusual tiredness or low energy" value={fatigue} onChange={setFatigue} />
            <SymptomSlider label="Urgency" emoji="🚨" hint="Sudden need to use the bathroom" value={urgency} onChange={setUrgency} />
          </>
        )}
      </div>

      {/* Bristol stool scale */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Stool type (Bristol scale)</h3>
        <p className="text-[10px] text-gray-400 mb-2">Types 3-4 are ideal. 1-2 = constipation, 5-7 = diarrhea</p>
        <div className="grid grid-cols-7 gap-1">
          {([0, 1, 2, 3, 4, 5, 6, 7] as BristolScore[]).slice(1).map((score) => (
            <button
              key={score}
              onClick={() => setBristol(bristol === score ? 0 : score)}
              className={`py-2 rounded-lg text-center text-xs font-medium transition-colors ${
                bristol === score
                  ? score <= 2 ? 'bg-fodmap-amber/20 text-fodmap-amber ring-2 ring-fodmap-amber/30'
                  : score <= 5 ? 'bg-fodmap-green/20 text-fodmap-green ring-2 ring-fodmap-green/30'
                  : 'bg-fodmap-red/20 text-fodmap-red ring-2 ring-fodmap-red/30'
                  : 'bg-gray-50 text-gray-400'
              }`}
            >
              {score}
            </button>
          ))}
        </div>
        {bristol > 0 && (
          <p className="text-xs text-gray-400 mt-1.5">{BRISTOL_LABELS[bristol]}</p>
        )}
      </div>

      {/* Lifestyle factors */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Lifestyle</h3>

        <SymptomSlider label="Stress" emoji="😰" hint="0 = calm, 5 = very stressed" value={stress} onChange={setStress} />
        <SymptomSlider label="Sleep quality" emoji="🛏️" hint="0 = not logged, 5 = great sleep" value={sleepQuality} onChange={setSleepQuality} />

        <div className="flex gap-2 mt-1">
          <button
            onClick={() => setExercise(!exercise)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
              exercise ? 'bg-primary-light ring-2 ring-primary/30 text-primary' : 'bg-gray-50 text-gray-400'
            }`}
          >
            🏃 Exercise
          </button>
          <button
            onClick={() => setMenstruation(!menstruation)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
              menstruation ? 'bg-fodmap-red/10 ring-2 ring-fodmap-red/20 text-fodmap-red' : 'bg-gray-50 text-gray-400'
            }`}
          >
            🩸 Period
          </button>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <textarea
          value={otherSymptoms}
          onChange={(e) => setOtherSymptoms(e.target.value)}
          placeholder="Additional notes..."
          rows={2}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>
    </div>
  );
}

// Weekly heatmap — Fix #3: receives diary data from parent; Fix #6: tappable days
function WeeklyOverview({ getDayRating, getSymptomsForDate, selectedDate, onSelectDate }: {
  getDayRating: (date: string) => 'green' | 'amber' | 'red' | null;
  getSymptomsForDate: (date: string) => { overallFeeling: OverallFeeling } | undefined;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const days = useMemo(() => {
    const result = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = toDateString(d);
      result.push({
        date: dateStr,
        label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        day: d.getDate(),
        rating: getDayRating(dateStr),
        symptoms: getSymptomsForDate(dateStr),
      });
    }
    return result;
  }, [getDayRating, getSymptomsForDate]);

  const ratingColor = (rating: 'green' | 'amber' | 'red' | null, isSelected: boolean) => {
    const base = !rating ? 'bg-gray-100 text-gray-400'
      : rating === 'green' ? 'bg-fodmap-green/20 text-fodmap-green'
      : rating === 'amber' ? 'bg-fodmap-amber/20 text-fodmap-amber'
      : 'bg-fodmap-red/20 text-fodmap-red';
    return isSelected ? `${base} ring-2 ring-primary` : base;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">This week</h3>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => (
          <button
            key={d.date}
            onClick={() => onSelectDate(d.date)}
            className="flex flex-col items-center gap-1"
          >
            <span className="text-[10px] text-gray-400">{d.label}</span>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-semibold transition-all ${ratingColor(d.rating, d.date === selectedDate)}`}>
              {d.symptoms?.overallFeeling === 'good' ? '😊'
                : d.symptoms?.overallFeeling === 'okay' ? '😐'
                : d.symptoms?.overallFeeling === 'bad' ? '😣'
                : d.day}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DiaryScreen({ user }: Props) {
  const [selectedDate, setSelectedDate] = useState(toDateString(new Date()));
  const [addingMeal, setAddingMeal] = useState<MealType | null>(null);
  const [expandedMeals, setExpandedMeals] = useState<Set<MealType>>(new Set());
  const [undoAction, setUndoAction] = useState<{ message: string; restore: () => void } | null>(null);
  const diary = useDiary(user);
  const { getEntriesByMeal, addEntry, removeFoodFromEntry, getDayRating, getSymptomsForDate } = diary;

  const grouped = getEntriesByMeal(selectedDate);
  const todayStr = toDateString(new Date());

  const changeDate = (offset: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + offset);
    const newDate = toDateString(d);
    // Fix #4: Don't allow navigating to future dates
    if (newDate > todayStr) return;
    setSelectedDate(newDate);
  };

  const isToday = selectedDate === todayStr;
  const isFuture = selectedDate > todayStr;

  // Toggle meal section expansion
  const toggleMeal = (meal: MealType) => {
    setExpandedMeals(prev => {
      const next = new Set(prev);
      if (next.has(meal)) next.delete(meal);
      else next.add(meal);
      return next;
    });
  };

  // Check if meal has foods or is being added to
  const isMealActive = (meal: MealType) =>
    grouped[meal].length > 0 || addingMeal === meal || expandedMeals.has(meal);

  // Handle food deletion with undo
  const handleRemoveFood = (entryId: string, foodIndex: number, foodName: string) => {
    // Capture the food and entry info before deletion for undo
    const entry = diary.entries.find(e => e.id === entryId);
    if (!entry) return;
    const removedFood = entry.foods[foodIndex];
    const entryMeal = entry.meal;
    const entryDate = entry.date;

    removeFoodFromEntry(entryId, foodIndex);
    setUndoAction({
      message: `Removed "${foodName}"`,
      restore: () => {
        addEntry(entryDate, entryMeal, [removedFood]);
      },
    });
  };

  return (
    <div className="flex-1 px-4 pt-4 pb-24">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Food Diary</h1>

      {/* Date selector — Fix #7: Today button */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 mb-4">
        <button
          onClick={() => changeDate(-1)}
          className="p-1 text-gray-400 active:text-gray-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Previous day"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={() => setSelectedDate(todayStr)}
          className="text-center min-w-[120px]"
        >
          <p className="text-sm font-semibold text-gray-900">{formatDate(selectedDate)}</p>
          {isToday ? (
            <p className="text-xs text-primary">Today</p>
          ) : (
            <p className="text-xs text-primary underline">Go to today</p>
          )}
        </button>
        <button
          onClick={() => changeDate(1)}
          disabled={isFuture || isToday}
          className="p-1 text-gray-400 active:text-gray-600 disabled:opacity-20 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Next day"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Weekly overview — Fix #3 & #6 */}
      <div className="mb-4">
        <WeeklyOverview
          getDayRating={getDayRating}
          getSymptomsForDate={getSymptomsForDate}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      </div>

      {/* Meal sections — Fix #8: collapse empty */}
      <div className="flex flex-col gap-3 mb-4">
        {MEALS.map(({ key, label, icon }) => {
          const hasFoods = grouped[key].length > 0;
          const isExpanded = isMealActive(key);

          return (
            <div key={key} className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div
                className="flex items-center justify-between p-4 cursor-pointer"
                onClick={() => !hasFoods && toggleMeal(key)}
              >
                <h3 className="text-sm font-semibold text-gray-900">
                  {icon} {label}
                  {hasFoods && (
                    <span className="text-xs font-normal text-gray-400 ml-1.5">
                      ({grouped[key].reduce((n, e) => n + e.foods.length, 0)})
                    </span>
                  )}
                </h3>
                <button
                  onClick={(e) => { e.stopPropagation(); setAddingMeal(addingMeal === key ? null : key); }}
                  className="text-xs text-primary font-medium px-2 py-1 rounded-lg active:bg-primary-light"
                >
                  + Add
                </button>
              </div>

              {/* Logged foods — always show if has foods */}
              {hasFoods && (
                <div className="flex flex-col gap-1.5 px-4 pb-3">
                  {grouped[key].map((entry) =>
                    entry.foods.map((food, fi) => (
                      <div key={`${entry.id}-${fi}`} className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            food.rating === 'green' ? 'bg-fodmap-green'
                            : food.rating === 'amber' ? 'bg-fodmap-amber'
                            : 'bg-fodmap-red'
                          }`} />
                          <span className="text-sm text-gray-700 capitalize">{food.name}</span>
                          {food.portion && (
                            <span className="text-xs text-gray-400">({food.portion})</span>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveFood(entry.id, fi, food.name)}
                          className="text-gray-300 active:text-fodmap-red p-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Empty state — only if expanded */}
              {!hasFoods && isExpanded && (
                <p className="text-xs text-gray-300 px-4 pb-3">No foods logged</p>
              )}

              {/* Add food form */}
              {addingMeal === key && (
                <div className="px-4 pb-4">
                  <AddFoodForm
                    onAdd={(food) => {
                      addEntry(selectedDate, key, [food]);
                      setAddingMeal(null);
                    }}
                    onCancel={() => setAddingMeal(null)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Symptom tracker */}
      <SymptomTracker date={selectedDate} user={user} />

      {/* Undo toast — Fix #11 */}
      {undoAction && (
        <UndoToast
          message={undoAction.message}
          onUndo={() => { undoAction.restore(); setUndoAction(null); }}
          onDismiss={() => setUndoAction(null)}
        />
      )}
    </div>
  );
}
