/**
 * Rhythm Navigator CLI
 *
 * Supports both enumerative (generate-and-test) and stochastic sampling
 * approaches for polyphonic rhythm generation, as well as XOR circular
 * convolution operations.
 *
 * Usage:
 *   npx rhythm-navigator enumerate --mode hex --numerator 4 --denominator 1
 *   npx rhythm-navigator sample --mode hex --numerator 4 --denominator 1 --max-results 50
 *   npx rhythm-navigator convolve --mode hex --carrier "F0" --impulse "80" --denominator 2
 *   npx rhythm-navigator mcp   (starts MCP server on stdio)
 */

import { enumerateRhythms, sampleRhythms, buildAllPulsations, convolveRhythms } from './engine.js'
import type { Mode } from './engine.js'
import type { PredicateGroup, PredicateId } from './engine.js'
import { ALL_PREDICATE_IDS } from './engine.js'
import { startMcpServer } from './mcp.js'

function parsePredicates(raw: string | undefined): PredicateGroup | null {
  if (!raw) return null
  // Accept comma-separated predicate IDs and join as AND group
  const ids = raw.split(',').map(s => s.trim()).filter(Boolean) as PredicateId[]
  if (ids.length === 0) return null
  for (const id of ids) {
    if (!ALL_PREDICATE_IDS.includes(id)) {
      console.error(`Unknown predicate: ${id}`)
      console.error(`Available predicates: ${ALL_PREDICATE_IDS.join(', ')}`)
      process.exit(1)
    }
  }
  return {
    type: 'and',
    children: ids.map(id => ({ type: 'predicate' as const, id }))
  }
}

function parseMode(raw: string | undefined): Mode {
  if (raw === 'binary' || raw === 'octal' || raw === 'hex') return raw
  if (!raw) return 'hex'
  console.error(`Invalid mode: ${raw}. Must be binary, octal, or hex.`)
  process.exit(1)
}

