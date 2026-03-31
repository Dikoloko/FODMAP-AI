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
  wheat: ['gluten-free flour blend', 'rice flour', 'buckwheat flour', 'sourdough spelt bread'],
  'wheat flour': ['rice flour', 'gluten-free flour blend', 'buckwheat flour', 'cornstarch'],
  rye: ['sourdough spelt bread', 'gluten-free bread'],
  'rye flour': ['rice flour', 'gluten-free flour blend'],
  barley: ['rice', 'quinoa', 'buckwheat'],
  lactose: ['lactose-free milk/yogurt', 'hard aged cheeses', 'almond milk'],
  'milk powder': ['lactose-free milk powder', 'almond milk powder'],
  'skim milk powder': ['lactose-free milk powder'],
  whey: ['whey protein isolate', 'rice protein'],
  'whey powder': ['whey protein isolate'],
  'whey permeate': ['lactose-free alternatives'],
  buttermilk: ['lactose-free buttermilk'],
  cream: ['lactose-free cream', 'coconut cream'],
  honey: ['maple syrup', 'table sugar'],
  agave: ['maple syrup', 'table sugar'],
  'agave syrup': ['maple syrup', 'table sugar'],
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

export function analyzeIngredients(ingredientText: string): {
  rating: FodmapRating;
  flags: IngredientFlag[];
} {
  const text = ingredientText.toLowerCase();
  const flags: IngredientFlag[] = [];

  for (const item of db.highFodmapIngredients) {
    const pattern = item.ingredient.toLowerCase();
    if (text.includes(pattern)) {
      flags.push({
        ingredient: item.ingredient,
        matched: pattern,
        fodmapType: item.fodmapType,
        commonIn: item.commonIn,
        alternatives: alternativesMap[pattern] || [],
      });
    }
  }

  if (flags.length === 0) return { rating: 'green', flags: [] };
  if (flags.length <= 2) return { rating: 'amber', flags };
  return { rating: 'red', flags };
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
