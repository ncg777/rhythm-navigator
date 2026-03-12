/// <reference lib="webworker" />
/**
 * Web Worker for stochastic rhythm sampling.
 *
 * Uses the same message protocol as the enumerative generate worker
 * (batch / progress / done) so the store can drive either approach
 * with identical handler logic.
 */
import type { Mode, RhythmItem } from '@/utils/rhythm'
import { bitsPerDigitForMode } from '@/utils/rhythm'
import { canonicalContourFromOnsets } from '@/utils/contour'
import { evaluatePredicateTree } from '@/utils/predicateEval'
import type { PredicateGroup } from '@/types/predicateExpression'

type StartPayload = {
  mode: Mode
  numerator: number
  denominator: number
  maxReps: number            // 0 = unlimited
  maxAttempts: number        // hard cap on random trials
  minOnsets?: number
  maxOnsets?: number
  predicateExpression?: PredicateGroup | null
  retentionProbability?: number // 0..1
}

type InMsg = { type: 'start'; payload: StartPayload } | { type: 'stop' }

let stopping = false

self.onmessage = (ev: MessageEvent<InMsg>) => {
  const msg = ev.data
  if (msg.type === 'stop') {
    stopping = true
    return
  }
  if (msg.type === 'start') {
    stopping = false
    run(msg.payload).catch(() => {})
  }
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

async function run(p: StartPayload) {
  const base = p.mode === 'binary' ? 2 : p.mode === 'octal' ? 8 : 16
  const bpd = bitsPerDigitForMode(p.mode)
  const digitsCount = p.numerator * p.denominator
  const totalBits = digitsCount * bpd
  const lookup = makeLookup(bpd)

  const popcountLookup = new Uint8Array(1 << bpd)
  for (let v = 0; v < (1 << bpd); v++) {
    let c = 0
    for (let t = v; t; t &= t - 1) c++
    popcountLookup[v] = c
  }

  const minOn = typeof p.minOnsets === 'number' ? p.minOnsets : 0
  const maxOn = typeof p.maxOnsets === 'number' ? p.maxOnsets : totalBits
  const keepProb = typeof p.retentionProbability === 'number'
    ? Math.max(0, Math.min(1, p.retentionProbability)) : 1
  const doRetention = keepProb < 1

  const predExpr = p.predicateExpression ?? null
  const hasPredicates = !!(predExpr && predExpr.children && predExpr.children.length > 0)
  const canonicalOpts = { circular: true, rotationInvariant: true, reflectionInvariant: true }

  const encTable = new Array<string>(base)
  for (let i = 0; i < base; i++) {
    encTable[i] = p.mode === 'hex' ? i.toString(16).toUpperCase() : String(i)
  }

  const onsetsBuf = new Int32Array(totalBits)
  const seen = new Set<string>()

  const targetCount = p.maxReps <= 0 ? Number.POSITIVE_INFINITY : Math.max(1, p.maxReps)
  const maxAttempts = p.maxAttempts <= 0 ? Number.POSITIVE_INFINITY : p.maxAttempts

  const BATCH_SIZE = 500
  const YIELD_INTERVAL_MS = 50

  let emitted = 0
  let processed = 0
  let batch: RhythmItem[] = []
  let lastYield = Date.now()

  const post = self as unknown as Worker

  const pushBatch = () => {
    if (batch.length) {
      post.postMessage({ type: 'batch', items: batch })
      batch = []
    }
  }

  // Track consecutive misses to detect saturation / low density
  let consecutiveMisses = 0
  const MAX_CONSECUTIVE_MISSES = 100_000

  while (!stopping && emitted < targetCount && processed < maxAttempts) {
    // Generate random digit array
    const digits = new Array<number>(digitsCount)
    for (let i = 0; i < digitsCount; i++) {
      digits[i] = Math.floor(Math.random() * base)
    }
    processed++

    // Fast onset count
    let onsetsCount = 0
    for (let j = 0; j < digitsCount; j++) onsetsCount += popcountLookup[digits[j]]

    if (onsetsCount === 0 || onsetsCount === totalBits || onsetsCount < minOn || onsetsCount > maxOn) {
      consecutiveMisses++
      if (consecutiveMisses >= MAX_CONSECUTIVE_MISSES) break
      // Yield periodically
      if ((processed & 255) === 0) {
        const now = Date.now()
        if (now - lastYield >= YIELD_INTERVAL_MS) {
          pushBatch()
          post.postMessage({ type: 'progress', processed, emitted })
          await tick()
          lastYield = Date.now()
        }
      }
      continue
    }

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

    if (hasPredicates && !evaluatePredicateTree(predExpr, onsets, totalBits, canonicalOpts)) {
      consecutiveMisses++
      if (consecutiveMisses >= MAX_CONSECUTIVE_MISSES) break
      if ((processed & 255) === 0) {
        const now = Date.now()
        if (now - lastYield >= YIELD_INTERVAL_MS) {
          pushBatch()
          post.postMessage({ type: 'progress', processed, emitted })
          await tick()
          lastYield = Date.now()
        }
      }
      continue
    }

    if (doRetention && Math.random() > keepProb) {
      consecutiveMisses++
      if (consecutiveMisses >= MAX_CONSECUTIVE_MISSES) break
      continue
    }

    // Deduplication
    const groupedDigitsString = groupDigits(digits, encTable, p.denominator)
    if (seen.has(groupedDigitsString)) {
      consecutiveMisses++
      if (consecutiveMisses >= MAX_CONSECUTIVE_MISSES) break
      continue
    }
    seen.add(groupedDigitsString)
    consecutiveMisses = 0

    batch.push({
      id: `${p.mode}:${groupedDigitsString}:${emitted}`,
      base: p.mode,
      groupedDigitsString,
      onsets: onsetsCount,
      canonicalContour: canonicalContourFromOnsets(onsets, totalBits, canonicalOpts),
      numerator: p.numerator,
      denominator: p.denominator
    })
    emitted++

    if (batch.length >= BATCH_SIZE) pushBatch()
    if ((processed & 255) === 0) {
      const now = Date.now()
      if (now - lastYield >= YIELD_INTERVAL_MS) {
        pushBatch()
        post.postMessage({ type: 'progress', processed, emitted })
        await tick()
        lastYield = Date.now()
      }
    }
  }

  pushBatch()
  post.postMessage({ type: 'progress', processed, emitted })
  post.postMessage({ type: 'done' })
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

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
