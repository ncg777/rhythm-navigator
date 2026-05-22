import { describe, expect, it } from 'vitest'
import type { RhythmItem } from './rhythm'
import { computePairwiseMetrics } from './rhythmComparison'

function makeItem(id: string, groupedDigitsString: string): RhythmItem {
  return {
    id,
    base: 'binary',
    groupedDigitsString,
    onsets: groupedDigitsString.replace(/\s+/g, '').split('').filter((digit) => digit === '1').length,
    canonicalContour: '',
    numerator: 4,
    denominator: 1,
  }
}

describe('computePairwiseMetrics', () => {
  it('detects subset relations and shared onset counts', () => {
    const left = makeItem('left', '1010')
    const right = makeItem('right', '1110')

    const metrics = computePairwiseMetrics(left, right)

    expect(metrics.relation).toBe('subset')
    expect(metrics.sharedOnsets).toBe(2)
    expect(metrics.onlyLeftOnsets).toBe(0)
    expect(metrics.onlyRightOnsets).toBe(1)
    expect(metrics.unionOnsets).toBe(3)
  })

  it('marks incompatible bit lengths', () => {
    const left = makeItem('left', '1010')
    const right = makeItem('right', '101010')

    const metrics = computePairwiseMetrics(left, right)

    expect(metrics.relation).toBe('incompatible')
    expect(metrics.totalBits).toBeNull()
  })
})