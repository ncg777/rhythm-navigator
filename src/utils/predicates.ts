/**
 * Music theory predicates for rhythm analysis.
 * Based on musicological literature, especially Godfried Toussaint's "The Geometry of Musical Rhythm"
 * and the combinatorics-on-words literature on rhythmic oddity properties.
 */

/**
 * Calculate circular Inter-Onset Intervals (IOIs) for given onsets.
 * 
 * @param onsets Array of onset positions (should be sorted and within [0, L))
 * @param L Total length of the rhythm cycle
 * @returns Array of circular intervals between consecutive onsets
 */
export function circularIntervals(onsets: number[], L: number): number[] {
  if (onsets.length < 2) {
    return []
  }

  const intervals: number[] = []
  const n = onsets.length

  for (let i = 0; i < n; i++) {
    const current = onsets[i]
    const next = onsets[(i + 1) % n]
    
    // Calculate circular distance from current to next onset
    const interval = (next - current + L) % L || L
    intervals.push(interval)
  }

  return intervals
}

/**
 * Check if onsets are maximally even (Euclidean spacing).
 * 
 * A rhythm is maximally even if the IOIs are distributed as evenly as possible,
 * meaning they can only take values floor(L/k) and ceil(L/k), where k is the number of onsets.
 * The number of ceil(L/k) intervals should be exactly L % k.
 * 
 * @param onsets Array of onset positions (should be sorted and within [0, L))
 * @param L Total length of the rhythm cycle
 * @returns true if the rhythm has maximally even spacing, false otherwise
 */
export function isMaximallyEven(onsets: number[], L: number): boolean {
  if (onsets.length === 0) {
    return false
  }

  if (onsets.length === 1) {
    // Single onset is trivially maximally even
    return true
  }

  const k = onsets.length
  const intervals = circularIntervals(onsets, L)
  
  const floorValue = Math.floor(L / k)
  const ceilValue = Math.ceil(L / k)
  const expectedCeilCount = L % k
  
  // Count occurrences of each interval type
  let floorCount = 0
  let ceilCount = 0
  
  for (const interval of intervals) {
    if (interval === floorValue) {
      floorCount++
    } else if (interval === ceilValue) {
      ceilCount++
    } else {
      // Found an interval that's neither floor nor ceil value
      return false
    }
  }
  
  // Check if the counts match the expected maximally even distribution
  return ceilCount === expectedCeilCount && floorCount === (k - expectedCeilCount)
}

/**
 * Internal helper to detect if any contiguous block of intervals sums to L/2.
 * Uses a sliding window over the doubled interval sequence to handle circular wrapping.
 * 
 * @param intervals Array of intervals
 * @param L Total length
 * @returns true if any contiguous block sums to L/2, false otherwise
 */
function noHalfArc(intervals: number[], L: number): boolean {
  if (L % 2 !== 0) {
    return true // L/2 is not an integer, so no half-arc possible
  }
  
  const halfL = L / 2
  const n = intervals.length
  
  if (n === 0) {
    return true
  }
  
  // Double the intervals array to handle circular wrapping
  const doubled = intervals.concat(intervals)
  
  // Use sliding window to check all possible contiguous sums
  for (let start = 0; start < n; start++) {
    let sum = 0
    for (let len = 1; len < n; len++) { // len < n to avoid checking the full cycle
      sum += doubled[start + len - 1]
      if (sum === halfL) {
        return false // Found a half-arc
      }
      if (sum > halfL) {
        break // No point continuing this window
      }
    }
  }
  
  return true
}

/**
 * Check if rhythm has the Rhythmic Oddity Property (classic {2,3} version).
 * 
 * A rhythm has ROP if:
 * - Total length L is even
 * - All circular IOIs are only 2 or 3
 * - No rotation admits any contiguous block of IOIs summing to L/2
 * 
 * Based on the combinatorics-on-words literature.
 * 
 * @param onsets Array of onset positions (should be sorted and within [0, L))
 * @param L Total length of the rhythm cycle
 * @returns true if rhythm has ROP {2,3}, false otherwise
 */
export function hasROP23(onsets: number[], L: number): boolean {
  if (onsets.length < 2) {
    return false
  }
  
  if (L % 2 !== 0) {
    return false // L must be even
  }
  
  const intervals = circularIntervals(onsets, L)
  
  // Check that all intervals are 2 or 3
  for (const interval of intervals) {
    if (interval !== 2 && interval !== 3) {
      return false
    }
  }
  
  // Check no half-arc property
  return noHalfArc(intervals, L)
}

/**
 * Check if rhythm has odd-intervals oddity property.
 * 
 * A rhythm has this property if:
 * - Total length L is even
 * - All circular IOIs are odd integers
 * - No contiguous block of IOIs (wrapping allowed) sums to L/2
 * 
 * @param onsets Array of onset positions (should be sorted and within [0, L))
 * @param L Total length of the rhythm cycle
 * @returns true if rhythm has odd-intervals oddity, false otherwise
 */
export function hasOddIntervalsOddity(onsets: number[], L: number): boolean {
  if (onsets.length < 2) {
    return false
  }
  
  if (L % 2 !== 0) {
    return false // L must be even
  }
  
  const intervals = circularIntervals(onsets, L)
  
  // Check that all intervals are odd
  for (const interval of intervals) {
    if (interval % 2 === 0) {
      return false
    }
  }
  
  // Check no half-arc property
  return noHalfArc(intervals, L)
}

/**
 * Check if rhythm has no antipodal pairs.
 * 
 * When L is even, there should be no pairs of onsets separated by exactly L/2.
 * When L is odd, this is always true (no antipodal points exist).
 * 
 * @param onsets Array of onset positions (should be sorted and within [0, L))
 * @param L Total length of the rhythm cycle
 * @returns true if no antipodal pairs exist, false otherwise
 */
export function noAntipodalPairs(onsets: number[], L: number): boolean {
  if (L % 2 !== 0) {
    return true // No antipodal points when L is odd
  }
  
  const halfL = L / 2
  const onsetSet = new Set(onsets)
  
  for (const onset of onsets) {
    const antipodal = (onset + halfL) % L
    if (onsetSet.has(antipodal)) {
      return false // Found an antipodal pair
    }
  }
  
  return true
}