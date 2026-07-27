/**
 * Loose food-name matching, shared by recipe/pantry lookups and by import
 * de-duplication. Deliberately ignores brand and packaging words — two
 * punnets of raspberries are the same thing whoever grew them.
 */

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function singularize(word: string): string {
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith('es') && word.length > 3) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1);
  return word;
}

export function nameTokens(name: string): string[] {
  return normalizeName(name).split(' ').filter(Boolean).map(singularize);
}

/** Score floor meaning "one name contains the other", not just shared words. */
export const NAME_CONTAINMENT_SCORE = 500;

/**
 * Score how well two food names refer to the same thing.
 * 0 means no match; higher is better.
 */
export function matchScore(a: string, b: string): number {
  const left = nameTokens(a);
  const right = nameTokens(b);
  if (left.length === 0 || right.length === 0) return 0;

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const shared = [...leftSet].filter((token) => rightSet.has(token));
  if (shared.length === 0) return 0;

  const joinedLeft = left.join(' ');
  const joinedRight = right.join(' ');
  if (joinedLeft === joinedRight) return 1000;
  if (joinedRight.includes(joinedLeft) || joinedLeft.includes(joinedRight)) {
    return NAME_CONTAINMENT_SCORE + shared.length;
  }
  // Partial overlap: prefer matches that cover more of the first name.
  return Math.round((shared.length / leftSet.size) * 100) + shared.length;
}
