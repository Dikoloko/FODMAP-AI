import type { FodmapFood } from '../types';
import { searchFoods } from '../utils/fodmapAnalyzer';
import FoodCard from './FoodCard';

interface Props {
  productName: string;
}

// Common product name mappings (FR/NL → search term)
const productKeywords: Record<string, string> = {
  'oeuf': 'egg', 'oeufs': 'egg', 'ei': 'egg', 'eieren': 'egg',
  'lait': 'milk', 'melk': 'milk',
  'beurre': 'butter', 'boter': 'butter',
  'fromage': 'cheese', 'kaas': 'cheese',
  'pain': 'bread', 'brood': 'bread',
  'poulet': 'chicken', 'kip': 'chicken',
  'porc': 'pork', 'varken': 'pork',
  'boeuf': 'beef', 'rund': 'beef',
  'riz': 'rice', 'rijst': 'rice',
  'pomme': 'apple', 'appel': 'apple',
  'banane': 'banana', 'banaan': 'banana',
  'tomate': 'tomato', 'tomaat': 'tomato',
  'carotte': 'carrot', 'wortel': 'carrot',
  'yaourt': 'yogurt', 'yoghurt': 'yogurt',
  'crème': 'cream', 'room': 'cream',
  'saumon': 'salmon', 'zalm': 'salmon',
  'thon': 'tuna', 'tonijn': 'tuna',
  'pâtes': 'pasta', 'pasta': 'pasta',
  'chocolat': 'chocolate', 'chocolade': 'chocolate',
  'miel': 'honey', 'honing': 'honey',
  'oignon': 'onion', 'ui': 'onion',
  'ail': 'garlic', 'knoflook': 'garlic',
  'champignon': 'mushroom', 'paddenstoel': 'mushroom',
  'avocat': 'avocado', 'avocado': 'avocado',
};

const skipWords = new Set([
  'de', 'du', 'des', 'la', 'le', 'les', 'au', 'aux', 'en', 'un', 'une',
  'van', 'het', 'een', 'met', 'voor', 'sur', 'par', 'sol',
  'bio', 'élevées', 'élevés', 'free', 'range', 'poules', 'hens',
]);

function findBestMatches(productName: string): FodmapFood[] {
  const name = productName.toLowerCase();
  const words = name.split(/[\s,\-/()]+/).filter(w => w.length > 1);

  // 1. Try keyword mapping first
  for (const word of words) {
    const mapped = productKeywords[word];
    if (mapped) {
      const results = searchFoods(mapped);
      if (results && results.length > 0) return results;
    }
  }

  // 2. Try each word directly (longest first, skip short/common words)
  const searchableWords = words
    .filter(w => w.length > 2 && !skipWords.has(w))
    .sort((a, b) => b.length - a.length);

  for (const word of searchableWords) {
    const results = searchFoods(word);
    if (results && results.length > 0) return results;
  }

  return [];
}

export default function ProductNameFallback({ productName }: Props) {
  const matches = findBestMatches(productName);
  const unique = [...new Map(matches.map(f => [f.name, f])).values()];

  if (unique.length > 0) {
    return (
      <div>
        <p className="text-xs text-gray-400 mb-2">
          No ingredient list available. Based on the product name, here's what we found:
        </p>
        <div className="flex flex-col gap-2">
          {unique.slice(0, 2).map((food) => (
            <FoodCard key={food.name} food={food} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 rounded-xl">
      <p className="text-sm text-gray-500">
        No ingredient list available for this product. Try taking a photo of the ingredient list instead.
      </p>
    </div>
  );
}
