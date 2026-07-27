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

export const parseGroceryScreenshot: VisionParser = async (imageBase64, mimeType, apiKey) => {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
            { text: PROMPT },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
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
