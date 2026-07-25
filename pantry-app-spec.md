# Pantree — App Specification

> A hand-off spec for building a mobile pantry & recipe app. Give this file to
> Claude Code (drop it in an empty project folder and say "read spec.md and
> let's start building"). It describes **what** to build and **why**, not every
> line of code — build it in the phases at the bottom, one at a time, checking in
> after each.

---

## 1. The idea in one paragraph

I'm moving into my first apartment in September while in school, and buying
groceries for myself for the first time. I want an app on my iPad/phone where I
can **paste in screenshots of my online grocery orders** and have it
automatically build a **digital pantry** — every product, brand, quantity, and
picture. I can also **add recipes** (typed in or screenshotted). When I tell the
app I made a recipe, it **deducts the exact gram/unit amounts** from my pantry.
I can search **"what can I actually make right now?"**, see **substitutes** for
things I'm missing, and if I'm slightly short on an ingredient the app should
**scale the recipe down** so the ratios still work.

## 2. Who it's for

Primarily me (a broke, busy student cooking for one). Built cleanly enough that
I *might* publish it for other people later — so no hard-coded personal data, and
keep the door open for user accounts down the line, but **do not build accounts,
login, or multi-user support in v1.** Local-first, single user.

## 3. Platform & tech stack

- **Mobile app**, primary target **iPad** (also works on iPhone). Must run on iOS.
- **React Native via Expo.** Expo is the right call: it lets me test on my
  iPad/phone instantly by scanning a QR code with **Expo Go** — no Xcode, no
  Apple Developer account needed to start. Use **expo-router** for navigation.
- **Language:** TypeScript.
- **Local database:** on-device, offline-first. Use **expo-sqlite** (SQLite).
  All my pantry and recipe data lives on the device. No backend server in v1.
- **State/data layer:** keep it simple — a lightweight store (Zustand or React
  context) plus direct SQLite queries. Don't over-engineer.
- **Image handling:** `expo-image-picker` to pick screenshots from the photo
  library; `expo-image` for display.

Keep dependencies minimal and well-maintained. Explain any library you add.

## 4. The two hard/magic features (read carefully)

These are the parts that make this app worth building. Get the plumbing right.

### 4a. Screenshot → pantry (the killer feature)

When I paste/upload a screenshot of a grocery order, the app must extract a
structured list of items: **product name, brand, size/quantity (e.g. 280 g,
1 L, 12-pack), and count ordered.**

- **Do NOT try to do this with a product API or regex.** The right tool is a
  **vision-capable LLM** with a prompt that returns **structured JSON** matching
  my pantry schema. This handles messy, varied grocery-order layouts far better
  than OCR.
- **Default model: Google Gemini (a Flash model), using my free-tier API key.**
  The Gemini free tier accepts image input, needs no credit card, and allows far
  more requests/day than this app will ever use. Build the model call behind a
  small adapter/interface so it's a one-line change to swap in Claude or OpenAI
  later — but ship v1 wired to Gemini.
- The API key should live in an **environment variable / config file that is
  git-ignored** — never hard-coded. Build a tiny settings screen where I can
  paste my own Gemini key so this works if I publish it later.
- *(Note for later: the Gemini free tier may use submitted data to improve
  Google's models; switching to a paid key removes that. Fine for personal use,
  worth revisiting before publishing.)*
- After extraction, show me an **editable review screen** before anything is
  saved: a list of parsed items I can correct, merge, or delete. **I confirm,
  then it's added to the pantry.** Never silently trust the parse.
- **Then** enrich each confirmed item against **Open Food Facts** (see §6) to
  pull a product photo and canonical package size where possible. If no match,
  the item still saves with the parsed data — enrichment is a bonus, not a
  blocker.

### 4b. Recipe → pantry deduction, substitution & scaling

- A recipe has ingredients with **normalized amounts and units** (grams, ml,
  units/each). When I tap **"I made this,"** deduct each ingredient's amount from
  the matching pantry item. Example: pantry has 280 g flour, recipe uses 10 g →
  pantry becomes 270 g. Handle unit conversion (kg↔g, L↔ml) so a recipe in grams
  can deduct from a pantry item stored in kg.
- **"What can I make?"** — given current pantry quantities, list recipes I have
  **enough** ingredients for. Also surface **"almost" recipes** (missing 1–2
  things or slightly short).
- **Substitutions** — maintain a built-in table of common baking/cooking
  substitutes (e.g. butter↔oil, buttermilk↔milk+lemon, 1 egg↔flax egg). If I'm
  missing an ingredient that has a known substitute I *do* have, flag it.
- **Auto-scaling** — if I have, say, only 220 g of a flour the recipe wants 280 g
  of (and it's the limiting ingredient), offer to **scale the whole recipe down**
  to the largest batch my pantry supports, recalculating every ingredient so the
  ratios stay correct. Show me the scaled amounts before I commit.

## 5. Screens (v1)

1. **Pantry** — searchable/filterable list of items with photo, name, brand,
   remaining quantity. Tap to edit; swipe to delete. Manual "add item" button.
2. **Import** — pick a screenshot → parse → editable review → confirm into pantry.
3. **Recipes** — list of my recipes. Add via typed form **or** screenshot-import
   (same vision-LLM approach as 4a, returning recipe JSON). Tap a recipe to view.
4. **Recipe detail** — ingredients, steps, a "Can I make this?" status (have
   enough / short / substitutes available), **scale** control, and the **"I made
   this"** button that deducts from pantry.
5. **What can I make?** — filtered view of makeable + almost-makeable recipes.
6. **Settings** — paste my Gemini API key; basic app info.

## 6. Data / APIs

- **Product data & images: [Open Food Facts](https://world.openfoodfacts.org/data).**
  Free, open, no paid tier, no approval needed. Has barcodes, brands, product
  photos, and package quantities. This is the primary product database. Use its
  read API to enrich items by name/barcode.
- **Screenshot & recipe parsing:** a **vision LLM** (user-supplied key), as in §4a.
- **FatSecret** was considered but **skipped for v1** — its free tier needs
  approval and carries commercial-use restrictions that complicate publishing.
  Open Food Facts covers our needs.
- Barcode scanning (`expo-barcode-scanner` → Open Food Facts lookup) is a
  **nice-to-have for later**, not v1.

## 7. Data model (starting point — refine as you build)

- **PantryItem**: id, name, brand, photo_url, quantity (number), unit (g/ml/each),
  category, barcode?, off_id?, updated_at.
- **Recipe**: id, title, source (typed/screenshot), servings, steps (ordered), notes.
- **RecipeIngredient**: id, recipe_id, name, amount (number), unit, pantry_item_id?
  (linked when matched).
- **Substitution**: ingredient, substitute, ratio, notes. (Seed with a starter list.)

Store all amounts in a **normalized base unit** (grams for mass, ml for volume,
each for count) so math is consistent; display in friendly units.

## 8. Build in phases — one at a time, check in after each

1. **Scaffold** — Expo + TypeScript + expo-router app that runs in Expo Go on my
   iPad, SQLite wired up, empty Pantry screen.
2. **Manual pantry CRUD** — add/edit/delete/search items by hand. No AI yet.
3. **Open Food Facts enrichment** — look up a product, pull photo + size.
4. **Screenshot → pantry** — vision-LLM parse + editable review screen (§4a).
5. **Recipes** — typed recipe CRUD + recipe detail screen.
6. **Deduction** — "I made this" subtracts from pantry with unit conversion.
7. **What can I make? + substitutions.**
8. **Auto-scaling** for short ingredients.
9. **(Later)** recipe screenshot import, barcode scanning, polish, publish prep.

**Stop and let me test on my iPad at the end of each phase.** Don't build phases
4–8 before phase 1–3 actually work.

## 9. Open decisions to raise with me as they come up

- Vision model: **default to Gemini** (free-tier key I'll provide); keep it
  swappable behind an adapter.
- How aggressively to auto-match parsed items to existing pantry items vs. always
  asking me.
- Units: I mostly think in grams/ml — confirm before adding imperial conversions.

---

*Written as a starting point, not gospel. If something here is impractical or
there's a simpler path, tell me before building it.*
