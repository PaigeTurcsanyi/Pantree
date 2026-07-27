import type { ParsedOrderItem, VisionParser } from '@/api/vision';

// Rolling alias: always the current Flash model, so retired model ids don't break us.
const MODEL = 'gemini-flash-latest';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const PROMPT = `This image is a screenshot of an online grocery order (cart, order confirmation, or receipt).

Extract every distinct product as a JSON array. For each product:
- name: what you would call this food in your own kitchen, with the brand stripped out. "Driscoll's Raspberries" is just "Raspberries"; "No Name All-Purpose Flour" is "All-purpose flour"; "Longo's Essentials Beef Broth" is "Beef broth". The exception is a product whose brand IS its everyday name — "Cheez-It", "Nutella", "Oreos", "Goldfish", "Pop-Tarts". Keep those as the name and never translate them into a description like "cheese crackers".
- brand: null almost every time. Producers and supermarket labels alike (Driscoll's, Heinz, Kellogg's, No Name, Compliments, Great Value, President's Choice, Kirkland) all go in the bin — the pantry cares what the food is, not who made it. Only fill this in when the name alone would be genuinely ambiguous about what was bought.
- size_value and size_unit: the size of ONE package as printed (e.g. "280 g" -> 280 and "g"; "1.5 L" -> 1.5 and "l"; "12 pack" -> 12 and "each"). Use null for both if no size is shown.
- count: how many of that package were ordered (default 1)

Ignore prices, taxes, fees, delivery lines, substitution notes, and out-of-stock items.`;

const RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      name: { type: 'STRING' },
      brand: { type: 'STRING', nullable: true },
      size_value: { type: 'NUMBER', nullable: true },
      size_unit: { type: 'STRING', enum: ['g', 'kg', 'ml', 'l', 'each'], nullable: true },
      count: { type: 'INTEGER' },
    },
    required: ['name', 'count'],
  },
};

const RECIPE_PROMPT = `This image is a recipe — a screenshot, a photo of a cookbook page, or a handwritten card.

Return one JSON object describing it:
- title: the recipe's name
- servings: how many it serves, as a number, or null if not stated
- ingredients: each ingredient with name, amount and unit. Convert everything to grams, millilitres, or whole units so it can be subtracted from a pantry: 1 cup flour is roughly 120 g, 1 cup liquid is 240 ml, 1 tbsp is 15 ml, 1 tsp is 5 ml, 1 stick of butter is 113 g. Count eggs and whole items with unit "each". Strip brands from ingredient names.
- steps: the method as an ordered list of strings, one instruction per entry. Drop step numbers from the text itself.

If a quantity is vague ("a pinch", "to taste"), use a small sensible amount rather than null.`;

const RECIPE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    servings: { type: 'NUMBER', nullable: true },
    ingredients: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          amount: { type: 'NUMBER' },
          unit: { type: 'STRING', enum: ['g', 'ml', 'each'] },
        },
        required: ['name', 'amount', 'unit'],
      },
    },
    steps: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['title', 'ingredients', 'steps'],
};

export type ParsedRecipe = {
  title: string;
  servings: number | null;
  ingredients: { name: string; amount: number; unit: 'g' | 'ml' | 'each' }[];
  steps: string[];
};

export async function parseRecipeScreenshot(
  imageBase64: string,
  mimeType: string,
  apiKey: string
): Promise<ParsedRecipe> {
  const text = await callGemini(imageBase64, mimeType, apiKey, RECIPE_PROMPT, RECIPE_SCHEMA);

  let parsed: ParsedRecipe;
  try {
    parsed = JSON.parse(text) as ParsedRecipe;
  } catch {
    throw new Error('Gemini returned malformed data. Try again.');
  }
  if (!parsed?.title?.trim()) {
    throw new Error('That didn’t look like a recipe. Try a clearer screenshot.');
  }

  return {
    title: parsed.title.trim(),
    servings: typeof parsed.servings === 'number' ? parsed.servings : null,
    ingredients: (parsed.ingredients ?? []).filter(
      (i) => i?.name?.trim() && typeof i.amount === 'number' && i.amount > 0
    ),
    steps: (parsed.steps ?? []).filter((s) => typeof s === 'string' && s.trim()),
  };
}

/** One image + prompt + response schema in, raw JSON text out. */
async function callGemini(
  imageBase64: string,
  mimeType: string,
  apiKey: string,
  prompt: string,
  schema: object
): Promise<string> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [
        { parts: [{ inline_data: { mime_type: mimeType, data: imageBase64 } }, { text: prompt }] },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    }),
  });

  if (!response.ok) {
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      throw new Error('Gemini rejected the API key. Check it in Settings.');
    }
    if (response.status === 429) {
      throw new Error('Gemini rate limit hit. Wait a minute and try again.');
    }
    throw new Error(`Gemini request failed (${response.status}).`);
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini returned no result. Try a clearer screenshot.');
  }
  return text;
}

export const parseGroceryScreenshot: VisionParser = async (imageBase64, mimeType, apiKey) => {
  const text = await callGemini(imageBase64, mimeType, apiKey, PROMPT, RESPONSE_SCHEMA);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Gemini returned malformed data. Try again.');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('Gemini returned an unexpected format. Try again.');
  }

  return (parsed as ParsedOrderItem[]).filter(
    (item) => typeof item.name === 'string' && item.name.trim()
  );
};
