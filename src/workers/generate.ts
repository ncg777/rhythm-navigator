/// <reference lib="webworker" />
import type { Mode, RhythmItem } from '@/utils/rhythm'
import { bitsPerDigitForMode } from '@/utils/rhythm'
import { canonicalContourFromOnsets } from '@/utils/contour'
import { evaluatePredicateTree } from '@/utils/predicateEval'
import type { PredicateGroup } from '@/types/predicateExpression'

type StartPayload = {
  mode: Mode
  numerator: number
  denominator: number
  maxReps: number // 0 = unlimited
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
    run(msg.payload).catch(() => {
      // swallow errors to avoid noisy console in worker
    })
  }
}

function makeLookup(bpd: number): number[][] {
  const size = 1 << bpd
  const out: number[][] = new Array(size)
  for (let v = 0; v < size; v++) {
    const indices: number[] = []
    // MSB-first positions within a digit
    for (let i = 0; i < bpd; i++) {
      const bit = (v >> (bpd - 1 - i)) & 1
      if (bit) indices.push(i)
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

  // Pre-compute popcount per digit value for fast onset counting
  const popcountLookup = new Uint8Array(1 << bpd)
  for (let v = 0; v < (1 << bpd); v++) {
    let c = 0
    for (let t = v; t; t &= t - 1) c++
    popcountLookup[v] = c
  }

  // Pre-compute constants
  const minOn = typeof p.minOnsets === 'number' ? p.minOnsets : 0
  const maxOn = typeof p.maxOnsets === 'number' ? p.maxOnsets : totalBits
  const keepProb = typeof p.retentionProbability === 'number' ? Math.max(0, Math.min(1, p.retentionProbability)) : 1
  const doRetention = keepProb < 1

  // Predicate expression tree (null/empty = everything passes)
  const predExpr = p.predicateExpression ?? null
  const hasPredicates = !!(predExpr && predExpr.children && predExpr.children.length > 0)

  const canonicalOpts = { circular: true, rotationInvariant: true, reflectionInvariant: true }

  // Pre-allocate hex encoding table
  const encTable = new Array<string>(base)
  for (let i = 0; i < base; i++) encTable[i] = p.mode === 'hex' ? i.toString(16).toUpperCase() : String(i)

  // Re-usable onset buffer (max possible onset count = totalBits)
  const onsetsBuf = new Int32Array(totalBits)

  // Odometer digits
  const digits = new Array<number>(digitsCount).fill(0)

  const targetCount = p.maxReps <= 0 ? Number.POSITIVE_INFINITY : Math.max(1, p.maxReps)

  const BATCH_SIZE = 500
  const YIELD_INTERVAL_MS = 50 // yield to message loop less frequently than before

  let emitted = 0
  let processed = 0
  let batch: RhythmItem[] = []
  let done = false
  let lastYield = Date.now()

  const post = self as unknown as Worker

  const pushBatch = () => {
    if (batch.length) {
      post.postMessage({ type: 'batch', items: batch })
      batch = []
    }
  }

  while (!done && !stopping && emitted < targetCount) {
    // Fast onset count without building onset array
    let onsetsCount = 0
    for (let j = 0; j < digitsCount; j++) onsetsCount += popcountLookup[digits[j]]

    // Skip trivial all-zero or all-max patterns
    if (onsetsCount > 0 && onsetsCount < totalBits && onsetsCount >= minOn && onsetsCount <= maxOn) {
      // Build onset positions into pre-allocated buffer
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
      // Create a view for predicate functions (they expect number[])
      const onsets = Array.from(onsetsBuf.subarray(0, oi))

      const passes = !hasPredicates || evaluatePredicateTree(predExpr, onsets, totalBits, canonicalOpts)

      if (passes) {
        if (doRetention && Math.random() > keepProb) {
          // skip
        } else {
          const groupedDigitsString = groupDigits(digits, encTable, p.denominator)
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
        }
      }
    }

    processed++

    // Batch postMessage and yield based on time, not fixed iteration count.
    // Amortise the Date.now() call — only check real time every 256 iterations.
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
    if (carry) {
      done = true
    }
  }

  pushBatch()
  post.postMessage({ type: 'progress', processed, emitted })
  post.postMessage({ type: 'done' })
}

// (no-op) legacy helper removed; shadow contour no longer uses complement onsets.

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