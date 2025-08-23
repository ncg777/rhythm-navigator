import { describe, it, expect } from 'vitest'
import { digitsToBits, bitsPerDigitForMode, countOnsets } from './rhythm'

describe('digitsToBits big-endian expansion', () => {
  it('binary digits (1 bit per digit)', () => {
    const bits = digitsToBits([1, 0, 1, 1], 'binary')
    expect([...bits]).toEqual([1, 0, 1, 1])
  })

  it('octal digits (3 bits per digit, MSB first)', () => {
    // 1 -> 001, 7 -> 111, 3 -> 011
    const bits = digitsToBits([1, 7, 3], 'octal')
    expect([...bits]).toEqual([0, 0, 1, 1, 1, 1, 0, 1, 1])
  })

  it('hex digits (4 bits per digit, MSB first)', () => {
    // A (10) -> 1010, F (15) -> 1111, 2 -> 0010
    const bits = digitsToBits([0xA, 0xF, 0x2], 'hex')
    expect([...bits]).toEqual([1, 0, 1, 0, 1, 1, 1, 1, 0, 0, 1, 0])
  })

  it('counts onsets correctly', () => {
    const bits = digitsToBits([0xA, 0xF, 0x2], 'hex')
    expect(countOnsets(bits)).toBe(7)
  })

  it('bitsPerDigitForMode matches expectations', () => {
    expect(bitsPerDigitForMode('binary')).toBe(1)
    expect(bitsPerDigitForMode('octal')).toBe(3)
    expect(bitsPerDigitForMode('hex')).toBe(4)
  })
})