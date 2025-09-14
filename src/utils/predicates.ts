/**
 * Music theory predicates for rhythm analysis.
 * Based on musicological literature, especially Godfried Toussaint's work on rhythm and combinatorics-on-words.
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