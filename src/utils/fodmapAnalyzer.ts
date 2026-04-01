import type { FodmapFood, FodmapDatabase, FodmapRating } from '../types';

// Lazy-load the 108KB FODMAP database on first use instead of bundling it
// in the main chunk. Once loaded, it stays cached in memory.
let _db: FodmapDatabase | null = null;
let _dbPromise: Promise<FodmapDatabase> | null = null;

// Fix #9: LRU cache for searchFoods — 50-entry Map keyed on query string
const _searchCache = new Map<string, FodmapFood[]>();
const SEARCH_CACHE_MAX = 50;

// Fix #13: pre-allocated Set/Map reused across analyzeIngredients calls
const _seenIngredients = new Set<string>();
const _byTypeMap = new Map<string, IngredientFlag>();

function loadDb(): Promise<FodmapDatabase> {
  if (_db) return Promise.resolve(_db);
  if (!_dbPromise) {
    _dbPromise = import('../data/fodmap-database.json').then((m) => {
      _db = (m.default ?? m) as FodmapDatabase;
      return _db;
    });
  }
  return _dbPromise;
}

// Synchronous accessor — returns null before first load completes.
// All UI code should call ensureDb() on mount, then use getDb() in hot paths.
function getDb(): FodmapDatabase | null {
  return _db;
}

/** Call once (e.g. on app init or first keystroke) to warm the cache. */
export function ensureDb(): Promise<FodmapDatabase> {
  return loadDb();
}

/** Release the in-memory DB and clear all caches. Useful if memory pressure requires it. */
export function releaseDb(): void {
  _db = null;
  _dbPromise = null;
  _searchCache.clear();
}

export function searchFoods(query: string): FodmapFood[] | null {
  const db = getDb();
  if (!db) return null;
  if (!query || query.length < 2) return [];

  const q = query.toLowerCase().trim();

  const cached = _searchCache.get(q);
  if (cached) {
    // Refresh position so this entry is last-evicted (true LRU)
    _searchCache.delete(q);
    _searchCache.set(q, cached);
    return cached;
  }

  const results = db.foods.filter(
    (food) =>
      food.name.toLowerCase().includes(q) ||
      food.nameNL.toLowerCase().includes(q) ||
      food.nameFR.toLowerCase().includes(q) ||
      food.category.toLowerCase().includes(q)
  );

  if (_searchCache.size >= SEARCH_CACHE_MAX) {
    _searchCache.delete(_searchCache.keys().next().value!);
  }
  _searchCache.set(q, results);
  return results;
}

export interface IngredientFlag {
  ingredient: string;
  matched: string;
  fodmapType: string;
  commonIn: string;
  alternatives: string[];
}

