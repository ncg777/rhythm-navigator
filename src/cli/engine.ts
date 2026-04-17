/**
 * CLI-friendly rhythm generation engine.
 *
 * Re-exports the core enumeration and sampling logic using relative paths
 * so that it can be compiled independently of Vite's @ alias.
 */

export type { Mode, RhythmItem } from '../utils/rhythm'
export { bitsPerDigitForMode } from '../utils/rhythm'
export type { PredicateGroup, PredicateNode, PredicateLeaf, PredicateId } from '../types/predicateExpression'
export { ALL_PREDICATE_IDS, PREDICATE_LABELS, defaultPredicateExpression } from '../types/predicateExpression'
export { evaluatePredicateTree } from '../utils/predicateEval'
export { canonicalContourFromOnsets } from '../utils/contour'
export { sampleRhythms, type SamplerParams, type SamplerResult } from '../utils/stochasticSampler'
export {
  buildPulsationFromStrings,
  buildAllPulsations,
  expandCartesian,
  type PulsationInputSet,
  type PulsationResult
} from '../utils/pulsations'
export {
  convolveRhythms,
  type ConvolutionParams,
  type ConvolutionResult
} from '../utils/convolution'

/**
 * Synchronous exhaustive (enumerative) rhythm generation.
 *
 * This is the CLI counterpart of the web worker's odometer loop.
 * It yields items synchronously rather than posting to a worker.
 */
import type { Mode, RhythmItem } from '../utils/rhythm'
import { bitsPerDigitForMode } from '../utils/rhythm'
import { canonicalContourFromOnsets } from '../utils/contour'
import { evaluatePredicateTree } from '../utils/predicateEval'
import type { PredicateGroup } from '../types/predicateExpression'

export type EnumerateParams = {
  mode: Mode
  numerator: number
  denominator: number
  maxReps: number
  minOnsets?: number
  maxOnsets?: number
  predicateExpression?: PredicateGroup | null
  retentionProbability?: number
}

export type EnumerateResult = {
  items: RhythmItem[]
  processed: number
  emitted: number
}

function makeLookup(bpd: number): number[][] {
  const size = 1 << bpd
  const out: number[][] = new Array(size)
  for (let v = 0; v < size; v++) {
    const indices: number[] = []
    for (let i = 0; i < bpd; i++) {
      if ((v >> (bpd - 1 - i)) & 1) indices.push(i)
    }
    out[v] = indices
  }
  return out
}

function groupDigits(digits: number[], encTable: string[], perGroup: number): string {
  const parts: string[] = []
  let group = ''
  for (let i = 0; i < digits.length; i++) {
    group += encTable[digits[i]]
    if ((i + 1) % perGroup === 0) {
      parts.push(group)
      group = ''
    }
  }
  if (group) parts.push(group)
  return parts.join(' ')
}

export function enumerateRhythms(params: EnumerateParams): EnumerateResult {
  const base = params.mode === 'binary' ? 2 : params.mode === 'octal' ? 8 : 16
  const bpd = bitsPerDigitForMode(params.mode)
  const digitsCount = params.numerator * params.denominator
  const totalBits = digitsCount * bpd

  const lookup = makeLookup(bpd)

  const popcountLookup = new Uint8Array(1 << bpd)
  for (let v = 0; v < (1 << bpd); v++) {
    let c = 0
    for (let t = v; t; t &= t - 1) c++
    popcountLookup[v] = c
  }

  const minOn = typeof params.minOnsets === 'number' ? params.minOnsets : 0
  const maxOn = typeof params.maxOnsets === 'number' ? params.maxOnsets : totalBits
  const keepProb = typeof params.retentionProbability === 'number'
    ? Math.max(0, Math.min(1, params.retentionProbability)) : 1
  const doRetention = keepProb < 1

  const predExpr = params.predicateExpression ?? null
  const hasPredicates = !!(predExpr && predExpr.children && predExpr.children.length > 0)
  const canonicalOpts = { circular: true, rotationInvariant: true, reflectionInvariant: true }

  const encTable = new Array<string>(base)
  for (let i = 0; i < base; i++) {
    encTable[i] = params.mode === 'hex' ? i.toString(16).toUpperCase() : String(i)
  }

  const onsetsBuf = new Int32Array(totalBits)
  const digits = new Array<number>(digitsCount).fill(0)

  const targetCount = params.maxReps <= 0 ? Number.POSITIVE_INFINITY : Math.max(1, params.maxReps)

  let emitted = 0
  let processed = 0
  const items: RhythmItem[] = []
  let done = false

  while (!done && emitted < targetCount) {
    let onsetsCount = 0
    for (let j = 0; j < digitsCount; j++) onsetsCount += popcountLookup[digits[j]]

    if (onsetsCount > 0 && onsetsCount < totalBits && onsetsCount >= minOn && onsetsCount <= maxOn) {
      let oi = 0
      for (let j = 0; j < digitsCount; j++) {
        const v = digits[j]
        if (v) {
          const indices = lookup[v]
          const offset = j * bpd
          for (let k = 0; k < indices.length; k++) {
            onsetsBuf[oi++] = offset + indices[k]
          }
        }
      }
      const onsets = Array.from(onsetsBuf.subarray(0, oi))

      const passes = !hasPredicates || evaluatePredicateTree(predExpr, onsets, totalBits, canonicalOpts)

      if (passes) {
        if (doRetention && Math.random() > keepProb) {
          // skip
        } else {
          const groupedDigitsString = groupDigits(digits, encTable, params.denominator)
          items.push({
            id: `${params.mode}:${groupedDigitsString}:${emitted}`,
            base: params.mode,
            groupedDigitsString,
            onsets: onsetsCount,
            canonicalContour: canonicalContourFromOnsets(onsets, totalBits, canonicalOpts),
            numerator: params.numerator,
            denominator: params.denominator
          })
          emitted++
        }
      }
    }

    processed++

    // Increment odometer
    let carry = 1
    for (let i = digitsCount - 1; i >= 0 && carry; i--) {
      const next = digits[i] + carry
      if (next >= base) {
        digits[i] = 0
        carry = 1
      } else {
        digits[i] = next
        carry = 0
      }
    }
    if (carry) done = true
  }

  return { items, processed, emitted }
}
