import { Platform } from 'react-native';

import type { PantryUnit } from '@/db/pantry';

/**
 * Open Food Facts read API — free, no key needed.
 * https://world.openfoodfacts.org/data
 */
const SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';

const FIELDS = [
  'code',
  'product_name',
  'brands',
  'quantity',
  'product_quantity',
  'product_quantity_unit',
  'image_front_small_url',
  'image_front_url',
].join(',');

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
};

export async function searchProducts(query: string): Promise<OffProduct[]> {
  const params = new URLSearchParams({
    action: 'process',
    search_terms: query,
    search_simple: '1',
    json: '1',
    page_size: '8',
    fields: FIELDS,
  });

  const response = await fetch(`${SEARCH_URL}?${params}`, {
    headers:
      // Browsers set their own User-Agent; OFF asks native API clients to identify themselves.
      Platform.OS === 'web' ? undefined : { 'User-Agent': 'Pantree/0.1 (personal pantry app)' },
  });
  if (!response.ok) {
    throw new Error(`Open Food Facts returned ${response.status}`);
  }

  const data = (await response.json()) as { products?: OffApiProduct[] };
  return (data.products ?? [])
    .filter((p) => p.code && p.product_name?.trim())
    .map(toOffProduct);
}

type OffApiProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  quantity?: string;
  product_quantity?: string | number;
  product_quantity_unit?: string;
  image_front_small_url?: string;
  image_front_url?: string;
};

function toOffProduct(p: OffApiProduct): OffProduct {
  const normalized = normalizePackageSize(p.product_quantity, p.product_quantity_unit);
  return {
    code: p.code!,
    name: p.product_name!.trim(),
    brand: p.brands?.split(',')[0]?.trim() || null,
    sizeLabel: p.quantity?.trim() || null,
    packageQuantity: normalized?.quantity ?? null,
    packageUnit: normalized?.unit ?? null,
    imageSmallUrl: p.image_front_small_url || null,
    imageUrl: p.image_front_url || p.image_front_small_url || null,
  };
}

function normalizePackageSize(
  rawQuantity: string | number | undefined,
  rawUnit: string | undefined
): { quantity: number; unit: PantryUnit } | null {
  const amount = typeof rawQuantity === 'string' ? Number(rawQuantity) : rawQuantity;
  if (!amount || Number.isNaN(amount) || amount <= 0) return null;

  switch (rawUnit?.toLowerCase()) {
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
