import { describe, expect, it } from 'vitest'

import {
  buildBouncedWalk,
  buildCompositionFromOnsets,
  buildCompositionFromRhythm,
  buildFactorLayer,
  buildSymmetryLayer,
  digitsToOnsetPositions,
  generateRhythmDrivenSequence,
  meanAbsoluteDeviation,
  optimizeSegmentation,
  reflectIntoRange,
  rhythmItemToDigits,
  scoreSegmentation,
  Sequence,
} from './rhythmSequence'
import type { RhythmItem } from './rhythm'

describe('rhythmSequence utilities', () => {
  it('parses digits from grouped strings when RhythmItem.digits is absent', () => {
    const item: RhythmItem = {
      id: 'hex:8 4',
      base: 'hex',
      groupedDigitsString: '8 4',
      onsets: 2,
      canonicalContour: 'U'
    }

    expect(rhythmItemToDigits(item)).toEqual([8, 4])
  })

  it('expands digits into onset positions in bit order', () => {
    expect(digitsToOnsetPositions([8, 4], 'hex')).toEqual([0, 5])
  })

  it('builds a circular composition from onset positions', () => {
    expect(buildCompositionFromOnsets([0, 5], 8)).toEqual({
      values: [5, 3],
      totalDuration: 8,
    })
  })

  it('derives composition length from rhythm onset count', () => {
    const item: RhythmItem = {
      id: 'binary:1001',
      base: 'binary',
      groupedDigitsString: '1001',
      onsets: 2,
      canonicalContour: 'U'
    }

    const composition = buildCompositionFromRhythm(item)
    expect(composition.values).toEqual([3, 1])
    expect(composition.values).toHaveLength(item.onsets)
  })

  it('repeats the composition n times when requested', () => {
    const item: RhythmItem = {
      id: 'binary:1001',
      base: 'binary',
      groupedDigitsString: '1001',
      onsets: 2,
      canonicalContour: 'U'
    }

    const composition = buildCompositionFromRhythm(item, 3)
    expect(composition.values).toEqual([3, 1, 3, 1, 3, 1])
    expect(composition.totalDuration).toBe(12)
  })

  it('reflects values back into an inclusive integer range', () => {
    expect(reflectIntoRange(6, -2, 3)).toBe(0)
    expect(reflectIntoRange(-5, -2, 3)).toBe(1)
    expect(reflectIntoRange(3, -2, 3)).toBe(3)
  })

  it('builds bounced positions from integer differences', () => {
    const walk = buildBouncedWalk([2, 2, -5, 4], -1, 3, 0)

    expect(walk.differences).toEqual([2, 0, -1, 0])
    expect(walk.positions).toEqual([2, 2, 1, 1])
    expect(walk.positions.every((value) => value >= -1 && value <= 3)).toBe(true)
  })

  it('returns differences that reconstruct the same bounded walk', () => {
    const walk = buildBouncedWalk([2, 2, -5, 4], -1, 3, 0)
    const replayed: number[] = []
    let current = 0

    for (const difference of walk.differences) {
      current += difference
      replayed.push(current)
    }

    expect(replayed).toEqual(walk.positions)
    expect(replayed.every((value) => value >= -1 && value <= 3)).toBe(true)
  })
})

describe('sequence transforms', () => {
  it('supports reverse, rotate, and flip', () => {
    const seq = new Sequence([1, -2, 3])

    expect(seq.reverse().data).toEqual([3, -2, 1])
    expect(seq.rotate(1).data).toEqual([-2, 3, 1])
    expect(seq.flip(0).data).toEqual([-1, 2, -3])
  })
})

