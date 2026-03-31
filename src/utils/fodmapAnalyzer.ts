import type { FodmapFood, FodmapDatabase, FodmapRating } from '../types';
import database from '../data/fodmap-database.json';

const db = database as FodmapDatabase;

export function searchFoods(query: string): FodmapFood[] {
  if (!query || query.length < 2) return [];

  const q = query.toLowerCase().trim();

  return db.foods.filter(
    (food) =>
      food.name.toLowerCase().includes(q) ||
      food.nameNL.toLowerCase().includes(q) ||
      food.nameFR.toLowerCase().includes(q) ||
      food.category.toLowerCase().includes(q)
  );
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

export function analyzeIngredients(ingredientText: string): {
  rating: FodmapRating;
  flags: IngredientFlag[];
} {
  const text = normalize(ingredientText);
  const flags: IngredientFlag[] = [];
  const seen = new Set<string>();

  // Pre-process: replace commas inside parentheses with a placeholder
  // so "glutenvrij meel (rijst, maïs)" stays as one segment
  const preprocessed = text.replace(/\([^)]*\)/g, match => match.replace(/,/g, '\u00B7'));

  // Split by comma (but not decimal commas like "1,8%") or semicolon
  const segments = preprocessed.split(/,(?!\d)|;/).map(s => s.trim().replace(/\u00B7/g, ','));

  for (const item of db.highFodmapIngredients) {
    const pattern = normalize(item.ingredient);
    if (!text.includes(pattern)) continue;

    // Find which segment contains this ingredient
    const segment = segments.find(s => s.includes(pattern));
    if (!segment) continue;

    // Check if this segment negates the FODMAP type (e.g. "lactosevrije magere kwark")
    if (segmentIsNegated(segment, item.fodmapType)) continue;

    // Verify word boundary (prevent "lait" matching in "laitue")
    const idx = segment.indexOf(pattern);
    const before = idx > 0 ? segment[idx - 1] : ' ';
    const wordBoundary = /[\s,;:()\/\-.*]|^$/;
    if (!wordBoundary.test(before)) continue;

    // Skip duplicate ingredient names (language variants)
    if (seen.has(item.ingredient.toLowerCase())) continue;
    seen.add(item.ingredient.toLowerCase());

    flags.push({
      ingredient: item.ingredient,
      matched: pattern,
      fodmapType: item.fodmapType,
      commonIn: item.commonIn,
      alternatives: alternativesMap[pattern] || alternativesMap[normalize(item.ingredient)] || [],
    });
  }

  // Deduplicate flags by FODMAP type — keep most specific match per type
  const byType = new Map<string, IngredientFlag>();
  for (const flag of flags) {
    const existing = byType.get(flag.fodmapType);
    if (!existing || flag.matched.length > existing.matched.length) {
      byType.set(flag.fodmapType, flag);
    }
  }
  const dedupedFlags = [...byType.values()];

  if (dedupedFlags.length === 0) return { rating: 'green', flags: [] };
  if (dedupedFlags.length <= 2) return { rating: 'amber', flags: dedupedFlags };
  return { rating: 'red', flags: dedupedFlags };
}

export function getFoodByName(name: string): FodmapFood | undefined {
  const q = name.toLowerCase().trim();
  return db.foods.find(
    (f) =>
      f.name.toLowerCase() === q ||
      f.nameNL.toLowerCase() === q ||
      f.nameFR.toLowerCase() === q
  );
}

export function getAllCategories(): string[] {
  return [...new Set(db.foods.map((f) => f.category))].sort();
}

export function getFoodsByCategory(category: string): FodmapFood[] {
  return db.foods.filter((f) => f.category === category);
}
