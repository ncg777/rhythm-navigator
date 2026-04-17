import { describe, it, expect } from 'vitest'
import {
  BinaryRhythm,
  parseBinaryRhythm,
  scaleRhythm,
  xorCircularConvolution,
  binaryRhythmToGroupedString,
  convolveRhythms
} from './convolution'

describe('BinaryRhythm', () => {
  it('should create empty rhythm', () => {
    const rhythm = new BinaryRhythm(8)
    expect(rhythm.length).toBe(8)
    expect(rhythm.countOnsets()).toBe(0)
  })

  it('should set and get bits', () => {
    const rhythm = new BinaryRhythm(8)
    rhythm.set(0, true)
    rhythm.set(3, true)
    rhythm.set(7, true)
    expect(rhythm.get(0)).toBe(true)
    expect(rhythm.get(1)).toBe(false)
    expect(rhythm.get(3)).toBe(true)
    expect(rhythm.get(7)).toBe(true)
    expect(rhythm.countOnsets()).toBe(3)
  })

  it('should reverse rhythm', () => {
    const rhythm = new BinaryRhythm(8)
    rhythm.set(0, true)
    rhythm.set(2, true)
    rhythm.set(7, true)

    const reversed = rhythm.reverse()
    expect(reversed.get(0)).toBe(true)  // was at 7
    expect(reversed.get(5)).toBe(true)  // was at 2
    expect(reversed.get(7)).toBe(true)  // was at 0
  })

  it('should convert to onsets', () => {
    const rhythm = new BinaryRhythm(8)
    rhythm.set(1, true)
    rhythm.set(3, true)
    rhythm.set(5, true)
    expect(rhythm.toOnsets()).toEqual([1, 3, 5])
  })
})

describe('parseBinaryRhythm', () => {
  it('should parse binary mode', () => {
    const rhythm = parseBinaryRhythm('1010 1100', 'binary')
    expect(rhythm.length).toBe(8)
    expect(rhythm.get(0)).toBe(true)
    expect(rhythm.get(1)).toBe(false)
    expect(rhythm.get(2)).toBe(true)
    expect(rhythm.get(3)).toBe(false)
    expect(rhythm.countOnsets()).toBe(4)
  })

  it('should parse hex mode', () => {
    const rhythm = parseBinaryRhythm('F0', 'hex')
    expect(rhythm.length).toBe(8)
    expect(rhythm.get(0)).toBe(true)  // F = 1111
    expect(rhythm.get(1)).toBe(true)
    expect(rhythm.get(2)).toBe(true)
    expect(rhythm.get(3)).toBe(true)
    expect(rhythm.get(4)).toBe(false) // 0 = 0000
    expect(rhythm.get(5)).toBe(false)
    expect(rhythm.get(6)).toBe(false)
    expect(rhythm.get(7)).toBe(false)
  })

  it('should parse octal mode', () => {
    const rhythm = parseBinaryRhythm('70', 'octal')
    expect(rhythm.length).toBe(6)
    expect(rhythm.get(0)).toBe(true)  // 7 = 111
    expect(rhythm.get(1)).toBe(true)
    expect(rhythm.get(2)).toBe(true)
    expect(rhythm.get(3)).toBe(false) // 0 = 000
    expect(rhythm.get(4)).toBe(false)
    expect(rhythm.get(5)).toBe(false)
  })
})

describe('scaleRhythm', () => {
  it('should scale rhythm by 2', () => {
    const rhythm = new BinaryRhythm(4)
    rhythm.set(0, true)
    rhythm.set(2, true)

    const scaled = scaleRhythm(rhythm, 2)
    expect(scaled.length).toBe(8)
    expect(scaled.get(0)).toBe(true)
    expect(scaled.get(2)).toBe(true)
    expect(scaled.get(4)).toBe(true)  // repeat
    expect(scaled.get(6)).toBe(true)  // repeat
  })

  it('should scale rhythm by 3', () => {
    const rhythm = new BinaryRhythm(2)
    rhythm.set(0, true)

    const scaled = scaleRhythm(rhythm, 3)
    expect(scaled.length).toBe(6)
    expect(scaled.get(0)).toBe(true)
    expect(scaled.get(2)).toBe(true)
    expect(scaled.get(4)).toBe(true)
  })

  it('should throw error for non-positive scale', () => {
    const rhythm = new BinaryRhythm(4)
    expect(() => scaleRhythm(rhythm, 0)).toThrow('Scale must be positive')
    expect(() => scaleRhythm(rhythm, -1)).toThrow('Scale must be positive')
  })
})

