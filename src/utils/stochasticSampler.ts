/**
 * Stochastic rhythm sampler — generates rhythms by random digit sampling
 * with predicate filtering.
 *
 * Instead of the exhaustive odometer enumeration, this module:
 * 1. Randomly generates digit arrays within the configured base
 * 2. Tests each candidate against the predicate expression tree
 * 3. Deduplicates via a Set of grouped-digit strings
 * 4. Emits accepted rhythms in batches
 *
 * This is dramatically faster than exhaustive search for large spaces
 * (e.g. hex mode with many digits) where the valid-rhythm density is
 * sufficiently high, and it discovers diverse results quickly.
 */

import type { Mode, RhythmItem } from '@/utils/rhythm'
import { bitsPerDigitForMode } from '@/utils/rhythm'
import { canonicalContourFromOnsets } from '@/utils/contour'
import { evaluatePredicateTree } from '@/utils/predicateEval'
import type { PredicateGroup } from '@/types/predicateExpression'

export type SamplerParams = {
  mode: Mode
  numerator: number
  denominator: number
  maxResults: number          // 0 = unlimited
  maxAttempts: number         // total random trials before stopping
  minOnsets?: number
  maxOnsets?: number
  predicateExpression?: PredicateGroup | null
  retentionProbability?: number // 0..1
}

export type SamplerResult = {
  items: RhythmItem[]
  attempts: number
  emitted: number
}

/** Precompute per-digit onset index lookup (MSB-first). */
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

/** Precompute popcount for all digit values. */
function makePopcountLookup(bpd: number): Uint8Array {
  const size = 1 << bpd
  const pc = new Uint8Array(size)
  for (let v = 0; v < size; v++) {
    let c = 0
    for (let t = v; t; t &= t - 1) c++
    pc[v] = c
  }
  return pc
}

/** Build hex encoding table for grouping. */
function makeEncTable(mode: Mode, base: number): string[] {
  const enc = new Array<string>(base)
  for (let i = 0; i < base; i++) {
    enc[i] = mode === 'hex' ? i.toString(16).toUpperCase() : String(i)
  }
  return enc
}

/** Group digits into space-separated groups of `perGroup`. */
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

/**
 * Synchronous stochastic sampler — useful for CLI and testing.
 * For the browser UI, use the async worker variant instead.
 */
export function sampleRhythms(params: SamplerParams): SamplerResult {
  const base = params.mode === 'binary' ? 2 : params.mode === 'octal' ? 8 : 16
  const bpd = bitsPerDigitForMode(params.mode)
  const digitsCount = params.numerator * params.denominator
  const totalBits = digitsCount * bpd

  const lookup = makeLookup(bpd)
  const popcountLookup = makePopcountLookup(bpd)
  const encTable = makeEncTable(params.mode, base)

  const minOn = typeof params.minOnsets === 'number' ? params.minOnsets : 0
  const maxOn = typeof params.maxOnsets === 'number' ? params.maxOnsets : totalBits
  const keepProb = typeof params.retentionProbability === 'number'
    ? Math.max(0, Math.min(1, params.retentionProbability)) : 1
  const doRetention = keepProb < 1

  const predExpr = params.predicateExpression ?? null
  const hasPredicates = !!(predExpr && predExpr.children && predExpr.children.length > 0)
  const canonicalOpts = { circular: true, rotationInvariant: true, reflectionInvariant: true }

  const targetCount = params.maxResults <= 0 ? Number.POSITIVE_INFINITY : params.maxResults
  const maxAttempts = params.maxAttempts <= 0 ? Number.POSITIVE_INFINITY : params.maxAttempts

  const seen = new Set<string>()
  const items: RhythmItem[] = []
  let attempts = 0
  const onsetsBuf = new Int32Array(totalBits)

  while (items.length < targetCount && attempts < maxAttempts) {
    // Generate random digit array
    const digits = new Array<number>(digitsCount)
    for (let i = 0; i < digitsCount; i++) {
      digits[i] = Math.floor(Math.random() * base)
    }

    attempts++

    // Fast onset count
    let onsetsCount = 0
    for (let j = 0; j < digitsCount; j++) onsetsCount += popcountLookup[digits[j]]

    // Skip trivial all-zero or all-max
    if (onsetsCount === 0 || onsetsCount === totalBits) continue
    if (onsetsCount < minOn || onsetsCount > maxOn) continue

    // Build onset positions
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

    // Check predicates
    if (hasPredicates && !evaluatePredicateTree(predExpr, onsets, totalBits, canonicalOpts)) {
      continue
    }

    // Retention probability
    if (doRetention && Math.random() > keepProb) continue

    // Deduplication
    const groupedDigitsString = groupDigits(digits, encTable, params.denominator)
    if (seen.has(groupedDigitsString)) continue
    seen.add(groupedDigitsString)

    items.push({
      id: `${params.mode}:${groupedDigitsString}:${items.length}`,
      base: params.mode,
      groupedDigitsString,
      onsets: onsetsCount,
      canonicalContour: canonicalContourFromOnsets(onsets, totalBits, canonicalOpts),
      numerator: params.numerator,
      denominator: params.denominator
    })
  }

  return { items, attempts, emitted: items.length }
}
