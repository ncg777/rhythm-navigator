import { describe, it, expect } from 'vitest'
import {
  buildPulsationRhythm,
  buildPulsationFromStrings,
  buildAllPulsations,
  expandCartesian,
  type PulsationInputSet
} from './pulsations'

// ─── buildPulsationRhythm ─────────────────────────────────────────────────────

describe('buildPulsationRhythm', () => {
  it('places head pulses at correct positions (basic)', () => {
    // composition [4], head/tails [H], duration 1, multiples 2
    // bits 0..3: positions 0 and 1 set => [1,1,0,0]
    const item = buildPulsationRhythm([4], ['H'], [1], [2], 'binary', 1, 4)
    // denominator=4: all 4 digits in one group → "1100"
    expect(item.groupedDigitsString).toBe('1100')
    expect(item.onsets).toBe(2)
  })

  it('places tail pulses from the end of the segment', () => {
    // composition [4], tail, duration 1, multiples 2
    // Tail: pos = acc + c - (j+1)*d = 0+4-(j+1)*1 → j=0:3, j=1:2 → bits 2,3
    const item = buildPulsationRhythm([4], ['T'], [1], [2], 'binary', 1, 4)
    // denominator=4: all 4 digits in one group → "0011"
    expect(item.groupedDigitsString).toBe('0011')
    expect(item.onsets).toBe(2)
  })

  it('handles multiple segments with cycling head/tails', () => {
    // composition [4,4], headTails [H,T], duration 1, multiples 1
    // seg0 H: pos 0  → bit 0
    // seg1 T: pos acc+c-(j+1)*d = 4+4-1=7 → bit 7
    const item = buildPulsationRhythm([4, 4], ['H', 'T'], [1], [1], 'binary', 2, 4)
    // denominator=4: 8 digits in two groups of 4 → "1000 0001"
    expect(item.groupedDigitsString).toBe('1000 0001')
    expect(item.onsets).toBe(2)
  })

  it('produces hex-mode grouped string from 16-bit pattern', () => {
    // composition [4,4,4,4], all H, duration 1, multiples 1
    // Onsets at 0, 4, 8, 12 → binary 1000 1000 1000 1000 → hex 8 8 8 8
    const item = buildPulsationRhythm([4, 4, 4, 4], ['H'], [1], [1], 'hex', 4, 1)
    // denominator=1: each digit is its own group → "8 8 8 8"
    expect(item.groupedDigitsString).toBe('8 8 8 8')
    expect(item.onsets).toBe(4)
    expect(item.base).toBe('hex')
    expect(item.numerator).toBe(4)
    expect(item.denominator).toBe(1)
  })

  it('cycles shorter durations and multiples arrays', () => {
    // composition [4,4], both H, durations [2] (cycles), multiples [1] (cycles)
    // seg0: pos 0; seg1: pos 4
    const item = buildPulsationRhythm([4, 4], ['H', 'H'], [2], [1], 'binary', 2, 4)
    // denominator=4: two groups of 4 → "1000 1000"
    expect(item.groupedDigitsString).toBe('1000 1000')
    expect(item.onsets).toBe(2)
  })

  it('places multiple pulses with duration > 1 (head)', () => {
    // composition [8], H, duration 2, multiples 3
    // positions: 0, 2, 4 → bits 0,2,4 set in 8-bit array → binary 1 0 1 0 1 0 0 0
    const item = buildPulsationRhythm([8], ['H'], [2], [3], 'binary', 1, 8)
    // denominator=8: all 8 digits in one group → "10101000"
    expect(item.groupedDigitsString).toBe('10101000')
    expect(item.onsets).toBe(3)
  })

  it('places multiple pulses with duration > 1 (tail)', () => {
    // composition [8], T, duration 2, multiples 3
    // Tail: positions acc + c - (j+1)*d = 8-(j+1)*2: j=0→6, j=1→4, j=2→2
    // bits 2,4,6 → binary 0 0 1 0 1 0 1 0
    const item = buildPulsationRhythm([8], ['T'], [2], [3], 'binary', 1, 8)
    // denominator=8: all 8 digits in one group → "00101010"
    expect(item.groupedDigitsString).toBe('00101010')
    expect(item.onsets).toBe(3)
  })

  it('stores digits field', () => {
    const item = buildPulsationRhythm([4], ['H'], [1], [1], 'hex', 1, 1)
    expect(item.digits).toBeDefined()
    expect(item.digits!.length).toBe(1) // 4 bits = 1 hex digit
  })
})

