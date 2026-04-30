# Rhythm Navigator

Live demo (GitHub Pages): https://ncg777.github.io/rhythm-navigator/

Rhythm Navigator is a fast PWA for exploring and sequencing binary/octal/hex rhythms represented as grouped digits. It combines an expressive rhythm generator (with contour analysis and music-theory predicates) with a lightweight multi-track drum sequencer that supports WAV/MIDI export and external MIDI output.

Built with Vue 3, TypeScript, Vite, Pinia, Tailwind, and Tone.js.

## What you can do

- Generate large sets of rhythms in the browser using a Web Worker (the UI stays responsive)
- Two generation methods: exhaustive **enumeration** and fast **stochastic sampling**
- Filter by shadow-contour isomorphism and several music-theory predicates
- Agglutinate: concatenate compatible segments while maintaining constraints
- **Matrix generator**: build random R×C rhythm segment matrices whose row-pair unions and column unions all satisfy the predicate expression
- Browse a virtualized library and quickly search by grouped digits, base string, or contour
- Analyze any rhythm: contours, density, syncopation metrics, and predicates at a glance
- Sequence rhythms across multiple drum tracks (kick/snare/hat/perc) with per-track controls
- Export audio (WAV), export MIDI, and save/load full projects (JSON)
- Send live MIDI clocked notes to an external device/DAW (Web MIDI where supported)
- Use the **CLI** to enumerate or sample rhythms from the command line (JSON output)
- Integrate with **VS Code Copilot Chat** (or any MCP host) via the built-in MCP server
- Install as a PWA and use it offline

## Key features

Generator and library
- Modes: binary (1 bit/digit), octal (3 bits/digit), hex (4 bits/digit) — MSB-first per digit
- Length = Numerator × Denominator (digits/beat); total bits = digits × bitsPerDigit
- Two generation methods:
	- **Enumerate** — exhaustive generate-and-test (odometer-style); best for small search spaces where completeness matters
	- **Sample** — stochastic random sampling with predicate filtering and deduplication; much faster for large spaces (e.g. hex mode with many digits)
- Shadow-contour isomorphism filter (canonical vs shadow canonical contour under the same invariances)
- Music-theory predicates and oddities:
	- Maximally even (Euclidean)
	- ROP {2,3}, Odd-interval oddity, No antipodal pairs
	- Low entropy (bounded IOI-entropy)
	- No gaps (contiguous non-zero interval-vector bins)
	- Relatively flat (counts near the mean)
	- Ordinal(n) blocks
- Agglutination engine to build longer strings from compatible parts
- **Rhythm matrix generator** — constructive stochastic R×C matrix sampler:
	- Each cell is a rhythm segment using the current mode/numerator/denominator settings.
	- Predicate expression is enforced on the *union* of each adjacent row pair (cyclically last↔first) and on the full column union.
	- Incremental constructive algorithm with early pruning: fills row by row, left to right, and immediately tests partial constraints at each cell placement.
	- Controls: row count, column count, max matrix attempts, max cell retries.
	- Output displayed as labelled text blocks in a monospace textarea (`# Matrix N` followed by one line per row).
- The retention probability feature allows you to control the likelihood of retaining individual rhythms during the generation and agglutination processes. This parameter, expressed as a percentage (0-100), introduces probabilistic filtering to the rhythm generation pipeline.
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
- Open the settings (gear icon). Choose Mode, Numerator, Denominator and optional constraints (onsets min/max, shadow-iso, predicates). Select the generation **method** (Enumerate for exhaustive search or Sample for stochastic random sampling). Click Generate.

2) Browse and analyze
- Open the Generated Rhythms modal to search, sort, and select a rhythm. Use the details pane to inspect contours, syncopation, and relations.

3) Sequence
- In the sequencer, click a track’s picker button to open the Rhythm Picker and assign a rhythm. Adjust track parameters, BPM, and loop bars; hit Play.

4) Generate a rhythm matrix
- In the settings panel scroll down to **Rhythm Matrix Generator**. Set Rows, Columns, Max attempts, and Max cell retries. The current mode/numerator/denominator and predicate expression are shared with the main generator. Click **Generate matrix**. Accepted matrices appear in the textarea below as labelled text blocks.

5) Export or integrate
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

Build the CLI (outputs to `dist-cli/`):