// Maps flagged ingredient types to practical low-FODMAP alternatives
const alternativesMap: Record<string, string[]> = {
  onion: ['green part of spring onion', 'chives', 'asafoetida'],
  'onion powder': ['asafoetida', 'chives', 'green part of spring onion'],
  'dried onion': ['asafoetida', 'chives'],
  'onion extract': ['asafoetida', 'chives'],
  garlic: ['garlic-infused oil', 'chives', 'asafoetida'],
  'garlic powder': ['garlic-infused oil', 'asafoetida'],
  'dried garlic': ['garlic-infused oil', 'asafoetida'],
  'garlic extract': ['garlic-infused oil'],
  knoflook: ['knoflookolie (infused)', 'bieslook'],
  knoflookpoeder: ['knoflookolie (infused)'],
  ail: ['huile infusée à l\'ail', 'ciboulette'],
  'poudre d\'ail': ['huile infusée à l\'ail'],
  ui: ['groen deel van lente-ui', 'bieslook'],
  uien: ['groen deel van lente-ui', 'bieslook'],
  uipoeder: ['bieslook', 'asafoetida'],
  oignon: ['partie verte de l\'oignon vert', 'ciboulette'],
  oignons: ['partie verte de l\'oignon vert', 'ciboulette'],
  'poudre d\'oignon': ['ciboulette', 'asafoetida'],
  wheat: ['gluten-free flour blend', 'rice flour', 'buckwheat flour', 'sourdough spelt bread'],
  'wheat flour': ['rice flour', 'gluten-free flour blend', 'buckwheat flour', 'cornstarch'],
  rye: ['sourdough spelt bread', 'gluten-free bread'],
  'rye flour': ['rice flour', 'gluten-free flour blend'],
  tarwe: ['rijstmeel', 'glutenvrij meel', 'boekweitmeel'],
  tarwebloem: ['rijstmeel', 'glutenvrij meel'],
  tarwemeel: ['rijstmeel', 'glutenvrij meel'],
  blé: ['farine de riz', 'farine sans gluten'],
  'farine de blé': ['farine de riz', 'farine sans gluten'],
  rogge: ['zuurdesem speltbrood', 'glutenvrij brood'],
  seigle: ['pain d\'épeautre au levain', 'pain sans gluten'],
  gerst: ['rijst', 'quinoa', 'boekweit'],
  orge: ['riz', 'quinoa', 'sarrasin'],
  barley: ['rice', 'quinoa', 'buckwheat'],
  lactose: ['lactose-free milk/yogurt', 'hard aged cheeses', 'almond milk'],
  'milk powder': ['lactose-free milk powder', 'almond milk powder'],
  'skim milk powder': ['lactose-free milk powder'],
  whey: ['whey protein isolate', 'rice protein'],
  'whey powder': ['whey protein isolate'],
  'whey permeate': ['lactose-free alternatives'],
  buttermilk: ['lactose-free buttermilk'],
  cream: ['lactose-free cream', 'coconut cream'],
  milk: ['lactose-free milk', 'almond milk', 'oat milk (small serve)'],
  'whole milk': ['lactose-free milk', 'almond milk'],
  'skim milk': ['lactose-free milk', 'almond milk'],
  lait: ['lait sans lactose', 'lait d\'amande'],
  'lait écrémé': ['lait sans lactose'],
  'lait entier': ['lait sans lactose'],
  'lait demi-écrémé': ['lait sans lactose'],
  melk: ['lactosevrije melk', 'amandelmelk'],
  'volle melk': ['lactosevrije melk'],
  'magere melk': ['lactosevrije melk'],
  'halfvolle melk': ['lactosevrije melk'],
  karnemelk: ['lactosevrije karnemelk'],
  room: ['lactosevrije room', 'kokosroom'],
  slagroom: ['lactosevrije slagroom'],
  crème: ['crème sans lactose', 'crème de coco'],
  'crème fraîche': ['crème fraîche sans lactose'],
  beurre: ['beurre clarifié (ghee)'],
  boter: ['ghee', 'lactosevrije boter'],
  kwark: ['lactosevrije kwark'],
  'fromage blanc': ['fromage blanc sans lactose'],
  yoghurt: ['lactosevrije yoghurt'],
  yaourt: ['yaourt sans lactose'],
  melkpoeder: ['lactosevrij melkpoeder'],
  'poudre de lait': ['poudre de lait sans lactose'],
  wei: ['wei-isolaat'],
  honey: ['maple syrup', 'table sugar'],
  honing: ['ahornsiroop', 'tafelsuiker'],
  miel: ['sirop d\'érable', 'sucre de table'],
  agave: ['maple syrup', 'table sugar'],
  'agave syrup': ['maple syrup', 'table sugar'],
  agavesiroop: ['ahornsiroop', 'tafelsuiker'],
  'sirop d\'agave': ['sirop d\'érable', 'sucre de table'],
  fructose: ['table sugar (sucrose)', 'maple syrup', 'stevia'],
  'high fructose corn syrup': ['table sugar', 'maple syrup'],
  'glucose-fructose syrup': ['glucose syrup', 'table sugar'],
  'fructose-glucose syrup': ['glucose syrup', 'table sugar'],
  sorbitol: ['table sugar', 'maple syrup', 'stevia'],
  mannitol: ['table sugar', 'maple syrup', 'stevia'],
  xylitol: ['table sugar', 'stevia'],
  maltitol: ['table sugar', 'stevia'],
  isomalt: ['table sugar', 'stevia'],
  inulin: ['products without added fiber'],
  polydextrose: ['products without added fiber'],
  lactitol: ['table sugar', 'stevia'],
  E420: ['table sugar', 'stevia'],
  E421: ['table sugar', 'stevia'],
  E953: ['table sugar', 'stevia'],
  E965: ['table sugar', 'stevia'],
  E966: ['table sugar', 'stevia'],
  E967: ['table sugar', 'stevia'],
  E968: ['generally well tolerated'],
  lactosérum: ['whey protein isolate', 'rice protein'],
  'petit-lait': ['whey protein isolate'],
  caséine: ['plant-based protein'],
  caseïne: ['plantaardig eiwit'],
  'natuurlijk aroma': ['check label — may be FODMAP-safe'],
  'arôme naturel': ['vérifier l\'étiquette'],
  'chicory root': ['products without chicory/inulin'],
  'chicory root fiber': ['products without chicory/inulin'],
  cashew: ['macadamia nuts', 'walnuts', 'peanuts'],
  'apple juice concentrate': ['maple syrup', 'table sugar'],
  'pear juice concentrate': ['maple syrup', 'table sugar'],
  'fruit juice concentrate': ['table sugar', 'maple syrup'],
  FOS: ['products without added prebiotics'],
  'fructo-oligosaccharides': ['products without added prebiotics'],
  GOS: ['products without added prebiotics'],
  'galacto-oligosaccharides': ['products without added prebiotics'],
};

