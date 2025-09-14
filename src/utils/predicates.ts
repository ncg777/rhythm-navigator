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

/**
 * Reverse triangular number: largest k such that k*(k+1)/2 <= n.
 */
function reverseTriangularNumber(n: number): number {
  if (n <= 0) return 0
  return Math.floor((Math.sqrt(1 + 8 * n) - 1) / 2)
}

/**
 * Shannon entropy (natural log) of a multiset given by an array of integers.
 * Values are used only for equality classes; probabilities are counts/size.
 */
function entropyOf(values: number[]): number {
  const N = values.length
  if (N === 0) return 0
  const freq = new Map<number, number>()
  for (const v of values) freq.set(v, (freq.get(v) ?? 0) + 1)
  let h = 0
  for (const [, c] of freq) {
    const p = c / N
    h += p * Math.log(p)
  }
  return h === 0 ? 0 : -h
}

/**
 * Low-entropy predicate inspired by the provided Java implementation.
 *
 * - Build the circular IOI sequence (a composition of total length L).
 * - Compute Shannon entropy of the IOI value distribution.
 * - Compare h against ln(reverseTriangularNumber(L) * 0.5).
 */
const lowEntropyBoundCache = new Map<number, number>()

export function isLowEntropy(onsets: number[], L: number): boolean {
  if (onsets.length < 2) {
    // With <2 onsets, intervals are undefined; follow Java behavior: entropy 0 < bound (likely true for typical L)
    let bound = lowEntropyBoundCache.get(L)
    if (bound === undefined) {
      bound = Math.log(reverseTriangularNumber(L) * 0.5)
      lowEntropyBoundCache.set(L, bound)
    }
    return 0 < bound
  }
  const intervals = circularIntervals(onsets, L)
  const h = entropyOf(intervals)
  let bound = lowEntropyBoundCache.get(L)
  if (bound === undefined) {
    bound = Math.log(reverseTriangularNumber(L) * 0.5)
    lowEntropyBoundCache.set(L, bound)
  }
  return h < bound
}

/**
 * Interval vector per Java reference (circular):
 * For i = 1..floor(L/2), count positions j such that onset[j] && onset[(j+i) % L].
 * When L is even and i == L/2, halve the count (each antipodal pair would be counted twice).
 * Returns array of length m = floor(L/2), index i-1 corresponds to interval i.
 */
export function intervalVector(onsets: number[], L: number): number[] {
  const m = Math.floor(L / 2)
  if (m <= 0) return []
  const vec = new Array<number>(m).fill(0)
  const flags = new Uint8Array(L)
  for (const p of onsets) {
    if (p >= 0 && p < L) flags[p] = 1
  }
  for (let i = 1; i <= m; i++) {
    let k = 0
    for (let j = 0; j < L; j++) {
      if (flags[j] && flags[(j + i) % L]) k++
    }
    if (i === m && L % 2 === 0) k = Math.floor(k / 2)
    vec[i - 1] = k
  }
  return vec
}

/**
 * HasNoGaps: the non-zero entries of the interval vector (IOI histogram) occupy
 * a single consecutive block of indices. Single non-zero bin counts as true.
 */
export function hasNoGaps(onsets: number[], L: number): boolean {
  const vec = intervalVector(onsets, L)
  if (vec.length === 0) return true
  const nzIdx: number[] = []
  for (let i = 0; i < vec.length; i++) if (vec[i] !== 0) nzIdx.push(i)
  if (nzIdx.length <= 1) return true
  for (let i = 0; i < nzIdx.length - 1; i++) {
    if (nzIdx[i + 1] - nzIdx[i] !== 1) return false
  }
  return true
}

/**
 * Binomial coefficient with basic overflow guard.
 */
export function binomial(n: number, k: number): number {
  if (n < 0 || k < 0 || k > n) throw new Error('Invalid n,k for binomial')
  if (k > n - k) k = n - k
  let result = 1
  for (let i = 0; i < k; i++) {
    // JS numbers are floats; skip overflow guard as advisory
    result = (result * (n - i)) / (i + 1)
  }
  return result
}

export function triangularNumber(n: number): number {
  return binomial(n + 1, 2)
}

/**
 * RelativelyFlat: requires HasNoGaps; let a be the interval-vector with zeros removed.
 * Let n = a.size, mean = triangularNumber(k)/n, k = onsets.length.
 * All entries must lie within +/- 50% of the mean.
 */
export function relativelyFlat(onsets: number[], L: number): boolean {
  if (!hasNoGaps(onsets, L)) return false
  const k = onsets.length
  if (k < 1) return false
  const vec = intervalVector(onsets, L)
  const a = vec.filter((v) => v !== 0)
  const n = a.length
  if (n === 0) return false
  const mean = triangularNumber(k) / n
  for (const v of a) {
    if (Math.abs(v - mean) > 0.5 * mean) return false
  }
  return true
}

/**
 * Factors of n (positive divisors).
 */
export function factors(n: number): number[] {
  const out: number[] = []
  for (let i = 1; i * i <= n; i++) {
    if (n % i === 0) {
      out.push(i)
      if (i * i !== n) out.push(n / i)
    }
  }
  return out.sort((a, b) => a - b)
}

/**
 * Ordinal(n): L must be a multiple of n. Reverse the bitstring, split into blocks of size n,
 * every block must be one of the allowed "words" built from factors of n as in the Java code.
 */
const ordinalWordsCache = new Map<number, Set<string>>()

function buildOrdinalWords(n: number): Set<string> {
  const set = new Set<string>()
  const zero = '0'.repeat(n)
  set.add(zero)
  for (const f of factors(n)) {
    const k = Math.floor(n / f)
    for (let i = 1; i <= k; i++) {
      const b = new Array(n).fill(0)
      const brev = new Array(n).fill(0)
      for (let j = 0; j < i; j++) {
        b[j * f] = 1
        const pos = n - (j + 1) * f
        if (pos >= 0 && pos < n) brev[pos] = 1
      }
      set.add(b.join(''))
      set.add(brev.join(''))
    }
  }
  return set
}

export function hasOrdinal(onsets: number[], L: number, n: number): boolean {
  if (n < 2) return false
  if (L % n !== 0) return false
  let words = ordinalWordsCache.get(n)
  if (!words) {
    words = buildOrdinalWords(n)
    ordinalWordsCache.set(n, words)
  }
  // build bitstring of length L
  const bits = new Array(L).fill('0')
  for (const p of onsets) if (p >= 0 && p < L) bits[p] = '1'
  const rev = bits.slice().reverse().join('')
  const blocks = L / n
  for (let i = 0; i < blocks; i++) {
    const sub = rev.slice(i * n, (i + 1) * n)
    if (!words.has(sub)) return false
  }
  return true
}