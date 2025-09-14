# Rhythm Navigator

Live demo: https://ncg777.github.io/rhythm-navigator/

A fast PWA for exploring binary/octal/hex rhythms as grouped digits, with contour analysis, music-theory predicates, and powerful filtering. Built with Vue 3 + TypeScript + Vite + Pinia + Tailwind.

## Highlights

- Generate rhythms by mode and length with a web worker (no freezing UI)
- Shadow-contour isomorphism filter (canonical vs. shadow canonical contour)
- Music-theory predicates and oddities:
	- Maximally even (Euclidean)
	- ROP {2,3}, Odd-interval oddity, No antipodal pairs
	- Low entropy (IOI-distribution entropy below a bound)
	- No gaps (interval-vector nonzero bins are contiguous)
	- Relatively flat (interval-vector counts near their mean)
	- Ordinal(n) blocks (every reversed n-block is one of factor-based words)
- Agglutinate: concatenate random segments while preserving shadow-iso at each prefix
- Virtualized list + search; detailed view with contours and syncopation metrics

## Getting started

Prerequisites: Node.js 18+ recommended.

Install dependencies (first time):

```bat
npm install
```

Run in dev mode (opens in browser):

```bat
npm run dev
```

Build for production:

```bat
npm run build
```

Preview the production build:

```bat
npm run preview
```

Type-check and tests:

```bat
npm run typecheck
npm run test
```

## How rhythms are represented

- Mode determines bits per digit: binary=1, octal=3, hex=4 (MSB-first per digit)
- Total digits = Numerator × Denominator; total bits = digits × bitsPerDigit
- Onsets are bit indices where the expanded bitstring has 1s

Contours use canonicalization with user-selectable invariances:

- Circular vs linear
- Rotation invariant
- Reflection invariant

Shadow-contour isomorphism compares the canonical contour to the shadow canonical contour under the same options.

## UI guide

Settings (top panel):

- Mode, Numerator (beats), Denominator (digits/beat)
- Max representatives (0 = unlimited), Onsets min/max
- Invariances: Circular, Rotation invariant, Reflection invariant
- Exclude trivial (all 0 / all 1)
- Filters:
	- Only shadow-contour isomorphic
	- Only maximally even (Euclidean)
	- Oddity: Off | ROP (2/3) | Odd-interval oddity | No antipodal pairs
	- Only low-entropy
	- Only no-gap interval vector
	- Only relatively flat
	- Ordinal blocks (n) + Enable
- Agglutinate segments + Agglutinate button
- Clear button resets generated results

All rhythms (left):

- Search by grouped digits, base string, or contour
- Virtualized list for large result sets; click a row to select

Rhythm details (right):

- Grouped digits, base, total bits, onsets, rests, density
- Canonical and shadow canonical contours; shadow-iso Yes/No
- Syncopation metrics (binary-halved hierarchical weights)
- Music theory properties grid, including the new predicates

## Predicate definitions (brief)

- Low entropy: Shannon entropy of circular IOIs (distribution over interval values) is less than ln(reverseTriangularNumber(L)·0.5)
- No gaps: Non-zero indices of the IOI histogram are a single consecutive range
- Relatively flat: After removing zeros from IOI histogram counts, every count is within ±50% of mean (mean = triangularNumber(k)/n)
- Ordinal(n): Let L be a multiple of n. Reverse the bitstring; split into L/n blocks of size n. Every block must be a "word" generated from the factors of n (periodic placements at step f and their reversed counterparts), plus the empty word

Oddity options match standard literature (Toussaint and related work): ROP {2,3}, odd-interval oddity, and no antipodal pairs.

## Internals

- Worker: `src/workers/generate.ts` enumerates digit odometer-style, expands onsets via a per-digit lookup, applies filters, and posts batches to the main thread
- Data model: `RhythmItem` is slim to reduce memory and messaging
- Utilities: contours (`src/utils/contour.ts`), predicates (`src/utils/predicates.ts`), syncopation (`src/utils/syncopation.ts`), relations (`src/utils/relations.ts`)

## Troubleshooting

- No results? Loosen filters (disable shadow-iso / predicates), widen Onsets min/max, or increase Max representatives
- Slow generation? Reduce Max representatives; disable expensive filters; narrow the search space by reducing digits
