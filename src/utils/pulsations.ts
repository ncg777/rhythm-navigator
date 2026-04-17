import { bitsPerDigitForMode, countOnsets, type Mode, type RhythmItem } from '@/utils/rhythm'
import { canonicalContourFromOnsets } from '@/utils/contour'
import { groupDigits, makeEncTable } from '@/utils/relations'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PulsationInputSet = {
  /** Space-separated integers, e.g. "4 4 4 4". Must be positive. */
  composition: string
  /** Space-separated H or T tokens, e.g. "H T H T". Cycles if shorter than composition. */
  headTails: string
  /** Space-separated non-negative integers (pulse spacing). Cycles if shorter. */
  durations: string
  /** Space-separated non-negative integers (pulse count per segment). Cycles if shorter. */
  multiples: string
}

export type PulsationError = {
  field: 'composition' | 'headTails' | 'durations' | 'multiples' | 'mode'
  message: string
}

export type PulsationResult =
  | { ok: true; item: RhythmItem }
  | { ok: false; errors: PulsationError[] }

// ─── Parsing helpers ──────────────────────────────────────────────────────────

function parseIntList(s: string): number[] | null {
  const parts = s.trim().split(/\s+/)
  if (parts.length === 0 || (parts.length === 1 && parts[0] === '')) return null
  const nums = parts.map(Number)
  if (nums.some(isNaN)) return null
  return nums
}

function parseHOrT(s: string): string[] | null {
  const parts = s.trim().toUpperCase().split(/\s+/)
  if (parts.length === 0 || (parts.length === 1 && parts[0] === '')) return null
  if (parts.some((p) => p !== 'H' && p !== 'T')) return null
  return parts
}

// ─── Core build ───────────────────────────────────────────────────────────────

/**
 * Build a single pulsation rhythm from validated numeric inputs.
 *
 * Algorithm (ported from Java Pulsations):
 *   - Create a zero bit-array of length sum(composition).
 *   - For each segment i in composition:
 *     - Get direction (H=head / T=tail), duration d, multiplicity m (cycling shorter arrays).
 *     - Place m pulses spaced d apart:
 *         Head: positions acc + j*d  (j = 0..m-1)
 *         Tail: positions acc + c - (j+1)*d  (j = 0..m-1)
 *     - Advance accumulator by c = composition[i].
 *   - Convert bit-array → digit array for current mode → RhythmItem.
 */
export function buildPulsationRhythm(
  composition: number[],
  headTails: string[],
  durations: number[],
  multiples: number[],
  mode: Mode,
  numerator: number,
  denominator: number,
  itemIndex = 0
): RhythmItem {
  const totalBits = composition.reduce((s, c) => s + c, 0)
  const bits = new Uint8Array(totalBits)

  let acc = 0
  for (let i = 0; i < composition.length; i++) {
    const c = composition[i]
    const isTail = headTails[i % headTails.length] === 'T'
    const d = durations[i % durations.length]
    const m = multiples[i % multiples.length]

    for (let j = 0; j < m; j++) {
      const pos = isTail ? acc + c - (j + 1) * d : acc + j * d
      bits[pos] = 1
    }

    acc += c
  }

  // Convert bits → digit values
  const bpd = bitsPerDigitForMode(mode)
  const numDigits = totalBits / bpd
  const digits: number[] = new Array(numDigits)
  for (let i = 0; i < numDigits; i++) {
    let v = 0
    for (let b = 0; b < bpd; b++) {
      v = (v << 1) | bits[i * bpd + b]
    }
    digits[i] = v
  }

  // Build onsets list
  const onsets: number[] = []
  for (let i = 0; i < totalBits; i++) {
    if (bits[i]) onsets.push(i)
  }

  const encTable = makeEncTable(mode)
  const groupedDigitsString = groupDigits(digits, encTable, denominator)
  const canonicalOpts = { circular: true, rotationInvariant: true, reflectionInvariant: true }

  return {
    id: `pulsation:${mode}:${groupedDigitsString}:${itemIndex}`,
    base: mode,
    groupedDigitsString,
    onsets: countOnsets(new Uint8Array(bits)),
    canonicalContour: canonicalContourFromOnsets(onsets, totalBits, canonicalOpts),
    numerator,
    denominator,
    digits
  }
}

// ─── Validation + single-item build ──────────────────────────────────────────

/**
 * Validate and build one pulsation rhythm from string inputs.
 */
