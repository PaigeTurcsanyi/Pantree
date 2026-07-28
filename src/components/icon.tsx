import { SymbolView, type SFSymbol } from 'expo-symbols';

/**
 * Icons are named by their Material Symbols name (what the design spec uses)
 * and mapped to the nearest SF Symbol for native.
 */
const SF: Record<string, SFSymbol> = {
  eco: 'leaf',
  search: 'magnifyingglass',
  add: 'plus',
  photo_camera: 'camera',
  add_a_photo: 'camera.fill',
  menu_book: 'book',
  settings: 'gearshape',
  bakery_dining: 'birthday.cake',
  egg: 'oval.portrait',
  water_drop: 'drop',
  grocery: 'basket',
  rice_bowl: 'takeoutbag.and.cup.and.straw',
  nutrition: 'carrot',
  breakfast_dining: 'takeoutbag.and.cup.and.straw',
  icecream: 'snowflake',
  ramen_dining: 'takeoutbag.and.cup.and.straw',
  restaurant: 'fork.knife',
  set_meal: 'fish',
  schedule: 'clock',
  oven_gen: 'oven',
  favorite: 'heart',
  favorite_filled: 'heart.fill',
  chevron_right: 'chevron.right',
  arrow_back: 'chevron.left',
  restaurant_menu: 'fork.knife',
  circle: 'circle',
};

export type IconName = keyof typeof SF | string;

export function Icon({
  name,
  size = 20,
  color,
}: {
  name: IconName;
  size?: number;
  color: string;
}) {
  return (
    <SymbolView
      name={{ ios: SF[name] ?? 'circle', web: name as never }}
      tintColor={color}
      size={size}
      resizeMode="scaleAspectFit"
    />
  );
}

/** Picks a food glyph for an item, used when there's no product photo. */
export function foodIconFor(name: string, category?: string | null): string {
  const haystack = `${name} ${category ?? ''}`.toLowerCase();
  const match = (...words: string[]) => words.some((w) => haystack.includes(w));

  if (match('flour', 'bread', 'bake', 'pastry', 'cracker', 'biscuit', 'galette', 'pie'))
    return 'bakery_dining';
  if (match('egg')) return 'egg';
  if (match('oil', 'vinegar', 'sauce', 'juice', 'water', 'milk', 'cream', 'broth', 'stock'))
    return 'water_drop';
  if (match('rice', 'pasta', 'noodle', 'grain', 'quinoa')) return 'rice_bowl';
  if (match('berry', 'berries', 'fruit', 'apple', 'banana', 'mango', 'lemon', 'lime', 'orange'))
    return 'nutrition';
  if (match('cucumber', 'tomato', 'onion', 'garlic', 'pepper', 'veg', 'salad', 'produce'))
    return 'nutrition';
  if (match('ice', 'frozen', 'yogurt')) return 'icecream';
  if (match('soup', 'ramen', 'curry', 'stew')) return 'ramen_dining';
  if (match('fish', 'salmon', 'chicken', 'beef', 'meat')) return 'set_meal';
  if (match('cereal', 'breakfast', 'oat')) return 'breakfast_dining';
  return 'grocery';
}
