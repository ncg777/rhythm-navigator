import { bitsPerDigitForMode, type Mode } from '@/utils/rhythm'

export type SyncopationMetrics = {
  lhlApprox: number
  offbeatWeighted: number
  onBeatCount: number
  offBeatCount: number
  meanOnsetWeight: number
  maxWeight: number
}

export function bitsPerBeat(mode: Mode, digitsPerBeat: number): number {
  // digits per beat * bits per digit
  return digitsPerBeat * bitsPerDigitForMode(mode)
}

/**
 * Build hierarchical metrical weights per smallest time unit (bit index).
 * Strongest at beat starts, then half-beat, then quarter-beat, etc. (binary halving).
 * Works even if the number of subunits per beat is not a power of two (uses floor halving).
 * Adds a small bonus for the downbeat (measure start) to disambiguate it.
 */
export function buildMetricalWeights(totalBits: number, beats: number, spb: number): number[] {
  const weights = new Array<number>(totalBits)
  // Precompute halving steps from strongest to weakest
  const steps: number[] = []
  let step = spb
  while (step >= 1) {
    steps.push(step)
    if (step === 1) break
    step = Math.max(1, Math.floor(step / 2))
    if (steps[steps.length - 1] === step) break // guard if spb=1
  }
  const strongest = steps.length // weight scale 1..strongest
  const measure = beats * spb

  for (let i = 0; i < totalBits; i++) {
    const posInBeat = i % spb
    let w = 1
    for (let s = 0; s < steps.length; s++) {
      if (posInBeat % steps[s] === 0) {
        w = strongest - s + 0 // strongest at beat start
        break
      }
    }
    // Downbeat (measure start) gets a tiny bump
    if (measure > 0 && i % measure === 0) w += 1
    weights[i] = w
  }
  return weights
}

/**
 * Compute syncopation metrics for a given onset set.
 * - lhlApprox: For each onset, if the nearest previous stronger position is a rest, add weight(stronger) - weight(onset).
 * - offbeatWeighted: Sum(maxWeight - weight(onset)) across onsets.
 */
export function computeSyncopationMetrics(
  onsets: number[],
  totalBits: number,
  beats: number,
  spb: number
): SyncopationMetrics {
  const weights = buildMetricalWeights(totalBits, beats, spb)
  const maxWeight = weights.length ? Math.max(...weights) : 0

  const onsetFlag = new Uint8Array(totalBits)
  for (const p of onsets) if (p >= 0 && p < totalBits) onsetFlag[p] = 1

  let lhlApprox = 0
  let offbeatWeighted = 0
  let onBeatCount = 0
  let offBeatCount = 0
  let sumOnsetWeight = 0

  for (let i = 0; i < totalBits; i++) {
    if (!onsetFlag[i]) continue
    const wi = weights[i]
    sumOnsetWeight += wi
    offbeatWeighted += Math.max(0, maxWeight - wi)
    if (spb > 0 && i % spb === 0) onBeatCount++
    else offBeatCount++

    // Find nearest previous stronger position j < i with weights[j] > weights[i]
    let j = i - 1
    while (j >= 0 && weights[j] <= wi) j--
    if (j >= 0) {
      // If that stronger position is a rest, count it as syncopation
      if (!onsetFlag[j]) {
        lhlApprox += (weights[j] - wi)
      }
    }
  }

  const meanOnsetWeight = (onBeatCount + offBeatCount) ? (sumOnsetWeight / (onBeatCount + offBeatCount)) : 0

  return {
    lhlApprox,
    offbeatWeighted,
    onBeatCount,
    offBeatCount,
    meanOnsetWeight,
    maxWeight
  }
}

/**
 * Helper to reconstruct onsets from grouped digits string and mode.
 * Returns onsets and totalBits.
 */
export function onsetsFromGroupedDigits(grouped: string, mode: Mode, digitsPerBeat: number, beats: number): { onsets: number[]; totalBits: number; spb: number } {
  const digits = parseDigitsFromGroupedString(grouped, mode)
  const bpd = bitsPerDigitForMode(mode)
  const totalBits = digits.length * bpd
  const spb = bitsPerBeat(mode, digitsPerBeat)
  const onsets: number[] = []
  for (let j = 0; j < digits.length; j++) {
    const v = digits[j]
    const offset = j * bpd
    for (let i = 0; i < bpd; i++) {
      const bit = (v >> (bpd - 1 - i)) & 1
      if (bit) onsets.push(offset + i)
    }
  }
  return { onsets, totalBits, spb }
}

// Minimal parser (reuses logic used elsewhere)
export function parseDigitsFromGroupedString(s: string, mode: Mode): number[] {
  const compact = s.replace(/\s+/g, '')
  const chars = [...compact]
  if (mode === 'hex') return chars.map((c) => parseInt(c, 16))
  return chars.map((c) => c.charCodeAt(0) - 48)
}