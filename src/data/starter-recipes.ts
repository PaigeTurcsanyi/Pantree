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

/**
 * The bundled picture for a recipe, looked up by title.
 *
 * Bundled images are module references, not URLs, so they can't live in the
 * `photo_url` column — resolving one to a URI would store a dev-server path
 * that breaks in a real build. Copying a starter recipe into your book
 * therefore leaves `photo_url` empty, and the art is matched back on here at
 * render time. Your own photos still take priority.
 */
export function starterImageFor(title: string): ImageSourcePropType | undefined {
  const key = title.trim().toLowerCase();
  return STARTER_RECIPES.find((recipe) => recipe.title.toLowerCase() === key)?.image;
}

export const STARTER_RECIPES: StarterRecipe[] = [
  {
    title: 'Yummy fried rice',
    servings: 4,
    image: require('@/../assets/images/recipes/fried-rice.jpg'),
    ingredients: [
      { name: 'Jasmine rice', amount: 400, unit: 'g' },
      { name: 'Eggs', amount: 4, unit: 'each' },
      { name: 'Frozen corn and peas', amount: 115, unit: 'g' },
      { name: 'Carrot', amount: 55, unit: 'g' },
      { name: 'Green onion', amount: 30, unit: 'g' },
      { name: 'Oil', amount: 45, unit: 'ml' },
      { name: 'Light soy sauce', amount: 15, unit: 'ml' },
      { name: 'Dark soy sauce', amount: 5, unit: 'ml' },
      { name: 'Salt', amount: 6, unit: 'g' },
      { name: 'Sugar', amount: 2, unit: 'g' },
      { name: 'Chicken bouillon powder', amount: 3, unit: 'g' },
    ],
    steps: [
      'Rinse the rice. Put it in a bowl, cover with cold water, swirl it with your hand, and pour the cloudy water away. Do that three times. This washes off loose starch, which is what makes rice turn gluey.',
      'Cook the rice with about 400 ml of water, however you normally do — rice cooker or a pot with a tight lid. When it is done, leave the lid on for 2 more minutes.',
      'While the rice cooks, prep everything else. Slice the green tops off the green onions and chop them small (keep the white parts in the fridge for another day). Cut the carrot into thin strips, then chop the strips into small cubes. Tip the carrot and the frozen corn and peas into a bowl together.',
      'Add a splash of water to that bowl of vegetables, about 70 ml, and microwave for 2 minutes to soften them. Drain off the water and set the bowl aside.',
      'Crack the eggs into a separate bowl, add half the salt, and beat them with a fork.',
      'Fluff the cooked rice with chopsticks or a fork for a minute or two. Steam escaping now means the grains stay separate instead of clumping in the pan.',
      'Get a wok or your widest frying pan hot, then turn the heat down to low and add 30 ml of the oil, swirling to coat the surface. Pour in the eggs and stir gently for 20 to 30 seconds until just set.',
      'Tip the rice straight onto the eggs. Turn the heat up and stir-fry for about 2 minutes, breaking up clumps with the edge of your spatula. Scoop from the bottom and around the sides rather than digging in the middle — that is what keeps it from sticking together.',
      'Add the drained vegetables and stir-fry on high for another 2 to 3 minutes.',
      'Turn the heat low. Stir the light soy sauce, dark soy sauce, remaining salt, sugar and chicken bouillon together in a small bowl, then pour it over the rice. Turn the heat back to high and stir-fry for 2 to 3 minutes so every grain picks up colour.',
      'Add the last 15 ml of oil and the chopped green onions, stir-fry for one more minute, then turn off the heat. Taste it — it may want another splash of soy sauce.',
      'Serve it straight onto plates, or pack it into a bowl and turn the bowl upside down on the plate for a neat dome. Scatter a few more green onions on top.',
    ],
    notes:
      'Cold rice from yesterday works even better than fresh. Nothing here is fussy about exact amounts — taste as you go.',
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