```bat
npm run build:cli
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

## CLI

Rhythm Navigator includes a command-line interface for generating rhythms outside the browser. Output is JSON.

### Building the CLI

```bash
npm run build:cli
```

This bundles `src/cli/index.ts` into `dist-cli/cli/index.js` using esbuild.

### Commands

**Enumerate** — exhaustive generation:

```bash
npx rhythm-navigator enumerate --mode hex --numerator 4 --denominator 1 --max-results 10
```

**Sample** — stochastic sampling:

```bash
npx rhythm-navigator sample --mode binary --numerator 8 --denominator 1 --predicates maximallyEven --max-results 5
```

**MCP** — start the MCP server (see below):

```bash
npx rhythm-navigator mcp
```

### Options

| Option | Description | Default |
|---|---|---|
| `--mode <binary\|octal\|hex>` | Digit encoding mode | `hex` |
| `--numerator <n>` | Beats (time-signature numerator) | `4` |
| `--denominator <n>` | Digits per beat | `1` |
| `--predicates <id1,id2,...>` | Comma-separated predicate filters (AND) | none |
| `--retention <0-100>` | Retention probability percentage | `100` |
| `--max-results <n>` | Maximum results (0 = no limit for enumerate, 50 for sample) | `0` / `50` |
| `--max-attempts <n>` | *(sample only)* Maximum random trials | `1000000` |
| `--pretty` | Pretty-print JSON output | off |

Available predicate IDs: `isomorphic`, `maximallyEven`, `rop23`, `odd-intervals`, `no-antipodes`, `lowEntropy`, `noGaps`, `relativelyFlat`, `ordinal`.

## MCP Server (VS Code / Copilot Chat integration)

The CLI includes an [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that exposes rhythm generation tools to any MCP-compatible host — including VS Code with GitHub Copilot Chat.

The server communicates over **stdio** (stdin/stdout JSON-RPC), so the host spawns the process and talks to it directly. It is not a standalone HTTP server.

### Setup in VS Code

Add to `.vscode/mcp.json` (or your user-level MCP settings):

```json
{
  "servers": {
    "rhythm-navigator": {
      "command": "node",
      "args": ["dist-cli/cli/index.js", "mcp"]
    }
  }
}
```

After reloading, the three tools below become available to Copilot Chat.

### MCP Tools

| Tool | Description |
|---|---|
| `enumerate_rhythms` | Exhaustive generate-and-test enumeration with predicate filtering. Parameters: `mode`, `numerator`, `denominator`, `maxResults`, `predicates`, `retentionProbability`. |
| `sample_rhythms` | Stochastic random sampling with predicate filtering. Parameters: `mode`, `numerator`, `denominator`, `maxResults`, `maxAttempts`, `predicates`, `retentionProbability`. |
| `list_predicates` | Returns all available predicate IDs and their human-readable labels. |

## Internals and structure

- UI: Vue 3 + Pinia with Tailwind styling
- Audio/MIDI: Tone.js for synthesis/playback; optional Web MIDI output
- Data model: `RhythmItem` (compact; stores grouped digits, base, onsets, contours, optional meter)
- Workers:
	- `src/workers/generate.ts` enumerates digits odometer-style and filters batches
	- `src/workers/stochastic.ts` stochastic random sampling with the same batch/progress/done protocol
	- `src/workers/agglutinate.ts` builds concatenations subject to the same constraints
	- `src/workers/matrix.ts` constructive stochastic matrix generator (row-pair union + column union constraints)
- Utilities:
	- Contours: `src/utils/contour.ts`
	- Predicates: `src/utils/predicates.ts`
	- Syncopation: `src/utils/syncopation.ts`
	- Relations (subsets/supersets/overlaps): `src/utils/relations.ts`
	- Stochastic sampler: `src/utils/stochasticSampler.ts`
	- Matrix sampler: `src/utils/matrixSampler.ts`
- CLI:
	- `src/cli/index.ts` — CLI entry point (arg parsing, JSON output)
	- `src/cli/engine.ts` — shared sync versions of enumerate/sample for Node.js
	- `src/cli/mcp.ts` — MCP server (Model Context Protocol over stdio)
	- `build-cli.mjs` — esbuild script to bundle the CLI
- Sequencer: `src/stores/sequencerStore.ts` (tracks, synth graph, transport, export)

## Troubleshooting

- No results? Loosen filters (disable shadow-iso/predicates), widen Onsets min/max, increase Max representatives, or reduce total digits.
- Audio doesn’t start? Many browsers require user interaction before audio can play. Click the page or press Play once to unlock audio.
- MIDI not listed? Ensure your browser supports Web MIDI (Chrome/Edge), then enable MIDI in the transport and rescan devices.
- Slow generation? Disable expensive predicates, or narrow the search space (smaller numerator/denominator). Switch to the Sample method for large search spaces.
- Sampling finds few results? Increase max attempts, loosen predicate filters, or increase the retention percentage.


