# Rhythm Navigator

Live demo (GitHub Pages): https://ncg777.github.io/rhythm-navigator/

Rhythm Navigator is a fast PWA for exploring and sequencing binary/octal/hex rhythms represented as grouped digits. It combines an expressive rhythm generator (with contour analysis and music-theory predicates) with a lightweight multi-track drum sequencer that supports WAV/MIDI export and external MIDI output.

Built with Vue 3, TypeScript, Vite, Pinia, Tailwind, and Tone.js.

## What you can do

- Generate large sets of rhythms in the browser using a Web Worker (the UI stays responsive)
- Filter by shadow-contour isomorphism and several music-theory predicates
- Agglutinate: concatenate compatible segments while maintaining constraints
- Browse a virtualized library and quickly search by grouped digits, base string, or contour
- Analyze any rhythm: contours, density, syncopation metrics, and predicates at a glance
- Sequence rhythms across multiple drum tracks (kick/snare/hat/perc) with per-track controls
- Export audio (WAV), export MIDI, and save/load full projects (JSON)
- Send live MIDI clocked notes to an external device/DAW (Web MIDI where supported)
- Install as a PWA and use it offline

## Key features

Generator and library
- Modes: binary (1 bit/digit), octal (3 bits/digit), hex (4 bits/digit) — MSB-first per digit
- Length = Numerator × Denominator (digits/beat); total bits = digits × bitsPerDigit
- Shadow-contour isomorphism filter (canonical vs shadow canonical contour under the same invariances)
- Music-theory predicates and oddities:
	- Maximally even (Euclidean)
	- ROP {2,3}, Odd-interval oddity, No antipodal pairs
	- Low entropy (bounded IOI-entropy)
	- No gaps (contiguous non-zero interval-vector bins)
	- Relatively flat (counts near the mean)
	- Ordinal(n) blocks
- Agglutination engine to build longer strings from compatible parts
- Virtualized results list with fast search and sorting

Rhythm analysis
- Canonical and shadow canonical contours with selectable invariances:
	- Circular vs linear
	- Rotation invariant
	- Reflection invariant
- Syncopation metrics based on hierarchical metrical weights
- Relations browser (subsets/supersets/overlaps) within the current library

Sequencer
- Multi-track drum layout with track types: kick, snare, hat, perc
- Rhythm Picker modal to assign any generated rhythm to a chosen track
- Per-track controls: name, type, volume, pan, default velocity, velocity randomization
- Per-instrument parameters (distortion pre-gain, filter type/frequency/Q/rolloff, and more)
- Per-track pattern meter editing (numerator/denominator) with digits-per-beat mapping
- Transport: Play/Stop, BPM, loop bars
- Export WAV, Export MIDI, Export/Import project JSON
- MIDI out: enable/disable, select device, choose channel, rescan devices

PWA and performance
- Installable PWA with offline caching
- Web Workers for generation/agglutination avoid blocking the UI
- Virtualized lists and compact data model (`RhythmItem`) for memory efficiency

## How to use it

1) Generate rhythms
- Open the settings (gear icon). Choose Mode, Numerator, Denominator and optional constraints (onsets min/max, shadow-iso, predicates). Click Generate.

2) Browse and analyze
- Open the Generated Rhythms modal to search, sort, and select a rhythm. Use the details pane to inspect contours, syncopation, and relations.

3) Sequence
- In the sequencer, click a track’s picker button to open the Rhythm Picker and assign a rhythm. Adjust track parameters, BPM, and loop bars; hit Play.

4) Export or integrate
- Export WAV/MIDI from the transport bar. Export a project to JSON, or import a saved JSON to restore everything (BPM, loop bars, tracks, patterns, params).

## Getting started (development)

Prerequisites: Node.js 18+ recommended.

Install dependencies:

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

Type-check and run tests:

```bat
npm run typecheck
npm run test
```

## Internals and structure

- UI: Vue 3 + Pinia with Tailwind styling
- Audio/MIDI: Tone.js for synthesis/playback; optional Web MIDI output
- Data model: `RhythmItem` (compact; stores grouped digits, base, onsets, contours, optional meter)
- Workers:
	- `src/workers/generate.ts` enumerates digits odometer-style and filters batches
	- `src/workers/agglutinate.ts` builds concatenations subject to the same constraints
- Utilities:
	- Contours: `src/utils/contour.ts`
	- Predicates: `src/utils/predicates.ts`
	- Syncopation: `src/utils/syncopation.ts`
	- Relations (subsets/supersets/overlaps): `src/utils/relations.ts`
- Sequencer: `src/stores/sequencerStore.ts` (tracks, synth graph, transport, export)

## Troubleshooting

- No results? Loosen filters (disable shadow-iso/predicates), widen Onsets min/max, increase Max representatives, or reduce total digits.
- Audio doesn’t start? Many browsers require user interaction before audio can play. Click the page or press Play once to unlock audio.
- MIDI not listed? Ensure your browser supports Web MIDI (Chrome/Edge), then enable MIDI in the transport and rescan devices.
- Slow generation? Disable expensive predicates, or narrow the search space (smaller numerator/denominator).
