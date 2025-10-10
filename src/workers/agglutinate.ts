/// <reference lib="webworker" />
import type { Mode, RhythmItem } from '@/utils/rhythm'
import { bitsPerDigitForMode } from '@/utils/rhythm'
import { parseDigitsFromGroupedString } from '@/utils/relations'
import { canonicalContourFromOnsets, shadowContourFromOnsets } from '@/utils/contour'
import { isMaximallyEven, hasROP23, hasOddIntervalsOddity, noAntipodalPairs, isLowEntropy, hasNoGaps, relativelyFlat, hasOrdinal } from '@/utils/predicates'

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
  onlyIsomorphic: boolean
  onlyMaximallyEven: boolean
  oddityType: 'off' | 'rop23' | 'odd-intervals' | 'no-antipodes'
  onlyLowEntropy?: boolean
  onlyHasNoGaps?: boolean
  onlyRelativelyFlat?: boolean
  ordinalEnabled?: boolean
  ordinalN?: number
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

function splitGroups(s: string): string[] { return (s || '').trim().split(/\s+/).filter(Boolean) }

function isValidConcat(digits: number[], mode: Mode, p: StartPayload): boolean {
  const { onsets, totalBits } = digitsToOnsets(digits, mode)
  const onsetsCount = onsets.length
  const minOn = typeof p.minOnsets === 'number' ? p.minOnsets : 0
  const maxOn = typeof p.maxOnsets === 'number' ? p.maxOnsets : totalBits
  if (onsetsCount < minOn || onsetsCount > maxOn) return false
  if (p.excludeTrivial) {
    const allZero = onsetsCount === 0
    const allOne = onsetsCount === totalBits
    if (allZero || allOne) return false
  }
  if (p.onlyIsomorphic) {
    const opts = { circular: p.circular, rotationInvariant: p.rotationInvariant, reflectionInvariant: p.reflectionInvariant }
    const co = canonicalContourFromOnsets(onsets, totalBits, opts)
    const so = shadowContourFromOnsets(onsets, totalBits, opts)
    if (!(co.length > 0 && co === so)) return false
  }
  if (p.onlyMaximallyEven && !isMaximallyEven(onsets, totalBits)) return false
  switch (p.oddityType) {
    case 'rop23': if (!hasROP23(onsets, totalBits)) return false; break
    case 'odd-intervals': if (!hasOddIntervalsOddity(onsets, totalBits)) return false; break
    case 'no-antipodes': if (!noAntipodalPairs(onsets, totalBits)) return false; break
  }
  if (p.onlyLowEntropy && !isLowEntropy(onsets, totalBits)) return false
  if (p.onlyHasNoGaps && !hasNoGaps(onsets, totalBits)) return false
  if (p.onlyRelativelyFlat && !relativelyFlat(onsets, totalBits)) return false
  if (p.ordinalEnabled && p.ordinalN && p.ordinalN >= 2 && !hasOrdinal(onsets, totalBits, p.ordinalN)) return false
  return true
}

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

  const BATCH_SIZE = 200
  const PROGRESS_EVERY = 2000
  let processed = 0
  let emitted = 0
  let batch: RhythmItem[] = []
  // compute total pairs for progress meta
  let totalPairs = 0
  for (const arr of groups.values()) totalPairs += arr.length * arr.length
  ;(self as unknown as Worker).postMessage({ type: 'meta', totalPairs } as OutMsg)

  const pushBatch = () => {
    if (batch.length) {
      ;(self as unknown as Worker).postMessage({ type: 'batch', items: batch } as OutMsg)
      batch = []
    }
  }

  const opts = { circular: p.circular, rotationInvariant: p.rotationInvariant, reflectionInvariant: p.reflectionInvariant }

  for (const [key, arr] of groups.entries()) {
    if (stopping) break
    const m = meters.get(key)!
    // Precompute per-item: groups (tokens), onsets, totalBits
    const pre = arr.map(a => {
      const d = parseDigitsFromGroupedString(a.groupedDigitsString, a.base)
      const { onsets, totalBits } = digitsToOnsets(d, a.base)
      return { a, groups: splitGroups(a.groupedDigitsString), onsets, totalBits }
    })

    // Time-sliced loops to keep UI responsive, without early return
    let i = 0, j = 0
    let start = Date.now()
    const timeBudgetMs = 16
    while (!stopping && i < pre.length) {
      while (!stopping && j < pre.length) {
        const ai = pre[i]
        const bj = pre[j]
        // Merge onsets with offset
        const offset = ai.totalBits
        const onsets = new Array<number>(ai.onsets.length + bj.onsets.length)
        // copy A
        for (let k = 0; k < ai.onsets.length; k++) onsets[k] = ai.onsets[k]
        // copy B with shift
        for (let k = 0; k < bj.onsets.length; k++) onsets[ai.onsets.length + k] = bj.onsets[k] + offset
        const totalBits = ai.totalBits + bj.totalBits

        // Quick trivial checks
        const onsetsCount = onsets.length
  const minOn = typeof p.minOnsets === 'number' ? p.minOnsets : 0
  const maxOn = typeof p.maxOnsets === 'number' ? p.maxOnsets : totalBits
  if (onsetsCount >= minOn && onsetsCount <= maxOn) {
          let pass = true
          if (p.excludeTrivial && (onsetsCount === 0 || onsetsCount === totalBits)) pass = false
          if (pass && p.onlyIsomorphic) {
            const co = canonicalContourFromOnsets(onsets, totalBits, opts)
            const so = shadowContourFromOnsets(onsets, totalBits, opts)
            pass = co.length > 0 && co === so
          }
          if (pass && p.onlyMaximallyEven) pass = isMaximallyEven(onsets, totalBits)
          if (pass && p.oddityType !== 'off') {
            switch (p.oddityType) {
              case 'rop23': pass = hasROP23(onsets, totalBits); break
              case 'odd-intervals': pass = hasOddIntervalsOddity(onsets, totalBits); break
              case 'no-antipodes': pass = noAntipodalPairs(onsets, totalBits); break
            }
          }
          if (pass && p.onlyLowEntropy) pass = isLowEntropy(onsets, totalBits)
          if (pass && p.onlyHasNoGaps) pass = hasNoGaps(onsets, totalBits)
          if (pass && p.onlyRelativelyFlat) pass = relativelyFlat(onsets, totalBits)
          if (pass && p.ordinalEnabled && p.ordinalN && p.ordinalN >= 2) pass = hasOrdinal(onsets, totalBits, p.ordinalN)

          if (pass) {
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
        processed++
        if ((processed % PROGRESS_EVERY === 0) || (Date.now() - start) > timeBudgetMs) {
          ;(self as unknown as Worker).postMessage({ type: 'progress', processed, emitted } as OutMsg)
          await new Promise(r => setTimeout(r, 0))
          start = Date.now()
        }
        j++
      }
      i++
      j = 0
      if ((Date.now() - start) > timeBudgetMs) {
        ;(self as unknown as Worker).postMessage({ type: 'progress', processed, emitted } as OutMsg)
        await new Promise(r => setTimeout(r, 0))
        start = Date.now()
      }
    }
  }

  pushBatch()
  ;(self as unknown as Worker).postMessage({ type: 'progress', processed, emitted } as OutMsg)
  ;(self as unknown as Worker).postMessage({ type: 'done' } as OutMsg)
}