describe('xorCircularConvolution', () => {
  it('should perform XOR convolution with simple impulse', () => {
    // Carrier: 1010 (positions 0,2)
    const carrier = new BinaryRhythm(4)
    carrier.set(0, true)
    carrier.set(2, true)

    // Impulse: 1000 (position 0 only)
    const impulse = new BinaryRhythm(4)
    impulse.set(0, true)

    const result = xorCircularConvolution(carrier, impulse)
    // Should be same as carrier when impulse has single 1 at position 0
    expect(result.get(0)).toBe(true)
    expect(result.get(2)).toBe(true)
  })

  it('should perform XOR convolution with multiple impulse points', () => {
    // Carrier: 1100
    const carrier = new BinaryRhythm(4)
    carrier.set(0, true)
    carrier.set(1, true)

    // Impulse: 1100
    const impulse = new BinaryRhythm(4)
    impulse.set(0, true)
    impulse.set(1, true)

    const result = xorCircularConvolution(carrier, impulse)
    expect(result.toBits()).toEqual([true, false, true, false])
  })

  it('should rotate the carrier when the impulse is shifted', () => {
    const carrier = parseBinaryRhythm('1010', 'binary')
    const impulse = parseBinaryRhythm('0100', 'binary')

    const result = xorCircularConvolution(carrier, impulse)

    expect(result.toBits()).toEqual([false, true, false, true])
  })

  it('should handle all-zeros impulse', () => {
    const carrier = new BinaryRhythm(4)
    carrier.set(0, true)
    carrier.set(2, true)

    const impulse = new BinaryRhythm(4)

    const result = xorCircularConvolution(carrier, impulse)
    // All zeros impulse should produce all zeros
    expect(result.countOnsets()).toBe(0)
  })

  it('should throw error for mismatched lengths', () => {
    const carrier = new BinaryRhythm(4)
    const impulse = new BinaryRhythm(8)
    expect(() => xorCircularConvolution(carrier, impulse)).toThrow('same length')
  })
})

describe('binaryRhythmToGroupedString', () => {
  it('should convert binary rhythm to binary string', () => {
    const rhythm = new BinaryRhythm(8)
    rhythm.set(0, true)
    rhythm.set(2, true)
    rhythm.set(4, true)
    rhythm.set(6, true)

    const result = binaryRhythmToGroupedString(rhythm, 'binary', 4)
    expect(result).toBe('1010 1010')
  })

  it('should convert binary rhythm to hex string', () => {
    const rhythm = new BinaryRhythm(8)
    rhythm.set(0, true)
    rhythm.set(1, true)
    rhythm.set(2, true)
    rhythm.set(3, true)

    const result = binaryRhythmToGroupedString(rhythm, 'hex', 2)
    expect(result).toBe('F0')
  })

  it('should convert binary rhythm to octal string', () => {
    const rhythm = new BinaryRhythm(6)
    rhythm.set(0, true)
    rhythm.set(1, true)
    rhythm.set(2, true)

    const result = binaryRhythmToGroupedString(rhythm, 'octal', 2)
    expect(result).toBe('70')
  })
})

describe('convolveRhythms', () => {
  it('should convolve two binary rhythms', () => {
    const result = convolveRhythms({
      carrier: '1010 1010',
      impulse: '1000 0000',
      mode: 'binary',
      denominator: 4
    })

    expect(result.resultLength).toBe(8)
    expect(result.result).toBe('1010 1010')
    expect(result.onsets).toBe(4)
  })

  it('should convolve two hex rhythms', () => {
    const result = convolveRhythms({
      carrier: 'F0',
      impulse: '80',
      mode: 'hex',
      denominator: 2
    })

    expect(result.resultLength).toBe(8)
    expect(result.result).toBe('F0')
    expect(result.onsets).toBe(4)
  })

  it('should scale carrier', () => {
    const result = convolveRhythms({
      carrier: '10',
      impulse: '1000',
      mode: 'binary',
      carrierScale: 2,
      denominator: 4
    })

    expect(result.carrierLength).toBe(4) // 2 bits scaled by 2
    expect(result.resultLength).toBe(4)
    expect(result.result).toBe('1010')
  })

  it('should scale impulse', () => {
    const result = convolveRhythms({
      carrier: '1000',
      impulse: '10',
      mode: 'binary',
      impulseScale: 2,
      denominator: 4
    })

    expect(result.impulseLength).toBe(4) // 2 bits scaled by 2
    expect(result.resultLength).toBe(4)
    expect(result.result).toBe('1010')
  })

  it('should scale both carrier and impulse', () => {
    const result = convolveRhythms({
      carrier: '10',
      impulse: '10',
      mode: 'binary',
      carrierScale: 3,
      impulseScale: 2,
      denominator: 4
    })

    expect(result.carrierLength).toBe(6) // 2 bits scaled by 3
    expect(result.impulseLength).toBe(6) // 2 bits scaled by 2, then padded to match carrier
    expect(result.resultLength).toBe(6) // padded to max length
    expect(result.result).toBe('0000 00')
    expect(result.onsets).toBe(0)
  })
})
