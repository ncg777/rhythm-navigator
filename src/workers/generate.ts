/// <reference lib="webworker" />
import type { Mode, RhythmItem } from '@/utils/rhythm'
import { bitsPerDigitForMode } from '@/utils/rhythm'
import { canonicalContourFromOnsets, shadowContourFromOnsets } from '@/utils/contour'
import { isMaximallyEven, hasROP23, hasOddIntervalsOddity, noAntipodalPairs, isLowEntropy, hasNoGaps, relativelyFlat, hasOrdinal } from '@/utils/predicates'

type StartPayload = {
  mode: Mode
  numerator: number
  denominator: number
  maxReps: number // 0 = unlimited
  minOnsets: number
  maxOnsets: number
  onlyIsomorphic: boolean // now interpreted as: only shadow-contour–isomorphic
  onlyMaximallyEven: boolean
  oddityType: 'off' | 'rop23' | 'odd-intervals' | 'no-antipodes'
  onlyLowEntropy?: boolean
  onlyHasNoGaps?: boolean
  onlyRelativelyFlat?: boolean
  ordinalEnabled?: boolean
  ordinalN?: number
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

  // Odometer digits (avoids BigInt and repeated div/mod)
  const digits = new Array<number>(digitsCount).fill(0)

  const targetCount = p.maxReps <= 0 ? Number.POSITIVE_INFINITY : Math.max(1, p.maxReps)

  const BATCH_SIZE = 200
  const PROGRESS_EVERY = 2000

  let emitted = 0
  let processed = 0
  let batch: RhythmItem[] = []
  let done = false

  const pushBatch = () => {
    if (batch.length) {
      ;(self as unknown as Worker).postMessage({ type: 'batch', items: batch })
      batch = []
    }
  }

  while (!done && !stopping && emitted < targetCount) {
    // Evaluate current digits
    // Always exclude trivial all-zero or all-one patterns
    if (!(allAre(digits, 0) || allAre(digits, base - 1))) {
      // Build onset positions directly
      const onsets: number[] = []
      for (let j = 0; j < digitsCount; j++) {
        const v = digits[j]
        const indices = lookup[v]
        if (indices.length) {
          const offset = j * bpd
          for (let k = 0; k < indices.length; k++) {
            onsets.push(offset + indices[k])
          }
        }
      }

      const onsetsCount = onsets.length
      if (onsetsCount >= p.minOnsets && onsetsCount <= p.maxOnsets) {
        let passes = true

        if (p.onlyIsomorphic) {
          // Mirror Java predicate: compare canonical contour to shadow contour
          if (onsets.length < 2) {
            passes = true
          } else {
            // Use circular + dihedral invariance to match Java predicate semantics
            const canonicalOpts = {
              circular: true,
              rotationInvariant: true,
              reflectionInvariant: true
            }
            const c1 = canonicalContourFromOnsets(onsets, totalBits, canonicalOpts)
            const s1 = shadowContourFromOnsets(onsets, totalBits, canonicalOpts)
            passes = c1.length > 0 && c1 === s1
          }
        }

        // Apply maximally even filter
        if (passes && p.onlyMaximallyEven) {
          passes = isMaximallyEven(onsets, totalBits)
        }

  // Apply maximally even / low-entropy / oddity type filters
        if (passes && p.oddityType !== 'off') {
          switch (p.oddityType) {
            case 'rop23':
              passes = hasROP23(onsets, totalBits)
              break
            case 'odd-intervals':
              passes = hasOddIntervalsOddity(onsets, totalBits)
              break
            case 'no-antipodes':
              passes = noAntipodalPairs(onsets, totalBits)
              break
          }
        }

        if (passes && p.onlyLowEntropy) {
          passes = isLowEntropy(onsets, totalBits)
        }

        if (passes && p.onlyHasNoGaps) {
          passes = hasNoGaps(onsets, totalBits)
        }

        if (passes && p.onlyRelativelyFlat) {
          passes = relativelyFlat(onsets, totalBits)
        }

        if (passes && p.ordinalEnabled && p.ordinalN && p.ordinalN >= 2) {
          passes = hasOrdinal(onsets, totalBits, p.ordinalN)
        }

        if (passes) {
          const groupedDigitsString = groupDigits(digits, p.mode, p.denominator)
          batch.push({
            id: `${p.mode}:${groupedDigitsString}:${emitted}`,
            base: p.mode,
            groupedDigitsString,
            onsets: onsetsCount,
            // Always use circular + rotation + reflection invariance for canonical contour display
            canonicalContour: canonicalContourFromOnsets(onsets, totalBits, {
              circular: true,
              rotationInvariant: true,
              reflectionInvariant: true
            }),
            numerator: p.numerator,
            denominator: p.denominator
          })
          emitted++
        }
      }
    }

    processed++
    if (processed % BATCH_SIZE === 0) pushBatch()
    if (processed % PROGRESS_EVERY === 0) {
      ;(self as unknown as Worker).postMessage({ type: 'progress', processed, emitted })
      await tick()
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
  ;(self as unknown as Worker).postMessage({ type: 'progress', processed, emitted })
  ;(self as unknown as Worker).postMessage({ type: 'done' })
}

// (no-op) legacy helper removed; shadow contour no longer uses complement onsets.

function groupDigits(digits: number[], mode: Mode, perGroup: number): string {
  const enc = (d: number) => (mode === 'hex' ? d.toString(16).toUpperCase() : String(d))
  const parts: string[] = []
  for (let i = 0; i < digits.length; i += perGroup) {
    parts.push(digits.slice(i, i + perGroup).map(enc).join(''))
  }
  return parts.join(' ')
}

function allAre(arr: number[], v: number): boolean {
  for (let i = 0; i < arr.length; i++) if (arr[i] !== v) return false
  return true
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}