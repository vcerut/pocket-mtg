# Pocket MTG

A personal, local-first Magic: The Gathering deck-building companion. Search
cards, build a deck per format, and check its mana curve, color balance, and
draw odds — all in the browser, no account or backend required.

## Features

- **Card search** — powered by the [Scryfall API](https://scryfall.com/docs/api), with a filter sidebar (color, color mode include/exact, type, mana value, format legality) and sortable results (name, mana value, rarity, color, release date).
- **One deck per format** — Standard, Pioneer, Modern, Legacy, Vintage, Commander, Pauper, and Pauper Commander each get their own deck slot, switchable from the nav.
- **Deck editing** — add cards from Search, adjust quantities, and (for Commander/Pauper Commander) designate a commander. Legality issues (banned cards, singleton overages, color-identity mismatches) show as inline warnings rather than blocking anything.
- **Import / export** — paste or upload a decklist (`.txt`, with an optional `Commander` / `Deck` section split, or `.json` for a lossless round trip). Overwriting a non-empty deck asks for confirmation first.
- **Analysis** — mana curve, color distribution, type breakdown, land/spell ratio, and a hypergeometric draw-probability calculator (a specific card or "any land", by turn, on the play or the draw).

## Persistence

Everything lives in the browser's `localStorage` as a convenience autosave —
there's no login and nothing is sent to a server except card lookups against
Scryfall. Export a deck (`.txt` or `.json`) for a durable, shareable copy.

## Tech stack

React + TypeScript + Vite, Tailwind CSS, React Router, Zustand (with the
`persist` middleware), and Recharts for the analysis charts.

## Running locally

```bash
npm install
npm run dev
```

Other scripts: `npm run build` (production build), `npm run lint` (oxlint),
`npm run preview` (serve the production build locally).
