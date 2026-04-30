import { describe, it, expect } from 'vitest'
import { sampleRhythmMatrices, sequenceMatrixColumns, type MatrixSamplerParams } from './matrixSampler'

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

describe('sequenceMatrixColumns', () => {
  // A known matrix text block: 2 rows, 3 columns, binary mode (denominator=1 → tokensPerCell=1)
  // "# Matrix 1\n1010 0101 1100\n0011 1001 0110"
  const binaryMatrix = '# Matrix 1\n1010 0101 1100\n0011 1001 0110'

  it('returns all columns in original order', () => {
    const result = sequenceMatrixColumns(binaryMatrix, [0, 1, 2], 3)
    expect(result).toBe(binaryMatrix)
  })

  it('reverses columns', () => {
    const result = sequenceMatrixColumns(binaryMatrix, [2, 1, 0], 3)
    expect(result).toBe('# Matrix 1\n1100 0101 1010\n0110 1001 0011')
  })

  it('selects a subset of columns', () => {
    const result = sequenceMatrixColumns(binaryMatrix, [0, 2], 3)
    expect(result).toBe('# Matrix 1\n1010 1100\n0011 0110')
  })

  it('allows duplicate column indices', () => {
    const result = sequenceMatrixColumns(binaryMatrix, [1, 1], 3)
    expect(result).toBe('# Matrix 1\n0101 0101\n1001 1001')
  })

  it('handles a single column', () => {
    const result = sequenceMatrixColumns(binaryMatrix, [2], 3)
    expect(result).toBe('# Matrix 1\n1100\n0110')
  })

  it('throws on out-of-bounds index', () => {
    expect(() => sequenceMatrixColumns(binaryMatrix, [3], 3)).toThrow(/out of bounds/)
  })

  it('throws on negative index', () => {
    expect(() => sequenceMatrixColumns(binaryMatrix, [-1], 3)).toThrow(/out of bounds/)
  })

  it('throws when row tokens are not divisible by columnCount', () => {
    // "1010 0101 1100" has 3 tokens; not divisible by 2
    expect(() => sequenceMatrixColumns(binaryMatrix, [0, 1], 2)).toThrow(/not divisible/)
  })

  it('handles multi-token cells (denominator > 1)', () => {
    // 2 rows, 2 columns, numerator=2, denominator=2 → each cell has 2 tokens
    // Row format: "AB CD EF GH" where "AB CD" is col 0 and "EF GH" is col 1
    const hexMatrix = '# Matrix 1\nAB CD EF GH\n12 34 56 78'
    const result = sequenceMatrixColumns(hexMatrix, [1, 0], 2)
    expect(result).toBe('# Matrix 1\nEF GH AB CD\n56 78 12 34')
  })

  it('returns original text unchanged when columnIndices is empty and matrix is empty rows', () => {
    const result = sequenceMatrixColumns('# Matrix 1', [0], 0)
    expect(result).toBe('# Matrix 1')
  })

  it('works on a matrix generated by sampleRhythmMatrices', () => {
    const sample = sampleRhythmMatrices({
      mode: 'binary',
      numerator: 4,
      denominator: 1,
      rowCount: 2,
      columnCount: 3,
      maxResults: 1,
      maxAttempts: 10_000,
      maxCellRetries: 50
    })
    expect(sample.matrices.length).toBeGreaterThanOrEqual(1)
    const matText = sample.matrices[0]
    // Applying identity sequence [0,1,2] must return original
    const identity = sequenceMatrixColumns(matText, [0, 1, 2], 3)
    expect(identity).toBe(matText)
    // Applying a sequence and then the inverse must also yield original
    const permuted = sequenceMatrixColumns(matText, [2, 0, 1], 3)
    const restored = sequenceMatrixColumns(permuted, [1, 2, 0], 3)
    expect(restored).toBe(matText)
    // Row count must be preserved
    expect(permuted.split('\n').length).toBe(matText.split('\n').length)
  })
})
