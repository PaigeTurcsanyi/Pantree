import type { PantryUnit } from '@/db/pantry';

/**
 * One line item extracted from a grocery-order screenshot.
 * size_value/size_unit describe ONE package as printed (e.g. 280 g);
 * count is how many packages were ordered.
 */
export type ParsedOrderItem = {
  name: string;
  brand: string | null;
  size_value: number | null;
  size_unit: 'g' | 'kg' | 'ml' | 'l' | 'each' | null;
  count: number;
};

/** A parsed item normalized to pantry units, ready for the review screen. */
export type ReviewItem = {
  name: string;
  brand: string | null;
  quantity: number;
  unit: PantryUnit;
};

/**
 * Adapter interface for the vision model. Gemini ships in v1;
 * a Claude or OpenAI adapter only needs to implement this signature.
 */
export type VisionParser = (
  imageBase64: string,
  mimeType: string,
  apiKey: string
) => Promise<ParsedOrderItem[]>;

/** Total quantity in base units: package size × packages ordered. */
export function toReviewItem(item: ParsedOrderItem): ReviewItem {
  const count = item.count > 0 ? item.count : 1;
  const size = item.size_value && item.size_value > 0 ? item.size_value : null;

  let quantity: number;
  let unit: PantryUnit;
  switch (item.size_unit) {
    case 'g':
      quantity = (size ?? 1) * count;
      unit = 'g';
      break;
    case 'kg':
      quantity = (size ?? 1) * 1000 * count;
      unit = 'g';
      break;
    case 'ml':
      quantity = (size ?? 1) * count;
      unit = 'ml';
      break;
    case 'l':
      quantity = (size ?? 1) * 1000 * count;
      unit = 'ml';
      break;
    case 'each':
      quantity = (size ?? 1) * count;
      unit = 'each';
      break;
    default:
      quantity = count;
      unit = 'each';
  }
  return {
    name: item.name.trim(),
    brand: item.brand?.trim() || null,
    quantity: Math.round(quantity * 100) / 100,
    unit,
  };
}