// Strip accents: é→e, ë→e, ü→u, etc.
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Check if a text segment contains a "free from" negation for a given FODMAP type
function segmentIsNegated(segment: string, fodmapType: string): boolean {
  const freePatterns = ['vrij', 'vrije', 'free', 'frei', 'sans', 'zonder'];

  // Direct negation: "lactosevrije", "gluten-free", "sans lactose", etc.
  const hasFreeSuffix = freePatterns.some(fp => segment.includes(fp));
  if (!hasFreeSuffix) return false;

  // Check if the "free" pattern relates to this FODMAP type
  // e.g. "lactosevrije" negates lactose items; "glutenvrij" negates fructans (wheat)
  const negationMap: Record<string, string[]> = {
    lactose: ['lactose', 'melk', 'milk', 'lait', 'zuivel', 'dairy'],
    fructans: ['gluten', 'tarwe', 'wheat', 'ble'],
    polyols: ['suiker', 'sugar', 'sucre'],
  };

  const relevantTerms = negationMap[fodmapType] || [];
  // If ANY relevant term + free pattern combo exists in this segment, it's negated
  for (const term of relevantTerms) {
    for (const fp of freePatterns) {
      if (segment.includes(term + fp) || segment.includes(term + '-' + fp) ||
          segment.includes(fp + ' ' + term) || segment.includes('zonder ' + term) ||
          segment.includes('sans ' + term) || segment.includes('no ' + term) ||
          segment.includes('0% ' + term)) {
        return true;
      }
    }
  }
  return false;
}

// Split a normalized ingredient text into individual segments, preserving
// parenthetical content like "(rijst, maïs)" as a single token.
function parseIngredientSegments(normalizedText: string): string[] {
  const preprocessed = normalizedText.replace(/\([^)]*\)/g, m => m.replace(/,/g, '\u00B7'));
  return preprocessed.split(/,(?!\d)|;/).map(s => s.trim().replace(/\u00B7/g, ','));
}

// Deduplicate flags by FODMAP type — keep the most specific (longest) match per type.
// Uses the pre-allocated _byTypeMap to avoid allocating a new Map per call.
function deduplicateByType(rawFlags: IngredientFlag[]): IngredientFlag[] {
  _byTypeMap.clear();
  for (const flag of rawFlags) {
    const existing = _byTypeMap.get(flag.fodmapType);
    if (!existing || flag.matched.length > existing.matched.length) {
      _byTypeMap.set(flag.fodmapType, flag);
    }
  }
  return [..._byTypeMap.values()];
}

export function analyzeIngredients(ingredientText: string): {
  rating: FodmapRating;
  flags: IngredientFlag[];
} {
  const text = normalize(ingredientText);
  // Fix #13: reuse pre-allocated Set — clear rather than reallocate
  _seenIngredients.clear();

  const segments = parseIngredientSegments(text);
  const db = getDb();
  if (!db) return { rating: 'green' as const, flags: [] };

  const rawFlags: IngredientFlag[] = [];
  const wordBoundary = /[\s,;:()/\-.*]|^$/;

  for (const item of db.highFodmapIngredients) {
    const pattern = normalize(item.ingredient);
    if (!text.includes(pattern)) continue;

    // Find which segment contains this ingredient
    const segment = segments.find(s => s.includes(pattern));
    if (!segment) continue;

    // Check if this segment negates the FODMAP type (e.g. "lactosevrije magere kwark")
    if (segmentIsNegated(segment, item.fodmapType)) continue;

    // Verify word boundaries on both sides (prevent "lait" matching in "laitue")
    const idx = segment.indexOf(pattern);
    const before = idx > 0 ? segment[idx - 1] : ' ';
    const afterIdx = idx + pattern.length;
    const after = afterIdx < segment.length ? segment[afterIdx] : ' ';
    if (!wordBoundary.test(before) || !wordBoundary.test(after)) continue;

    // Skip duplicate ingredient names (language variants)
    if (_seenIngredients.has(item.ingredient.toLowerCase())) continue;
    _seenIngredients.add(item.ingredient.toLowerCase());

    rawFlags.push({
      ingredient: item.ingredient,
      matched: pattern,
      fodmapType: item.fodmapType,
      commonIn: item.commonIn,
      alternatives: alternativesMap[pattern] || alternativesMap[normalize(item.ingredient)] || [],
    });
  }

  const flags = deduplicateByType(rawFlags);

  if (flags.length === 0) return { rating: 'green', flags: [] };
  if (flags.length <= 2) return { rating: 'amber', flags };
  return { rating: 'red', flags };
}

export function getFoodByName(name: string): FodmapFood | undefined {
  const db = getDb();
  if (!db) return undefined;
  const q = name.toLowerCase().trim();
  return db.foods.find(
    (f) =>
      f.name.toLowerCase() === q ||
      f.nameNL.toLowerCase() === q ||
      f.nameFR.toLowerCase() === q
  );
}

export function getAllCategories(): string[] {
  const db = getDb();
  if (!db) return [];
  return [...new Set(db.foods.map((f) => f.category))].sort();
}

export function getFoodsByCategory(category: string): FodmapFood[] {
  const db = getDb();
  if (!db) return [];
  return db.foods.filter((f) => f.category === category);
}
