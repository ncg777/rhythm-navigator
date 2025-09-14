import { describe, it, expect } from 'vitest'
import { 
  circularIntervals, 
  isMaximallyEven, 
  hasROP23, 
  hasOddIntervalsOddity, 
  noAntipodalPairs 
} from './predicates'

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

describe('hasROP23', () => {
  it('returns false for empty or single onset', () => {
    expect(hasROP23([], 6)).toBe(false)
    expect(hasROP23([0], 6)).toBe(false)
  })

  it('returns false when L is odd', () => {
    expect(hasROP23([0, 2, 4], 7)).toBe(false)
  })

  it('returns false when intervals are not {2,3}', () => {
    // Intervals [4, 2] - contains 4 which is not 2 or 3
    expect(hasROP23([0, 4], 6)).toBe(false)
  })

  it('returns true for valid ROP {2,3} pattern', () => {
    // L=6, onsets [0,2,4] -> intervals [2,2,2] - all 2s, no half-arc (L/2=3)
    expect(hasROP23([0, 2, 4], 6)).toBe(true)
  })

  it('returns false when half-arc exists', () => {
    // L=10, onsets [0,2,5,8] -> intervals [2,3,3,2]
    // Check if any contiguous sum equals L/2=5: [2,3]=5 ✓ - has half-arc
    expect(hasROP23([0, 2, 5, 8], 10)).toBe(false)
  })

  it('handles complex valid case', () => {
    // L=8, onsets [0,2,5,7] -> intervals [2,3,2,1] - contains 1, so should be false
    expect(hasROP23([0, 2, 5, 7], 8)).toBe(false)
    
    // L=8, onsets [0,3,5] -> intervals [3,2,3] - all {2,3}, check half-arc (L/2=4)
    // No contiguous sum equals 4, so should be true
    expect(hasROP23([0, 3, 5], 8)).toBe(true)
  })
})

describe('hasOddIntervalsOddity', () => {
  it('returns false for empty or single onset', () => {
    expect(hasOddIntervalsOddity([], 8)).toBe(false)
    expect(hasOddIntervalsOddity([0], 8)).toBe(false)
  })

  it('returns false when L is odd', () => {
    expect(hasOddIntervalsOddity([0, 1, 4], 7)).toBe(false)
  })

  it('returns false when any interval is even', () => {
    // Intervals [2, 6] - both even
    expect(hasOddIntervalsOddity([0, 2], 8)).toBe(false)
  })

  it('returns true for valid odd-intervals pattern', () => {
    // L=8, onsets [0,1,4,7] -> intervals [1,3,3,1] - all odd, check half-arc (L/2=4)
    // No contiguous sum equals 4: [1]=1, [3]=3, [3]=3, [1]=1, [1,3]=4 ✓ - has half-arc
    expect(hasOddIntervalsOddity([0, 1, 4, 7], 8)).toBe(false)
    
    // L=8, onsets [0,1,6] -> intervals [1,5,2] - contains even 2, should be false
    expect(hasOddIntervalsOddity([0, 1, 6], 8)).toBe(false)
    
    // L=10, onsets [0,1,6] -> intervals [1,5,4] - contains even 4, should be false
    expect(hasOddIntervalsOddity([0, 1, 6], 10)).toBe(false)
    
    // L=8, onsets [0,3] -> intervals [3,5] - all odd, no contiguous sum = 4, should be true
    expect(hasOddIntervalsOddity([0, 3], 8)).toBe(true)
  })
})

describe('noAntipodalPairs', () => {
  it('returns true when L is odd', () => {
    expect(noAntipodalPairs([0, 1, 2, 3], 7)).toBe(true)
  })

  it('returns true when no antipodal pairs exist', () => {
    // L=8, L/2=4, onsets [0,2] - no onset at 0+4=4 or 2+4=6
    expect(noAntipodalPairs([0, 2], 8)).toBe(true)
  })

  it('returns false when antipodal pairs exist', () => {
    // L=8, L/2=4, onsets [0,4] - 0 and 4 are antipodal
    expect(noAntipodalPairs([0, 4], 8)).toBe(false)
    
    // L=12, L/2=6, onsets [0,3,6,9] - 0 and 6 are antipodal, 3 and 9 are antipodal
    expect(noAntipodalPairs([0, 3, 6, 9], 12)).toBe(false)
  })

  it('handles complex cases', () => {
    // L=16, L/2=8, onsets [0,2,4,6] - check if any pair differs by 8
    // No antipodal pairs: 0+8=8 (not in set), 2+8=10 (not in set), etc.
    expect(noAntipodalPairs([0, 2, 4, 6], 16)).toBe(true)
    
    // L=16, L/2=8, onsets [0,7,8,15] - 0 and 8 are antipodal, 7 and 15 are antipodal
    expect(noAntipodalPairs([0, 7, 8, 15], 16)).toBe(false)
  })
})