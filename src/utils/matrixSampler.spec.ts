import { describe, it, expect } from 'vitest'
import { sampleRhythmMatrices, type MatrixSamplerParams } from './matrixSampler'

describe('sampleRhythmMatrices', () => {
  it('returns empty result when maxAttempts is very small', () => {
    const result = sampleRhythmMatrices({
      mode: 'binary',
      numerator: 4,
      denominator: 1,
      rowCount: 2,
      columnCount: 2,
      maxResults: 10,
      maxAttempts: 1,
      maxCellRetries: 2
    })
    expect(result.attempts).toBeLessThanOrEqual(1)
    expect(result.matrices.length).toBeLessThanOrEqual(1)
  })

  it('generates matrices in binary mode without predicates', () => {
    const result = sampleRhythmMatrices({
      mode: 'binary',
      numerator: 4,
      denominator: 1,
      rowCount: 2,
      columnCount: 3,
      maxResults: 5,
      maxAttempts: 10_000,
      maxCellRetries: 50
    })
    expect(result.matrices.length).toBeGreaterThanOrEqual(1)
    expect(result.matrices.length).toBeLessThanOrEqual(5)
    for (const m of result.matrices) {
      expect(m).toMatch(/^# Matrix \d+/)
      // Should have 2 rows of cell content
      const lines = m.split('\n')
      expect(lines.length).toBe(3) // header + 2 rows
    }
  })

  it('generates matrices in hex mode without predicates', () => {
    const result = sampleRhythmMatrices({
      mode: 'hex',
      numerator: 4,
      denominator: 1,
      rowCount: 3,
      columnCount: 4,
      maxResults: 3,
      maxAttempts: 10_000,
      maxCellRetries: 100
    })
    expect(result.matrices.length).toBeGreaterThanOrEqual(1)
    for (const m of result.matrices) {
      const lines = m.split('\n')
      expect(lines.length).toBe(4) // header + 3 rows
    }
  })

  it('deduplicates emitted matrices', () => {
    const result = sampleRhythmMatrices({
      mode: 'binary',
      numerator: 2,
      denominator: 1,
      rowCount: 1,
      columnCount: 2,
      maxResults: 20,
      maxAttempts: 50_000,
      maxCellRetries: 100
    })
    // All matrices should be unique
    const keys = new Set(result.matrices)
    expect(keys.size).toBe(result.matrices.length)
  })

  it('respects maxResults', () => {
    const result = sampleRhythmMatrices({
      mode: 'hex',
      numerator: 4,
      denominator: 1,
      rowCount: 2,
      columnCount: 2,
      maxResults: 3,
      maxAttempts: 100_000,
      maxCellRetries: 100
    })
    expect(result.matrices.length).toBeLessThanOrEqual(3)
  })

  it('enforces predicate on individual cells (noGaps)', () => {
    // noGaps requires all onsets to be contiguous (no gaps in the bit pattern)
    // We run with enough attempts so results are likely, and verify each cell's onsets are contiguous
    const result = sampleRhythmMatrices({
      mode: 'binary',
      numerator: 4,
      denominator: 1,
      rowCount: 2,
      columnCount: 2,
      maxResults: 3,
      maxAttempts: 100_000,
      maxCellRetries: 200,
      predicateExpression: {
        type: 'and',
        children: [{ type: 'predicate', id: 'noGaps' }]
      }
    })
    for (const matrix of result.matrices) {
      const lines = matrix.split('\n').slice(1) // skip "# Matrix N" header
      for (const line of lines) {
        const cells = line.split(' ')
        for (const cell of cells) {
          // Each cell is a binary string of length numerator*denominator = 4
          // noGaps means the 1s form a contiguous block (no 0 between two 1s)
          const bits = cell.split('').map(Number)
          const onBits = bits.filter(b => b === 1).length
          // Find first and last 1
          if (onBits === 0 || onBits === bits.length) continue
          const first = bits.indexOf(1)
          const last = bits.lastIndexOf(1)
          // All bits between first and last should be 1 (no gap)
          for (let i = first; i <= last; i++) {
            expect(bits[i]).toBe(1)
          }
        }
      }
    }
  })

  it('works with predicate expression (isomorphic)', () => {
    const result = sampleRhythmMatrices({
      mode: 'hex',
      numerator: 4,
      denominator: 1,
      rowCount: 2,
      columnCount: 2,
      maxResults: 2,
      maxAttempts: 50_000,
      maxCellRetries: 200,
      predicateExpression: {
        type: 'and',
        children: [{ type: 'predicate', id: 'isomorphic' }]
      }
    })
    // Should still be able to find some results
    expect(result.emitted).toBe(result.matrices.length)
  })
})
