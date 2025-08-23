import { describe, it, expect } from 'vitest'
import { canonicalContourForBits } from './contour'

function bitsFromString(s: string): Uint8Array {
  return new Uint8Array([...s].map((c) => (c === '1' ? 1 : 0)))
}

describe('canonicalContourForBits', () => {
  it('returns empty contour for no or single onset (linear)', () => {
    expect(
      canonicalContourForBits(bitsFromString('0000'), {
        circular: false,
        rotationInvariant: true,
        reflectionInvariant: true
      })
    ).toBe('')
    expect(
      canonicalContourForBits(bitsFromString('1000'), {
        circular: false,
        rotationInvariant: true,
        reflectionInvariant: true
      })
    ).toBe('')
  })

  it('computes contour based on IOI comparisons', () => {
    // 101010 -> onsets at 0,2,4 ; circular intervals [2,2,2] -> SSS
    const bits = bitsFromString('101010')
    const linear = canonicalContourForBits(bits, {
      circular: false,
      rotationInvariant: false,
      reflectionInvariant: false
    })
    const circular = canonicalContourForBits(bits, {
      circular: true,
      rotationInvariant: false,
      reflectionInvariant: false
    })
    expect(linear).toBe('')
    expect(circular).toBe('SSS')
  })

  it('is rotation invariant when enabled', () => {
    const a = bitsFromString('10010010') // onsets 0,3,6
    const b = bitsFromString('01001001') // a rotation
    const ca = canonicalContourForBits(a, {
      circular: true,
      rotationInvariant: true,
      reflectionInvariant: false
    })
    const cb = canonicalContourForBits(b, {
      circular: true,
      rotationInvariant: true,
      reflectionInvariant: false
    })
    expect(ca).toBe(cb)
  })

  it('reflection invariance affects canonicalization', () => {
    const a = bitsFromString('10001001')
    const ca = canonicalContourForBits(a, {
      circular: true,
      rotationInvariant: true,
      reflectionInvariant: false
    })
    const cb = canonicalContourForBits(a, {
      circular: true,
      rotationInvariant: true,
      reflectionInvariant: true
    })
    expect(cb <= ca).toBe(true)
  })
})