describe('segmentation optimizer', () => {
  it('computes mean absolute deviation', () => {
    expect(meanAbsoluteDeviation([1, 1, 4])).toBeCloseTo(1.333333, 5)
  })

  it('uses the Java segmentation score formula', () => {
    const composition = { values: [1, 1, 4, 4], totalDuration: 10 }
    const oneBlockScore = scoreSegmentation(composition, [
      { start: 0, end: 4, values: [1, 1, 4, 4], mad: meanAbsoluteDeviation([1, 1, 4, 4]) }
    ])
    const splitScore = scoreSegmentation(composition, [
      { start: 0, end: 2, values: [1, 1], mad: 0 },
      { start: 2, end: 4, values: [4, 4], mad: 0 },
    ])

    expect(oneBlockScore).toBe(0)
    expect(splitScore).toBeCloseTo(Math.log10(7), 8)
    expect(splitScore).toBeGreaterThan(oneBlockScore)
  })

  it('keeps a constant composition as one block', () => {
    const result = optimizeSegmentation({ values: [2, 2, 2, 2], totalDuration: 8 })

    expect(result.blocks.map((block) => block.values)).toEqual([[2, 2, 2, 2]])
    expect(result.score).toBe(1)
  })

  it('follows the best refinement branch for repeated stable phrases', () => {
    const result = optimizeSegmentation({ values: [1, 1, 4, 4], totalDuration: 10 })
    expect(result.blocks.map((block) => block.values)).toEqual([[1, 1], [4, 4]])
    expect(result.score).toBeCloseTo(Math.log10(7), 8)
  })
})

describe('layer builders', () => {
  it('reuses symmetry motifs for repeated blocks via transforms', () => {
    const segmentation = {
      blocks: [
        { start: 0, end: 2, values: [1, 1], mad: 0 },
        { start: 2, end: 4, values: [1, 1], mad: 0 },
      ],
      score: 1,
    }
    const rng = () => 0.9
    const built = buildSymmetryLayer(segmentation, 3, rng)

    expect(built.phrases).toHaveLength(segmentation.blocks.length)
    expect(built.phrases[0].values).toHaveLength(2)
    expect(built.phrases[1].transform).toBe('reverse')
    expect(built.phrases[1].values).toEqual([...built.phrases[0].values].reverse())
  })

  it('produces integer factor layers with selected factors', () => {
    const composition = { values: [2, 2, 2, 2], totalDuration: 8 }
    const built = buildFactorLayer(composition, 4, () => 0.1)

    expect(built.selectedFactors.length).toBeGreaterThan(0)
    expect(built.layer).toHaveLength(composition.values.length)
    expect(built.layer.every(Number.isInteger)).toBe(true)
    expect(built.layer.every((value) => Math.abs(value) <= 4)).toBe(true)
  })
})

describe('generateRhythmDrivenSequence', () => {
  it('returns a bounded integer-difference walk whose length matches onset count', () => {
    const item: RhythmItem = {
      id: 'binary:1010 1000',
      base: 'binary',
      groupedDigitsString: '1010 1000',
      onsets: 3,
      canonicalContour: 'UUD'
    }

    const generated = generateRhythmDrivenSequence({
      item,
      min: -3,
      max: 3,
      maxAmplitude: 2,
      rng: () => 0.2,
    })

    expect(generated.composition.values).toHaveLength(item.onsets)
    expect(generated.differences).toHaveLength(item.onsets)
    expect(generated.positions).toHaveLength(item.onsets)
    expect(generated.differences.every(Number.isInteger)).toBe(true)
    expect(generated.positions).toEqual(
      generated.differences.reduce<number[]>((acc, difference, index) => {
        const previous = index === 0 ? generated.start : acc[index - 1]
        acc.push(previous + difference)
        return acc
      }, [])
    )
    expect(generated.positions.every((value) => value >= -3 && value <= 3)).toBe(true)
    expect(generated.differences.every((value) => Math.abs(value) <= 2)).toBe(true)
  })

  it('scales the generated sequence length by repeat count', () => {
    const item: RhythmItem = {
      id: 'binary:1010 1000',
      base: 'binary',
      groupedDigitsString: '1010 1000',
      onsets: 3,
      canonicalContour: 'UUD'
    }

    const generated = generateRhythmDrivenSequence({
      item,
      min: -3,
      max: 3,
      maxAmplitude: 2,
      repeatCount: 4,
      rng: () => 0.2,
    })

    expect(generated.composition.values).toHaveLength(item.onsets * 4)
    expect(generated.differences).toHaveLength(item.onsets * 4)
    expect(generated.positions).toHaveLength(item.onsets * 4)
  })
})