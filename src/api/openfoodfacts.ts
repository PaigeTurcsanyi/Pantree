import type { PantryUnit } from '@/db/pantry';

/**
 * Open Food Facts search — free, no key needed.
 * Uses the current search service; the older cgi/search.pl endpoint has
 * been unreliable (503s), which silently broke lookups.
 * https://openfoodfacts.github.io/search-a-licious/
 */
const SEARCH_URL = 'https://search.openfoodfacts.org/search';

const FIELDS = [
  'code',
  'product_name',
  'brands',
  'quantity',
  'image_front_small_url',
  'image_front_url',
  'nutriments',
].join(',');

/** Nutrition per 100 g/ml. Any field may be missing — coverage varies by product. */
export type Nutrition = {
  energyKcal?: number;
  protein?: number;
  fat?: number;
  saturatedFat?: number;
  carbs?: number;
  sugars?: number;
  fiber?: number;
  salt?: number;
};

export type OffProduct = {
  code: string;
  name: string;
  brand: string | null;
  /** Raw package size label as printed, e.g. "500 g" */
  sizeLabel: string | null;
  /** Package size normalized to our base units, when parseable */
  packageQuantity: number | null;
  packageUnit: PantryUnit | null;
  imageSmallUrl: string | null;
  imageUrl: string | null;
  /** Null when this product has no nutrition data on record. */
  nutrition: Nutrition | null;
};

/**
 * Looks up a product, preferring the most specific match. Searching
 * "Raspberries Driscoll's" finds the exact package; if the brand is a
 * store label Open Food Facts has never seen, we retry on the plain
 * name so you still get a representative photo.
 */
export async function searchProducts(name: string, brand?: string | null): Promise<OffProduct[]> {
  const plain = name.trim();
  const specific = [plain, brand?.trim()].filter(Boolean).join(' ');

  if (specific && specific !== plain) {
    const withBrand = await runSearch(specific);
    if (withBrand.some((product) => product.imageUrl)) return withBrand;
  }
  return runSearch(plain);
}

async function runSearch(query: string): Promise<OffProduct[]> {
  if (!query) return [];

  const params = new URLSearchParams({
    q: query,
    page_size: '8',
    fields: FIELDS,
  });

  const response = await fetch(`${SEARCH_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`Open Food Facts returned ${response.status}`);
  }

  const data = (await response.json()) as { hits?: OffApiHit[] };
  return (data.hits ?? [])
    .filter((hit) => hit.code && hit.product_name?.trim())
    .map(toOffProduct);
}

type OffApiHit = {
  code?: string;
  product_name?: string;
  /** This endpoint returns brands as an array, unlike the legacy one. */
  brands?: string[] | string;
  quantity?: string;
  image_front_small_url?: string;
  image_front_url?: string;
  nutriments?: Record<string, number | undefined>;
};

function toOffProduct(hit: OffApiHit): OffProduct {
  const size = parseSizeLabel(hit.quantity);
  return {
    code: hit.code!,
    name: hit.product_name!.trim(),
    brand: firstBrand(hit.brands),
    sizeLabel: hit.quantity?.trim() || null,
    packageQuantity: size?.quantity ?? null,
    packageUnit: size?.unit ?? null,
    imageSmallUrl: hit.image_front_small_url || null,
    imageUrl: hit.image_front_url || hit.image_front_small_url || null,
    nutrition: toNutrition(hit.nutriments),
  };
}

function toNutrition(raw: Record<string, number | undefined> | undefined): Nutrition | null {
  if (!raw) return null;

  const nutrition: Nutrition = {
    energyKcal: raw['energy-kcal_100g'],
    protein: raw.proteins_100g,
    fat: raw.fat_100g,
    saturatedFat: raw['saturated-fat_100g'],
    carbs: raw.carbohydrates_100g,
    sugars: raw.sugars_100g,
    fiber: raw.fiber_100g,
    salt: raw.salt_100g,
  };

  // Drop absent values so the UI can tell "no data" from "zero".
  for (const key of Object.keys(nutrition) as (keyof Nutrition)[]) {
    if (typeof nutrition[key] !== 'number' || Number.isNaN(nutrition[key])) delete nutrition[key];
  }
  return Object.keys(nutrition).length > 0 ? nutrition : null;
}

function firstBrand(brands: string[] | string | undefined): string | null {
  if (Array.isArray(brands)) return brands[0]?.trim() || null;
  return brands?.split(',')[0]?.trim() || null;
}

/** Turns a printed size like "250 g", "125g", or "1.5 L" into base units. */
export function parseSizeLabel(
  label: string | undefined
): { quantity: number; unit: PantryUnit } | null {
  if (!label) return null;

  const match = label
    .trim()
    .toLowerCase()
    .replace(',', '.')
    .match(/^([\d.]+)\s*(kg|g|mg|cl|ml|l)\b/);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!amount || Number.isNaN(amount) || amount <= 0) return null;

  switch (match[2]) {
    case 'g':
      return { quantity: amount, unit: 'g' };
    case 'kg':
      return { quantity: amount * 1000, unit: 'g' };
    case 'mg':
      return { quantity: amount / 1000, unit: 'g' };
    case 'ml':
      return { quantity: amount, unit: 'ml' };
    case 'cl':
      return { quantity: amount * 10, unit: 'ml' };
    case 'l':
      return { quantity: amount * 1000, unit: 'ml' };
    default:
      return null;
  }
}