export function buildPulsationFromStrings(
  inputs: PulsationInputSet,
  mode: Mode,
  numerator: number,
  denominator: number,
  itemIndex = 0
): PulsationResult {
  const errors: PulsationError[] = []

  const composition = parseIntList(inputs.composition)
  if (!composition || composition.length === 0) {
    errors.push({ field: 'composition', message: 'Must be space-separated positive integers.' })
  } else if (composition.some((c) => c <= 0 || !Number.isInteger(c))) {
    errors.push({ field: 'composition', message: 'All values must be positive integers.' })
  }

  const headTails = parseHOrT(inputs.headTails)
  if (!headTails || headTails.length === 0) {
    errors.push({ field: 'headTails', message: 'Must be space-separated H or T tokens.' })
  }

  const durations = parseIntList(inputs.durations)
  if (!durations || durations.length === 0) {
    errors.push({ field: 'durations', message: 'Must be space-separated non-negative integers.' })
  } else if (durations.some((d) => d < 0 || !Number.isInteger(d))) {
    errors.push({ field: 'durations', message: 'Periods must be non-negative integers.' })
  }

  const multiples = parseIntList(inputs.multiples)
  if (!multiples || multiples.length === 0) {
    errors.push({ field: 'multiples', message: 'Must be space-separated non-negative integers.' })
  } else if (multiples.some((m) => m < 0 || !Number.isInteger(m))) {
    errors.push({ field: 'multiples', message: 'Multiples must be non-negative integers.' })
  }

  if (errors.length > 0) return { ok: false, errors }

  // Cross-field validation
  const comp = composition!
  const dur = durations!
  const mult = multiples!

  for (let i = 0; i < comp.length; i++) {
    const d = dur[i % dur.length]
    const m = mult[i % mult.length]
    if (m * d > comp[i]) {
      errors.push({
        field: 'multiples',
        message: `Segment ${i + 1}: duration×multiple (${d}×${m}=${d * m}) must not exceed composition element (${comp[i]}).`
      })
    }
  }

  const totalBits = comp.reduce((s, c) => s + c, 0)
  const bpd = bitsPerDigitForMode(mode)
  if (totalBits % bpd !== 0) {
    errors.push({
      field: 'mode',
      message: `Composition sum (${totalBits} bits) must be divisible by ${bpd} for ${mode} mode.`
    })
  }

  if (errors.length > 0) return { ok: false, errors }

  // Derive numerator from total bits if not matching
  const resolvedNumerator = numerator > 0 ? numerator : Math.ceil(totalBits / (denominator * bpd))

  const item = buildPulsationRhythm(
    comp,
    headTails!,
    dur,
    mult,
    mode,
    resolvedNumerator,
    denominator,
    itemIndex
  )
  return { ok: true, item }
}

// ─── Cartesian product ────────────────────────────────────────────────────────

/**
 * Expand comma-separated alternatives in each field into all combinations.
 * E.g. if composition has 2 alternatives and headTails has 3, returns 6 input sets.
 */
export function expandCartesian(inputs: PulsationInputSet): PulsationInputSet[] {
  const splitAlts = (s: string) =>
    s
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)

  const compAlts = splitAlts(inputs.composition)
  const htAlts = splitAlts(inputs.headTails)
  const durAlts = splitAlts(inputs.durations)
  const multAlts = splitAlts(inputs.multiples)

  const result: PulsationInputSet[] = []
  for (const composition of compAlts) {
    for (const headTails of htAlts) {
      for (const durations of durAlts) {
        for (const multiples of multAlts) {
          result.push({ composition, headTails, durations, multiples })
        }
      }
    }
  }
  return result
}

/**
 * Build all rhythm items from a (potentially multi-alternative) input set.
 * Returns a mix of successful items and validation errors per combination.
 */
export function buildAllPulsations(
  inputs: PulsationInputSet,
  mode: Mode,
  numerator: number,
  denominator: number
): { items: RhythmItem[]; errors: string[] } {
  const combos = expandCartesian(inputs)
  const items: RhythmItem[] = []
  const errors: string[] = []

  combos.forEach((combo, idx) => {
    const result = buildPulsationFromStrings(combo, mode, numerator, denominator, idx)
    if (result.ok) {
      items.push(result.item)
    } else {
      const label =
        combos.length > 1
          ? `Combo ${idx + 1} (${combo.composition} / ${combo.headTails} / ${combo.durations} / ${combo.multiples}): `
          : ''
      errors.push(...result.errors.map((e) => label + e.message))
    }
  })

  return { items, errors }
}
