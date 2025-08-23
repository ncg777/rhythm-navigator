export type ContourOptions = {
  circular: boolean
  rotationInvariant: boolean
  reflectionInvariant: boolean
}

/**
 * New fast canonical contour: accepts onset positions and total length.
 */
export function canonicalContourFromOnsets(onsets: number[], totalLength: number, opts: ContourOptions): string {
  if (onsets.length < 2) return ''

  // Build interval sequence
  const intervals: number[] = []
  if (opts.circular) {
    const n = onsets.length
    const L = totalLength
    for (let i = 0; i < n; i++) {
      const a = onsets[i]
      const b = onsets[(i + 1) % n]
      const d = (b - a + L) % L || L
      intervals.push(d)
    }
  } else {
    for (let i = 0; i < onsets.length - 1; i++) intervals.push(onsets[i + 1] - onsets[i])
    if (intervals.length < 2) return ''
  }

  const contour = compareSequence(intervals, opts.circular)

  // Canonicalization: rotation and optional reflection invariance
  const candidates: string[] = [contour]
  if (opts.rotationInvariant) {
    candidates.push(...rotations(contour))
  }
  if (opts.reflectionInvariant) {
    const refl = reflectContour(contour)
    candidates.push(refl, ...rotations(refl))
  }
  return minLex(candidates)
}

/**
 * Back-compat wrapper used by tests: converts bits to onsets, then calls the fast function.
 */
export function canonicalContourForBits(bits: Uint8Array, opts: ContourOptions): string {
  const onsets: number[] = []
  for (let i = 0; i < bits.length; i++) if (bits[i]) onsets.push(i)
  return canonicalContourFromOnsets(onsets, bits.length, opts)
}

function compareSequence(intervals: number[], circular: boolean): string {
  const out: string[] = []
  const n = intervals.length
  const limit = circular ? n : n - 1
  for (let i = 0; i < limit; i++) {
    const a = intervals[i]
    const b = intervals[(i + 1) % n]
    out.push(b === a ? 'S' : b > a ? 'U' : 'D')
  }
  return out.join('')
}

function rotations(s: string): string[] {
  const out: string[] = []
  for (let i = 1; i < s.length; i++) out.push(s.slice(i) + s.slice(0, i))
  return out
}

function reflectContour(s: string): string {
  const inv = (c: string) => (c === 'U' ? 'D' : c === 'D' ? 'U' : 'S')
  return s.split('').reverse().map(inv).join('')
}

function minLex(arr: string[]): string {
  let m = arr[0]
  for (const s of arr) if (s < m) m = s
  return m
}