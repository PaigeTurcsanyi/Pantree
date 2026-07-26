import type { ReviewItem } from '@/api/vision';

/**
 * Hand-off buffer between the Import screen (which parses a screenshot)
 * and the Review screen (which edits + confirms). Module-level state is
 * enough here — it's one short-lived list, not app state.
 */
let draft: ReviewItem[] = [];

export function setImportDraft(items: ReviewItem[]) {
  draft = items;
}

export function takeImportDraft(): ReviewItem[] {
  const items = draft;
  draft = [];
  return items;
}
