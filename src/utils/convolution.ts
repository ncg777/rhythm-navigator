/**
 * XOR Circular Convolution for Rhythms
 *
 * Implements XOR-based circular convolution between a carrier and impulse rhythm.
 * Supports arbitrary scaling of both carrier and impulse sequences.
 */

import { bitsPerDigitForMode, type Mode } from './rhythm'

/**
 * Represents a binary rhythm as a BitSet-like structure
 */
export class BinaryRhythm {
  private bits: boolean[]

  constructor(public readonly length: number) {
    this.bits = new Array(length).fill(false)
  }

  set(index: number, value: boolean = true): void {
    if (index >= 0 && index < this.length) {
      this.bits[index] = value
    }
  }

  get(index: number): boolean {
    return index >= 0 && index < this.length ? this.bits[index] : false
  }

  /**
   * Convert to bit array representation
   */
  toBits(): boolean[] {
    return [...this.bits]
  }

  /**
   * Convert to array of onset indices
   */
  toOnsets(): number[] {
    const onsets: number[] = []
    for (let i = 0; i < this.length; i++) {
      if (this.bits[i]) onsets.push(i)
    }
    return onsets
  }

  /**
   * Count the number of onsets (1 bits)
   */
  countOnsets(): number {
    return this.bits.filter(b => b).length
  }

  /**
   * Reverse the rhythm (for convolution)
   */
  reverse(): BinaryRhythm {
    const reversed = new BinaryRhythm(this.length)
    for (let i = 0; i < this.length; i++) {
      reversed.set(i, this.bits[this.length - 1 - i])
    }
    return reversed
  }
}

/**
 * Parse a rhythm from grouped digit string
 */
export function parseBinaryRhythm(
  groupedString: string,
  mode: Mode
): BinaryRhythm {
  // Remove spaces and parse digits
  const compact = groupedString.replace(/\s+/g, '')
  const chars = [...compact]

  const bpd = bitsPerDigitForMode(mode)
  const rhythm = new BinaryRhythm(chars.length * bpd)

  let bitIndex = 0
  for (const c of chars) {
    // Parse digit based on mode
    let digit: number
    if (mode === 'hex') {
      digit = parseInt(c, 16)
    } else {
      digit = c.charCodeAt(0) - 48 // '0' -> 0
      digit = digit < 0 ? 0 : digit
    }

    // Decode digit to bits (MSB first)
    for (let i = bpd - 1; i >= 0; i--) {
      const bit = (digit >> i) & 1
      rhythm.set(bitIndex++, bit === 1)
    }
  }

  return rhythm
}

/**
 * Scale a rhythm by repeating it N times
 */
export function scaleRhythm(rhythm: BinaryRhythm, scale: number): BinaryRhythm {
  if (scale <= 0) {
    throw new Error('Scale must be positive')
  }

  const newLength = rhythm.length * scale
  const scaled = new BinaryRhythm(newLength)

  for (let i = 0; i < newLength; i++) {
    const originalIndex = i % rhythm.length
    scaled.set(i, rhythm.get(originalIndex))
  }

  return scaled
}

/**
 * Perform XOR circular convolution between carrier and impulse
 *
 * This implements the algorithm:
 * result[i] = XOR of all carrier[j] where impulse[(i-j) mod n] == 1
 */
export function xorCircularConvolution(
  carrier: BinaryRhythm,
  impulse: BinaryRhythm
): BinaryRhythm {
  if (carrier.length !== impulse.length) {
    throw new Error('Carrier and impulse must have the same length')
  }

  const n = carrier.length
  const result = new BinaryRhythm(n)

  for (let i = 0; i < n; i++) {
    let xorSum = false
    for (let j = 0; j < n; j++) {
      // Circular index: (i - j) mod n, handling negative values
      const impulseIndex = ((i - j) % n + n) % n
      if (impulse.get(impulseIndex)) {
        xorSum = xorSum !== carrier.get(j) // XOR operation
      }
    }
    result.set(i, xorSum)
  }

  return result
}

/**
 * Convert a BinaryRhythm back to grouped digit string
 */
export function binaryRhythmToGroupedString(
  rhythm: BinaryRhythm,
  mode: Mode,
  digitsPerGroup: number
): string {
  const bpd = bitsPerDigitForMode(mode)
  const bits = rhythm.toBits()

  if (bits.length % bpd !== 0) {
    throw new Error(`Rhythm length ${bits.length} is not divisible by bits per digit ${bpd}`)
  }

  const digits: number[] = []
  for (let i = 0; i < bits.length; i += bpd) {
    let digit = 0
    for (let j = 0; j < bpd; j++) {
      if (bits[i + j]) {
        digit |= 1 << (bpd - 1 - j)
      }
    }
    digits.push(digit)
  }

  // Encode to string
  const encTable = mode === 'hex'
    ? '0123456789ABCDEF'
    : '01234567'.substring(0, mode === 'binary' ? 2 : 8)

  const parts: string[] = []
  let group = ''
  for (let i = 0; i < digits.length; i++) {
    group += encTable[digits[i]]
    if ((i + 1) % digitsPerGroup === 0) {
      parts.push(group)
      group = ''
    }
  }
  if (group) parts.push(group)

  return parts.join(' ')
}

/**
 * High-level function to perform XOR circular convolution with scaling
 */
export interface ConvolutionParams {
  carrier: string
  impulse: string
  mode: Mode
  carrierScale?: number
  impulseScale?: number
  denominator?: number
}

export interface ConvolutionResult {
  result: string
  carrierLength: number
  impulseLength: number
  resultLength: number
  onsets: number
}

export function convolveRhythms(params: ConvolutionParams): ConvolutionResult {
  const carrierScale = params.carrierScale || 1
  const impulseScale = params.impulseScale || 1
  const denominator = params.denominator || 1

  // Parse rhythms
  let carrier = parseBinaryRhythm(params.carrier, params.mode)
  let impulse = parseBinaryRhythm(params.impulse, params.mode)

  // Reverse both (as per Java code)
  carrier = carrier.reverse()
  impulse = impulse.reverse()

  // Scale if needed
  if (carrierScale > 1) {
    carrier = scaleRhythm(carrier, carrierScale)
  }
  if (impulseScale > 1) {
    impulse = scaleRhythm(impulse, impulseScale)
  }

  // Ensure same length by padding/truncating
  const maxLen = Math.max(carrier.length, impulse.length)
  if (carrier.length < maxLen) {
    const padded = new BinaryRhythm(maxLen)
    for (let i = 0; i < carrier.length; i++) {
      padded.set(i, carrier.get(i))
    }
    carrier = padded
  }
  if (impulse.length < maxLen) {
    const padded = new BinaryRhythm(maxLen)
    for (let i = 0; i < impulse.length; i++) {
      padded.set(i, impulse.get(i))
    }
    impulse = padded
  }

  // Perform convolution
  const result = xorCircularConvolution(carrier, impulse)

  // Convert back to string
  const resultString = binaryRhythmToGroupedString(result, params.mode, denominator)

  return {
    result: resultString,
    carrierLength: carrier.length,
    impulseLength: impulse.length,
    resultLength: result.length,
    onsets: result.countOnsets()
  }
}
