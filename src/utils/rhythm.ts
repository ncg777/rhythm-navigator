export type Mode = 'binary' | 'octal' | 'hex'

export function bitsPerDigitForMode(mode: Mode): number {
  return mode === 'binary' ? 1 : mode === 'octal' ? 3 : 4
}

/**
 * Kept for tests and possible debugging: expands digits to a bit array, MSB-first per digit.
 */
export function digitsToBits(digits: number[], mode: Mode): Uint8Array {
  const bpd = bitsPerDigitForMode(mode)
  const bits = new Uint8Array(digits.length * bpd)
  let k = 0
  for (const d of digits) {
    const max = (1 << bpd) - 1
    const v = Math.max(0, Math.min(d, max))
    for (let i = bpd - 1; i >= 0; i--) {
      bits[k++] = (v >> i) & 1
    }
  }
  return bits
}

export function countOnsets(bits: Uint8Array): number {
  let c = 0
  for (const b of bits) c += b & 1
  return c
}

/**
 * Slimmed down item to reduce memory and messaging cost.
 * We omit the full bits array; digits are optional and only used for display if needed.
 */
export type RhythmItem = {
  id: string
  base: Mode
  groupedDigitsString: string
  onsets: number
  canonicalContour: string
  digits?: number[]
}