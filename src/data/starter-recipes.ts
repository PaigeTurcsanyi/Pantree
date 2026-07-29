import type { ImageSourcePropType } from 'react-native';

import type { PantryUnit } from '@/db/pantry';

/**
 * Recipes bundled with the app so a fresh pantry has somewhere to start.
 * Amounts are already in base units (g / ml / each) so they match against
 * the pantry the same way an imported recipe does.
 *
 * To add one: append an entry below. To give it a picture, drop the file in
 * `assets/images/recipes/` and set `image: require('...')` — bundled images
 * ship with the app and work offline. Without one, the recipe falls back to
 * the same food glyph the rest of the app uses.
 */
export type StarterRecipe = {
  title: string;
  servings: number | null;
  ingredients: { name: string; amount: number; unit: PantryUnit }[];
  steps: string[];
  notes?: string;
  image?: ImageSourcePropType;
};

export const STARTER_RECIPES: StarterRecipe[] = [
  {
    title: 'Weeknight fried rice',
    servings: 2,
    ingredients: [
      { name: 'Rice', amount: 300, unit: 'g' },
      { name: 'Eggs', amount: 2, unit: 'each' },
      { name: 'Oil', amount: 15, unit: 'ml' },
      { name: 'Soy sauce', amount: 30, unit: 'ml' },
      { name: 'Frozen peas', amount: 100, unit: 'g' },
    ],
    steps: [
      'Heat the oil in a wide pan over high heat.',
      'Scramble the eggs quickly, then push them to one side.',
      'Add the cold cooked rice and peas, spreading it out so it fries rather than steams.',
      'Splash in the soy sauce, toss everything together and serve.',
    ],
    notes: 'Day-old rice works far better than fresh — it stays separate instead of clumping.',
  },
  {
    title: 'Pantry tomato pasta',
    servings: 2,
    ingredients: [
      { name: 'Pasta', amount: 200, unit: 'g' },
      { name: 'Tinned tomatoes', amount: 400, unit: 'g' },
      { name: 'Garlic', amount: 2, unit: 'each' },
      { name: 'Olive oil', amount: 30, unit: 'ml' },
    ],
    steps: [
      'Boil the pasta in well-salted water.',
      'Meanwhile, soften the sliced garlic in the oil over low heat — do not let it brown.',
      'Add the tomatoes, crush them, and simmer while the pasta cooks.',
      'Drain the pasta, keeping a splash of the water, and toss it through the sauce.',
    ],
    notes: 'A spoonful of the pasta water loosens the sauce and helps it cling.',
  },
  {
    title: 'Everyday pancakes',
    servings: 2,
    ingredients: [
      { name: 'Flour', amount: 150, unit: 'g' },
      { name: 'Milk', amount: 300, unit: 'ml' },
      { name: 'Eggs', amount: 2, unit: 'each' },
      { name: 'Butter', amount: 25, unit: 'g' },
      { name: 'Sugar', amount: 15, unit: 'g' },
    ],
    steps: [
      'Whisk the flour, sugar, eggs and milk into a smooth batter and rest it for 10 minutes.',
      'Melt a little butter in a hot pan.',
      'Cook each pancake until bubbles form on top, then flip.',
    ],
  },
];
