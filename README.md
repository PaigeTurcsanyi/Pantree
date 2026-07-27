# Pantree

A local-first pantry & recipe app for iPad/iPhone. Paste screenshots of grocery
orders to build a digital pantry, add recipes, and track what you can cook.
Full product spec: [pantry-app-spec.md](./pantry-app-spec.md).
Coming soon to the app store

## Stack

- Expo (SDK 57) + React Native + TypeScript
- expo-router for navigation (native tabs)
- expo-sqlite for on-device storage — no backend
- Gemini (vision) for screenshot parsing — key lives in `.env` (git-ignored)

## Run it

```bash
npm install
npx expo start
```

Then scan the QR code with **Expo Go** on your iPad/iPhone (same Wi-Fi network).

Copy `.env.example` to `.env` and add your Gemini API key (needed from Phase 4
onward).

## Build status

Building in phases per the spec (§8):

- [x] Phase 1 — scaffold, SQLite wired up, tab skeleton, empty Pantry screen
- [x] Phase 2 — manual pantry CRUD
- [x] Phase 3 — Open Food Facts enrichment
- [x] Phase 4 — screenshot → pantry (Gemini vision + review screen)
- [x] Phase 5 — recipes CRUD
- [x] Phase 6 — "I made this" deduction
- [x] Phase 7 — what can I make? + substitutions
- [x] Phase 8 — auto-scaling

Phase 9 (later, per spec): recipe screenshot import, barcode scanning,
swipe-to-delete, polish, publish prep.

## Layout

- `src/app/` — screens (expo-router file-based routing)
- `src/db/` — SQLite schema + migrations
- `src/components/` — shared UI
- `src/constants/theme.ts` — colors, fonts, spacing
