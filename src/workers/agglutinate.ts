/// <reference lib="webworker" />
import type { Mode, RhythmItem } from '@/utils/rhythm'
import { bitsPerDigitForMode } from '@/utils/rhythm'
import { parseDigitsFromGroupedString } from '@/utils/relations'
import { canonicalContourFromOnsets } from '@/utils/contour'
import { evaluatePredicateTree } from '@/utils/predicateEval'
import type { PredicateGroup } from '@/types/predicateExpression'

type InItem = {
  base: Mode
  groupedDigitsString: string
  numerator: number
  denominator: number
}

type StartPayload = {
  items: InItem[]
  fallbackNumerator: number
  fallbackDenominator: number
  circular: boolean
  rotationInvariant: boolean
  reflectionInvariant: boolean
  excludeTrivial: boolean
  minOnsets?: number
  maxOnsets?: number
  predicateExpression?: PredicateGroup | null
  retentionProbability?: number // 0..1
}

type InMsg = { type: 'start'; payload: StartPayload } | { type: 'stop' }
type OutMsg =
  | { type: 'meta'; totalPairs: number }
  | { type: 'batch'; items: RhythmItem[] }
  | { type: 'progress'; processed: number; emitted: number }
  | { type: 'done' }

let stopping = false

self.onmessage = (ev: MessageEvent<InMsg>) => {
  const msg = ev.data
  if (msg.type === 'stop') { stopping = true; return }
  if (msg.type === 'start') { stopping = false; run(msg.payload).catch(() => {}) }
}

function digitsToOnsets(digits: number[], mode: Mode): { onsets: number[]; totalBits: number } {
  const bpd = bitsPerDigitForMode(mode)
  const totalBits = digits.length * bpd
  const onsets: number[] = []
  const max = (1 << bpd) - 1
  for (let j = 0; j < digits.length; j++) {
    const v = Math.max(0, Math.min(digits[j], max))
    const base = j * bpd
    for (let i = 0; i < bpd; i++) {
      const bit = (v >> (bpd - 1 - i)) & 1
      if (bit) onsets.push(base + i)
    }
  }
  return { onsets, totalBits }
}

// Concatenate grouped strings directly (same per-group length guaranteed in group)
function concatGrouped(aGroups: string[], bGroups: string[]): string {
  if (aGroups.length === 0) return bGroups.join(' ')
  if (bGroups.length === 0) return aGroups.join(' ')
  return aGroups.join(' ') + ' ' + bGroups.join(' ')
}

function splitGroups(s: string): string[] { return (s || '').trim().split(/\\s+/).filter(Boolean) }

async function run(p: StartPayload) {
  const items = p.items
  // Group items by (base, num, den) — timesig always present per request
  const groups = new Map<string, InItem[]>()
  const meters = new Map<string, { base: Mode; num: number; den: number }>()
  for (const it of items) {
    const num = Math.max(1, Math.floor(Number(it.numerator)))
    const den = Math.max(1, Math.floor(Number(it.denominator)))
    const key = `${it.base}|${num}/${den}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(it)
    if (!meters.has(key)) meters.set(key, { base: it.base, num, den })
  }

  const BATCH_SIZE = 500
  const YIELD_INTERVAL_MS = 50
  let processed = 0
  let emitted = 0
  let batch: RhythmItem[] = []
  // compute total pairs for progress meta
  let totalPairs = 0
  for (const arr of groups.values()) totalPairs += arr.length * arr.length

  const post = self as unknown as Worker
  post.postMessage({ type: 'meta', totalPairs } as OutMsg)

  const pushBatch = () => {
    if (batch.length) {
      post.postMessage({ type: 'batch', items: batch } as OutMsg)
      batch = []
    }
  }

  const opts = { circular: p.circular, rotationInvariant: p.rotationInvariant, reflectionInvariant: p.reflectionInvariant }

  // Predicate expression tree
  const predExpr = p.predicateExpression ?? null
  const hasPredicates = !!(predExpr && predExpr.children && predExpr.children.length > 0)
  const minOn = typeof p.minOnsets === 'number' ? p.minOnsets : -1
  const hasMinOn = minOn >= 0
  const maxOnProvided = typeof p.maxOnsets === 'number'
  const maxOnVal = typeof p.maxOnsets === 'number' ? p.maxOnsets : 0
  const keepProb = typeof p.retentionProbability === 'number' ? Math.max(0, Math.min(1, p.retentionProbability)) : 1
  const doRetention = keepProb < 1

  for (const [key, arr] of groups.entries()) {
    if (stopping) break
    const m = meters.get(key)!
    // Precompute per-item: groups (tokens), onsets, totalBits
    const pre = arr.map(a => {
      const d = parseDigitsFromGroupedString(a.groupedDigitsString, a.base)
      const { onsets, totalBits } = digitsToOnsets(d, a.base)
      return { a, groups: splitGroups(a.groupedDigitsString), onsets, totalBits }
    })

    // Pre-allocate merged onset buffer (max size = sum of two largest)
    let maxBuf = 0
    for (const item of pre) if (item.onsets.length > maxBuf) maxBuf = item.onsets.length
    maxBuf *= 2
    const onsetsBuf = new Array<number>(maxBuf)

    let lastYield = Date.now()

    for (let i = 0; !stopping && i < pre.length; i++) {
      const ai = pre[i]
      for (let j = 0; !stopping && j < pre.length; j++) {
        const bj = pre[j]
        const offset = ai.totalBits
        const onsetsCount = ai.onsets.length + bj.onsets.length
        const totalBits = ai.totalBits + bj.totalBits
        const maxOn = maxOnProvided ? maxOnVal : totalBits
        const minOnEff = hasMinOn ? minOn : 0

        if (onsetsCount >= minOnEff && onsetsCount <= maxOn) {
          let pass = true
          if (p.excludeTrivial && (onsetsCount === 0 || onsetsCount === totalBits)) pass = false

          if (pass) {
            // Build merged onset array into buffer
            for (let k = 0; k < ai.onsets.length; k++) onsetsBuf[k] = ai.onsets[k]
            for (let k = 0; k < bj.onsets.length; k++) onsetsBuf[ai.onsets.length + k] = bj.onsets[k] + offset
            const onsets = onsetsBuf.slice(0, onsetsCount)

            pass = !hasPredicates || evaluatePredicateTree(predExpr, onsets, totalBits, opts)

            if (pass) {
              if (doRetention && Math.random() > keepProb) {
                // skip
              } else {
                const grouped = concatGrouped(ai.groups, bj.groups)
                const canonicalContour = canonicalContourFromOnsets(onsets, totalBits, opts)
                batch.push({
                  id: `aggl:${m.base}:${grouped}:${emitted}`,
                  base: m.base,
                  groupedDigitsString: grouped,
                  onsets: onsetsCount,
                  canonicalContour,
                  numerator: m.num * 2,
                  denominator: m.den
                })
                emitted++
                if (batch.length >= BATCH_SIZE) pushBatch()
              }
            }
          }
        }
        processed++

        // Time-based yielding (amortised Date.now check every 64 iterations)
        if ((processed & 63) === 0) {
          const now = Date.now()
          if (now - lastYield >= YIELD_INTERVAL_MS) {
            pushBatch()
            post.postMessage({ type: 'progress', processed, emitted } as OutMsg)
            await new Promise(r => setTimeout(r, 0))
            lastYield = Date.now()
          }
        }
      }
    }
  }

  pushBatch()
  post.postMessage({ type: 'progress', processed, emitted } as OutMsg)
  post.postMessage({ type: 'done' } as OutMsg)
}