// ─── buildPulsationFromStrings ────────────────────────────────────────────────

describe('buildPulsationFromStrings', () => {
  it('builds a valid result from string inputs', () => {
    const result = buildPulsationFromStrings(
      { composition: '4 4 4 4', headTails: 'H H H H', durations: '1', multiples: '1' },
      'hex', 4, 1
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.item.onsets).toBe(4)
    }
  })

  it('returns error for non-positive composition element', () => {
    const result = buildPulsationFromStrings(
      { composition: '4 0 4', headTails: 'H', durations: '1', multiples: '1' },
      'binary', 3, 4
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === 'composition')).toBe(true)
    }
  })

  it('returns error for invalid H/T token', () => {
    const result = buildPulsationFromStrings(
      { composition: '4 4', headTails: 'H X', durations: '1', multiples: '1' },
      'binary', 2, 4
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === 'headTails')).toBe(true)
    }
  })

  it('returns error for negative duration', () => {
    const result = buildPulsationFromStrings(
      { composition: '4', headTails: 'H', durations: '-1', multiples: '1' },
      'binary', 1, 4
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === 'durations')).toBe(true)
    }
  })

  it('cycles within segment when duration*multiple exceeds composition element', () => {
    // d=3, m=2, comp=4: head positions (0*3)%4=0, (1*3)%4=3 → bits 0,3 → "1001"
    const result = buildPulsationFromStrings(
      { composition: '4', headTails: 'H', durations: '3', multiples: '2' },
      'binary', 1, 4
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.item.groupedDigitsString).toBe('1001')
      expect(result.item.onsets).toBe(2)
    }
  })

  it('returns mode error when composition sum not divisible by bitsPerDigit', () => {
    // 5 bits, hex mode (bpd=4): 5 % 4 !== 0
    const result = buildPulsationFromStrings(
      { composition: '5', headTails: 'H', durations: '1', multiples: '1' },
      'hex', 1, 5
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === 'mode')).toBe(true)
    }
  })
})

// ─── expandCartesian ──────────────────────────────────────────────────────────

describe('expandCartesian', () => {
  it('single alternatives — returns one combo', () => {
    const inputs: PulsationInputSet = {
      composition: '4 4',
      headTails: 'H H',
      durations: '1',
      multiples: '2'
    }
    const combos = expandCartesian(inputs)
    expect(combos).toHaveLength(1)
    expect(combos[0]).toEqual(inputs)
  })

  it('two alternatives in composition — returns 2 combos', () => {
    const combos = expandCartesian({
      composition: '4 4, 8',
      headTails: 'H',
      durations: '1',
      multiples: '1'
    })
    expect(combos).toHaveLength(2)
    expect(combos[0].composition).toBe('4 4')
    expect(combos[1].composition).toBe('8')
  })

  it('2×2 alternatives produce 4 combos (cartesian product)', () => {
    const combos = expandCartesian({
      composition: '4 4, 8',
      headTails: 'H, T',
      durations: '1',
      multiples: '1'
    })
    expect(combos).toHaveLength(4)
  })

  it('2×2×2×2 — 16 combos', () => {
    const combos = expandCartesian({
      composition: '4, 8',
      headTails: 'H, T',
      durations: '1, 2',
      multiples: '1, 2'
    })
    expect(combos).toHaveLength(16)
  })
})

// ─── buildAllPulsations ───────────────────────────────────────────────────────

describe('buildAllPulsations', () => {
  it('produces correct number of items for 2 valid alternatives', () => {
    const result = buildAllPulsations(
      { composition: '4 4 4 4, 8 8', headTails: 'H', durations: '1', multiples: '1' },
      'hex', 4, 1
    )
    expect(result.items).toHaveLength(2)
    expect(result.errors).toHaveLength(0)
  })

  it('separates valid and invalid combos', () => {
    // "4" valid (hex 4 bits); "5" invalid (not divisible by 4 for hex)
    const result = buildAllPulsations(
      { composition: '4, 5', headTails: 'H', durations: '1', multiples: '1' },
      'hex', 1, 1
    )
    expect(result.items).toHaveLength(1)
    expect(result.errors).toHaveLength(1)
  })
})
