import { describe, expect, it } from 'vitest'
import { buildCombinedDrumSequence, type CombinedSequenceTrack } from './combinedDrumSequence'

function track(
  onsets: number[],
  options: { totalBits?: number; spb?: number; repeats?: number; timeScale?: number } = {}
): CombinedSequenceTrack {
  const totalBits = options.totalBits ?? 4
  const spb = options.spb ?? 4
  return {
    timeScale: options.timeScale ?? 1,
    patterns: [{
      repeats: options.repeats ?? 1,
      pattern: {
        totalBits,
        spb,
        onsets,
        cycleQN: totalBits / spb
      }
    }]
  }
}

describe('buildCombinedDrumSequence', () => {
  it('encodes the first ordered track in the least-significant bit', () => {
    const result = buildCombinedDrumSequence([
      track([0, 2]),
      track([1, 2])
    ])

    expect(result.sequence).toBe('1 2 3 0')
    expect(result.denominator).toBe(4)
    expect(result.loopQuarterNotes).toBe(1)
  })

  it('repeats shorter chains across the shared loop', () => {
    const result = buildCombinedDrumSequence([
      track([0], { totalBits: 2, spb: 2 }),
      track([1], { totalBits: 4, spb: 2 })
    ])

    expect(result.sequence).toBe('1 2 1 0')
    expect(result.denominator).toBe(2)
    expect(result.loopQuarterNotes).toBe(2)
  })

  it('uses the effective grid after applying track time scaling', () => {
    const result = buildCombinedDrumSequence([
      track([0, 1], { totalBits: 2, spb: 2, timeScale: 2 })
    ])

    expect(result.sequence).toBe('1 1')
    expect(result.denominator).toBe(1)
    expect(result.loopQuarterNotes).toBe(2)
  })

  it('returns an empty sequence when no track has a pattern', () => {
    const result = buildCombinedDrumSequence([{ timeScale: 1, patterns: [] }])

    expect(result.sequence).toBe('')
    expect(result.masks).toEqual([])
  })
})