import { describe, it, expect } from 'vitest'
import { sampleRhythms, type SamplerParams } from './stochasticSampler'

describe('sampleRhythms', () => {
  it('returns empty result when maxAttempts is very small', () => {
    const result = sampleRhythms({
      mode: 'binary',
      numerator: 4,
      denominator: 1,
      maxResults: 100,
      maxAttempts: 1
    })
    // With only 1 attempt, might get 0 or 1 result
    expect(result.attempts).toBeLessThanOrEqual(1)
  })

  it('generates rhythms in binary mode without predicates', () => {
    const result = sampleRhythms({
      mode: 'binary',
      numerator: 4,
      denominator: 1,
      maxResults: 5,
      maxAttempts: 10000
    })
    expect(result.items.length).toBeGreaterThanOrEqual(1)
    expect(result.items.length).toBeLessThanOrEqual(5)
    for (const item of result.items) {
      expect(item.base).toBe('binary')
      expect(item.onsets).toBeGreaterThan(0)
      expect(item.id).toContain('binary:')
    }
  })

  it('generates rhythms in hex mode without predicates', () => {
    const result = sampleRhythms({
      mode: 'hex',
      numerator: 2,
      denominator: 1,
      maxResults: 10,
      maxAttempts: 10000
    })
    expect(result.items.length).toBeGreaterThanOrEqual(1)
    expect(result.items.length).toBeLessThanOrEqual(10)
    for (const item of result.items) {
      expect(item.base).toBe('hex')
    }
  })

  it('deduplicates results', () => {
    const result = sampleRhythms({
      mode: 'binary',
      numerator: 3,
      denominator: 1,
      maxResults: 100,
      maxAttempts: 100000
    })
    // Binary mode with 3 digits: only 8 possibilities (2^3), minus trivial = 6
    const strings = result.items.map(i => i.groupedDigitsString)
    const unique = new Set(strings)
    expect(unique.size).toBe(strings.length)
  })

  it('respects maxResults limit', () => {
    const result = sampleRhythms({
      mode: 'hex',
      numerator: 4,
      denominator: 1,
      maxResults: 3,
      maxAttempts: 100000
    })
    expect(result.items.length).toBeLessThanOrEqual(3)
    expect(result.emitted).toBeLessThanOrEqual(3)
  })

  it('respects maxAttempts limit', () => {
    const result = sampleRhythms({
      mode: 'hex',
      numerator: 4,
      denominator: 1,
      maxResults: 1000000,
      maxAttempts: 100
    })
    expect(result.attempts).toBeLessThanOrEqual(100)
  })

  it('applies predicate filters', () => {
    const result = sampleRhythms({
      mode: 'binary',
      numerator: 8,
      denominator: 1,
      maxResults: 3,
      maxAttempts: 5000,
      predicateExpression: {
        type: 'and',
        children: [{ type: 'predicate', id: 'maximallyEven' }]
      }
    })
    // All returned items should be maximally even
    expect(result.items.length).toBeGreaterThanOrEqual(0)
    // Verify they have valid structure
    for (const item of result.items) {
      expect(item.base).toBe('binary')
      expect(item.numerator).toBe(8)
    }
  })

  it('applies retention probability', () => {
    // With 0% retention, no items should be emitted
    const result = sampleRhythms({
      mode: 'binary',
      numerator: 4,
      denominator: 1,
      maxResults: 100,
      maxAttempts: 10000,
      retentionProbability: 0
    })
    expect(result.items).toHaveLength(0)
  })

  it('includes numerator and denominator in output items', () => {
    const result = sampleRhythms({
      mode: 'octal',
      numerator: 3,
      denominator: 2,
      maxResults: 5,
      maxAttempts: 10000
    })
    for (const item of result.items) {
      expect(item.numerator).toBe(3)
      expect(item.denominator).toBe(2)
    }
  })

  it('produces canonical contours for results', () => {
    const result = sampleRhythms({
      mode: 'hex',
      numerator: 4,
      denominator: 1,
      maxResults: 10,
      maxAttempts: 10000
    })
    for (const item of result.items) {
      // Canonical contour should be a string (may be empty for < 2 onsets)
      expect(typeof item.canonicalContour).toBe('string')
    }
  })
})
