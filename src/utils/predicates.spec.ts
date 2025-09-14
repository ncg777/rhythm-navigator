import { describe, it, expect } from 'vitest'
import { circularIntervals, isMaximallyEven } from './predicates'

describe('circularIntervals', () => {
  it('returns empty array for empty onsets', () => {
    expect(circularIntervals([], 16)).toEqual([])
  })

  it('returns empty array for single onset', () => {
    expect(circularIntervals([0], 16)).toEqual([])
  })

  it('calculates intervals for two onsets', () => {
    // Onsets at 0 and 8 in a 16-unit cycle
    expect(circularIntervals([0, 8], 16)).toEqual([8, 8])
  })

  it('calculates intervals for evenly spaced onsets', () => {
    // Three onsets evenly spaced: 0, 5, 10 in 15-unit cycle
    expect(circularIntervals([0, 5, 10], 15)).toEqual([5, 5, 5])
  })

  it('calculates intervals for non-evenly spaced onsets', () => {
    // Onsets at 0, 3, 7 in 12-unit cycle
    // Intervals: 0->3 = 3, 3->7 = 4, 7->0 = 5
    expect(circularIntervals([0, 3, 7], 12)).toEqual([3, 4, 5])
  })

  it('handles wrap-around correctly', () => {
    // Onsets at 2, 14 in 16-unit cycle
    // Intervals: 2->14 = 12, 14->2 = 4 (wraps around)
    expect(circularIntervals([2, 14], 16)).toEqual([12, 4])
  })

  it('handles complex rhythm pattern', () => {
    // Son clave pattern in 16 units: onsets at 0, 3, 6, 10, 12
    const onsets = [0, 3, 6, 10, 12]
    const intervals = circularIntervals(onsets, 16)
    expect(intervals).toEqual([3, 3, 4, 2, 4])
    expect(intervals.reduce((sum, interval) => sum + interval, 0)).toBe(16)
  })
})

describe('isMaximallyEven', () => {
  it('returns false for empty onsets', () => {
    expect(isMaximallyEven([], 16)).toBe(false)
  })

  it('returns true for single onset', () => {
    expect(isMaximallyEven([0], 16)).toBe(true)
    expect(isMaximallyEven([5], 12)).toBe(true)
  })

  it('returns true for perfectly even spacing', () => {
    // Two onsets, 8 units apart in 16-unit cycle
    expect(isMaximallyEven([0, 8], 16)).toBe(true)
    
    // Three onsets, evenly spaced
    expect(isMaximallyEven([0, 5, 10], 15)).toBe(true)
    
    // Four onsets, evenly spaced
    expect(isMaximallyEven([0, 4, 8, 12], 16)).toBe(true)
  })

  it('returns true for maximally even but not perfectly even spacing', () => {
    // 3 onsets in 8 units: floor(8/3)=2, ceil(8/3)=3, 8%3=2 ceil intervals expected
    // Valid pattern: [2,3,3] or rotations
    expect(isMaximallyEven([0, 2, 5], 8)).toBe(true)
    
    // 5 onsets in 12 units: floor(12/5)=2, ceil(12/5)=3, 12%5=2 ceil intervals expected  
    // Valid pattern: intervals [2,2,3,2,3] or rotations
    expect(isMaximallyEven([0, 2, 4, 7, 9], 12)).toBe(true)
  })

  it('returns false for non-maximally even spacing', () => {
    // Intervals [1,7,8] - contains values other than floor=5 and ceil=6
    expect(isMaximallyEven([0, 1, 8], 16)).toBe(false)
    
    // Example: 4 onsets in 14 units - floor(14/4)=3, ceil(14/4)=4, 14%4=2
    // So we need exactly 2 intervals of size 4 and 2 intervals of size 3
    // But [0,3,6,10] gives intervals [3,3,4,4] which is correct
    // Let's use [0,2,6,10] which gives [2,4,4,4] - wrong because 2 ≠ floor(3) or ceil(4)
    expect(isMaximallyEven([0, 2, 6, 10], 14)).toBe(false)
  })

  it('handles Euclidean rhythms correctly', () => {
    // E(3,8) - 3 onsets in 8 units - classic Euclidean rhythm
    // Should have intervals [3,2,3] or rotations thereof
    expect(isMaximallyEven([0, 3, 5], 8)).toBe(true)
    
    // E(5,8) - 5 onsets in 8 units
    // Should have intervals [2,1,2,1,2] or rotations - but this would have interval 1 which isn't floor(8/5)=1 or ceil(8/5)=2
    // Actually floor(8/5)=1, ceil(8/5)=2, 8%5=3, so we need 3 intervals of size 2 and 2 intervals of size 1
    expect(isMaximallyEven([0, 1, 3, 4, 6], 8)).toBe(true)
    
    // E(5,12) - 5 onsets in 12 units
    // floor(12/5)=2, ceil(12/5)=3, 12%5=2, so we need 2 intervals of size 3 and 3 intervals of size 2
    expect(isMaximallyEven([0, 2, 4, 7, 9], 12)).toBe(true)
  })

  it('verifies interval sum equals total length', () => {
    const testCases = [
      { onsets: [0, 3, 5], L: 8 },
      { onsets: [0, 2, 4, 7, 9], L: 12 },
      { onsets: [0, 1, 3, 4, 6], L: 8 }
    ]
    
    testCases.forEach(({ onsets, L }) => {
      const intervals = circularIntervals(onsets, L)
      const sum = intervals.reduce((acc, interval) => acc + interval, 0)
      expect(sum).toBe(L)
    })
  })

  it('handles edge case where L is not evenly divisible by k', () => {
    // 7 onsets in 16 units: floor(16/7)=2, ceil(16/7)=3, 16%7=2
    // Need 2 intervals of size 3 and 5 intervals of size 2
    // Total: 2*3 + 5*2 = 6 + 10 = 16 ✓
    const intervals = [2, 2, 3, 2, 2, 3, 2] // sums to 16
    const onsets = [0, 2, 4, 7, 9, 11, 14]
    expect(isMaximallyEven(onsets, 16)).toBe(true)
  })
})