function printUsage() {
  console.log(`
Rhythm Navigator CLI

COMMANDS:
  enumerate   Exhaustive generate-and-test rhythm enumeration
  sample      Fast stochastic sampling of rhythms
  convolve    XOR circular convolution of two rhythms with optional scaling
  pulsations  Generate rhythms from pulsation specifications
  mcp         Start MCP (Model Context Protocol) server on stdio

COMMON OPTIONS:
  --mode <binary|octal|hex>       Digit encoding mode (default: hex)
  --numerator <n>                 Time signature numerator / beats (default: 4)
  --denominator <n>               Digits per beat (default: 1)
  --predicates <id1,id2,...>      Comma-separated predicate filters (AND)
  --retention <0-100>             Retention probability percentage (default: 100)
  --max-results <n>               Maximum results to return (default: 0 = no limit for enumerate, 50 for sample)
  --pretty                        Pretty-print JSON output
  --help                          Show this help

ENUMERATE OPTIONS:
  (all common options apply)

SAMPLE OPTIONS:
  --max-attempts <n>              Maximum random trials (default: 1000000)

CONVOLVE OPTIONS:
  --carrier <rhythm>              Carrier rhythm (grouped digit string, e.g., "F0 3C")
  --impulse <rhythm>              Impulse rhythm (grouped digit string, e.g., "80 00")
  --carrier-scale <n>             Scale carrier by repeating N times (default: 1)
  --impulse-scale <n>             Scale impulse by repeating N times (default: 1)

PULSATIONS OPTIONS:
  --composition <ints>            Space-separated positive integers (segment lengths)
  --head-tails <H/T tokens>       Space-separated H or T per segment (cycles if shorter)
  --durations <ints>              Space-separated pulse spacings (cycles if shorter)
  --multiples <ints>              Space-separated pulse counts per segment (cycles if shorter)
  Comma-separate any field for multiple alternatives (cartesian product).

AVAILABLE PREDICATES:
  ${ALL_PREDICATE_IDS.join(', ')}

EXAMPLES:
  rhythm-navigator enumerate --mode hex --numerator 4 --denominator 1 --max-results 10
  rhythm-navigator sample --mode binary --numerator 8 --denominator 1 --predicates maximallyEven
  rhythm-navigator convolve --mode hex --carrier "F0" --impulse "80" --denominator 2
  rhythm-navigator convolve --mode binary --carrier "1010" --impulse "1000" --carrier-scale 2 --denominator 4
  rhythm-navigator pulsations --mode hex --numerator 4 --denominator 1 --composition "4 4 4 4" --head-tails "H" --durations "1" --multiples "2"
  rhythm-navigator mcp
`)
}

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = args[i + 1]
      if (next && !next.startsWith('--')) {
        result[key] = next
        i++
      } else {
        result[key] = 'true'
      }
    }
  }
  return result
}

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  if (!command || command === '--help' || command === '-h') {
    printUsage()
    process.exit(0)
  }

  if (command === 'mcp') {
    await startMcpServer()
    return
  }

  const opts = parseArgs(args.slice(1))

  if (opts['help']) {
    printUsage()
    process.exit(0)
  }

  const mode = parseMode(opts['mode'])
  const numerator = parseInt(opts['numerator'] || '4', 10)
  const denominator = parseInt(opts['denominator'] || '1', 10)
  const predicateExpression = parsePredicates(opts['predicates'])
  const retention = parseInt(opts['retention'] || '100', 10)
  const retentionProbability = Math.max(0, Math.min(1, retention / 100))
  const pretty = opts['pretty'] === 'true'

  if (command === 'enumerate') {
    const maxResults = parseInt(opts['max-results'] || '0', 10)
    const result = enumerateRhythms({
      mode,
      numerator,
      denominator,
      maxReps: maxResults,
      predicateExpression,
      retentionProbability
    })

    const output = {
      method: 'enumerate',
      params: { mode, numerator, denominator, predicates: opts['predicates'] || null, retention },
      processed: result.processed,
      emitted: result.emitted,
      items: result.items
    }
    console.log(pretty ? JSON.stringify(output, null, 2) : JSON.stringify(output))
  } else if (command === 'sample') {
    const maxResults = parseInt(opts['max-results'] || '50', 10)
    const maxAttempts = parseInt(opts['max-attempts'] || '1000000', 10)

    const result = sampleRhythms({
      mode,
      numerator,
      denominator,
      maxResults,
      maxAttempts,
      predicateExpression,
      retentionProbability
    })

    const output = {
      method: 'sample',
      params: { mode, numerator, denominator, predicates: opts['predicates'] || null, retention, maxAttempts },
      attempts: result.attempts,
      emitted: result.emitted,
      items: result.items
    }
    console.log(pretty ? JSON.stringify(output, null, 2) : JSON.stringify(output))
  } else if (command === 'convolve') {
    const carrier = opts['carrier']
    const impulse = opts['impulse']
    const carrierScale = parseInt(opts['carrier-scale'] || '1', 10)
    const impulseScale = parseInt(opts['impulse-scale'] || '1', 10)

    if (!carrier) {
      console.error('--carrier is required for convolve')
      process.exit(1)
    }
    if (!impulse) {
      console.error('--impulse is required for convolve')
      process.exit(1)
    }

    try {
      const result = convolveRhythms({
        carrier,
        impulse,
        mode,
        carrierScale,
        impulseScale,
        denominator
      })

      const output = {
        method: 'convolve',
        params: { mode, denominator, carrier, impulse, carrierScale, impulseScale },
        result: result.result,
        carrierLength: result.carrierLength,
        impulseLength: result.impulseLength,
        resultLength: result.resultLength,
        onsets: result.onsets
      }
      console.log(pretty ? JSON.stringify(output, null, 2) : JSON.stringify(output))
    } catch (error) {
      console.error('Convolution error:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  } else if (command === 'pulsations') {
    const composition = opts['composition'] || ''
    const headTails = opts['head-tails'] || 'H'
    const durations = opts['durations'] || '1'
    const multiples = opts['multiples'] || '1'

    if (!composition) {
      console.error('--composition is required for pulsations')
      process.exit(1)
    }

    const { items, errors } = buildAllPulsations(
      { composition, headTails, durations, multiples },
      mode,
      numerator,
      denominator
    )

    const output = {
      method: 'pulsations',
      params: { mode, numerator, denominator, composition, headTails, durations, multiples },
      emitted: items.length,
      errors,
      items
    }
    console.log(pretty ? JSON.stringify(output, null, 2) : JSON.stringify(output))
  } else {
    console.error(`Unknown command: ${command}`)
    printUsage()
    process.exit(1)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
