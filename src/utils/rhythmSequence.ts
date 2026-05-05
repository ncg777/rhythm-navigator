import { digitsToBits, type Mode, type RhythmItem } from '@/utils/rhythm'
import { parseDigitsFromGroupedString } from '@/utils/relations'

export type Composition = {
  values: number[]
  totalDuration: number
}

export class Sequence {
  constructor(public readonly data: number[]) {}

  reverse(): Sequence {
    return new Sequence([...this.data].reverse())
  }

  rotate(steps: number): Sequence {
    if (this.data.length === 0) return new Sequence([])
    const length = this.data.length
    const offset = ((steps % length) + length) % length
    if (offset === 0) return new Sequence([...this.data])
    return new Sequence(this.data.slice(offset).concat(this.data.slice(0, offset)))
  }

  flip(pivot = 0): Sequence {
    return new Sequence(this.data.map((value) => pivot - (value - pivot)))
  }
}

export type BouncedWalk = {
  differences: number[]
  positions: number[]
}

export type SegmentBlock = {
  start: number
  end: number
  values: number[]
  mad: number
}

export type SegmentationResult = {
  blocks: SegmentBlock[]
  score: number
}

export type SequenceTransform = 'identity' | 'reverse' | 'rotate' | 'flip'

export type SymmetryPhrase = {
  key: string
  occurrence: number
  transform: SequenceTransform
  values: number[]
}

export type GeneratedSequence = {
  composition: Composition
  segmentation: SegmentationResult
  symmetryLayer: number[]
  factorLayer: number[]
  differences: number[]
  positions: number[]
  phrases: SymmetryPhrase[]
  selectedFactors: number[]
  start: number
}

export type SequenceGeneratorParams = {
  item: RhythmItem
  min: number
  max: number
  maxAmplitude: number
  repeatCount?: number
  rng?: () => number
}

export function rhythmItemToDigits(item: RhythmItem): number[] {
  return item.digits ?? parseDigitsFromGroupedString(item.groupedDigitsString, item.base)
}

export function digitsToOnsetPositions(digits: number[], mode: Mode): number[] {
  const bits = digitsToBits(digits, mode)
  const onsets: number[] = []
  for (let index = 0; index < bits.length; index++) {
    if (bits[index]) onsets.push(index)
  }
  return onsets
}

export function buildCompositionFromOnsets(onsets: number[], totalDuration: number): Composition {
  if (!Number.isInteger(totalDuration) || totalDuration <= 0) {
    throw new Error('Total duration must be a positive integer.')
  }
  if (onsets.length === 0) {
    return { values: [], totalDuration }
  }

  const sorted = [...onsets].sort((left, right) => left - right)
  const values: number[] = []
  for (let index = 0; index < sorted.length; index++) {
    const current = sorted[index]
    const next = sorted[(index + 1) % sorted.length]
    const raw = index === sorted.length - 1 ? next + totalDuration - current : next - current
    values.push(raw)
  }
  return { values, totalDuration }
}

export function buildCompositionFromRhythm(item: RhythmItem, repeatCount = 1): Composition {
  if (!Number.isInteger(repeatCount) || repeatCount <= 0) {
    throw new Error('Repeat count must be a positive integer.')
  }
  const digits = rhythmItemToDigits(item)
  const bits = digitsToBits(digits, item.base)
  const onsets = digitsToOnsetPositions(digits, item.base)
  const baseComposition = buildCompositionFromOnsets(onsets, bits.length)
  if (repeatCount === 1 || baseComposition.values.length === 0) return baseComposition

  const values: number[] = []
  for (let index = 0; index < repeatCount; index++) {
    values.push(...baseComposition.values)
  }

  return {
    values,
    totalDuration: baseComposition.totalDuration * repeatCount,
  }
}

export function reflectIntoRange(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error('Bounce inputs must be finite numbers.')
  }
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    throw new Error('Bounce range must use integers.')
  }
  if (min > max) {
    throw new Error('Bounce range minimum must be less than or equal to the maximum.')
  }
  if (min === max) return min

  const span = max - min
  const period = span * 2
  let normalized = (value - min) % period
  if (normalized < 0) normalized += period
  if (normalized <= span) return min + normalized
  return max - (normalized - span)
}

export function buildBouncedWalk(differences: number[], min: number, max: number, start = min): BouncedWalk {
  const bouncedDifferences: number[] = []
  const positions: number[] = []
  let current = reflectIntoRange(start, min, max)
  for (const difference of differences) {
    const next = reflectIntoRange(current + difference, min, max)
    bouncedDifferences.push(next - current)
    current = next
    positions.push(next)
  }
  return { differences: bouncedDifferences, positions }
}

export function meanAbsoluteDeviation(values: number[]): number {
  if (values.length <= 1) return 0
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const total = values.reduce((sum, value) => sum + Math.abs(value - mean), 0)
  return total / values.length
}

export function scoreSegmentation(composition: Composition, blocks: SegmentBlock[]): number {
  const n = composition.values.length
  if (n <= 1 || blocks.length === 0) return 0

  const totalMad = meanAbsoluteDeviation(composition.values)
  const blockMadSum = blocks.reduce((sum, block) => sum + block.mad, 0)
  const k = blocks.length
  const factor = (n - k) / (n - 1)
  const compression = Math.log10((factor * 9) + 1)
  if (Math.abs(totalMad) < 1e-9) {
    return compression
  }
  return compression * ((totalMad - blockMadSum) / totalMad)
}

export function optimizeSegmentation(composition: Composition): SegmentationResult {
  const values = composition.values
  if (values.length === 0) {
    return { blocks: [], score: 0 }
  }

  const blocks: SegmentBlock[] = []
  let start = 0

  for (let index = 1; index <= values.length; index++) {
    if (index < values.length && values[index] === values[start]) continue

    const blockValues = values.slice(start, index)
    blocks.push({
      start,
      end: index,
      values: blockValues,
      mad: meanAbsoluteDeviation(blockValues),
    })
    start = index
  }

  return {
    blocks,
    score: scoreSegmentation(composition, blocks),
  }
}

function clampDifference(value: number, maxAmplitude: number): number {
  return Math.max(-maxAmplitude, Math.min(maxAmplitude, Math.round(value)))
}

function randomInt(maxExclusive: number, rng: () => number): number {
  return Math.floor(rng() * maxExclusive)
}

function sampleWeightedStep(maxAmplitude: number, rng: () => number): number {
  if (maxAmplitude <= 0) return 0
  const weights: Array<{ value: number; weight: number }> = []
  let totalWeight = 0
  for (let step = -maxAmplitude; step <= maxAmplitude; step++) {
    const weight = step === 0 ? 1 : 1 / Math.abs(step)
    weights.push({ value: step, weight })
    totalWeight += weight
  }
  let cursor = rng() * totalWeight
  for (const entry of weights) {
    cursor -= entry.weight
    if (cursor <= 0) return entry.value
  }
  return 0
}

function factorsOf(n: number): number[] {
  const factors = new Set<number>()
  for (let candidate = 1; candidate * candidate <= n; candidate++) {
    if (n % candidate !== 0) continue
    factors.add(candidate)
    factors.add(n / candidate)
  }
  return [...factors].sort((left, right) => left - right)
}

function pickWeightedUnique(values: number[], count: number, weightOf: (value: number) => number, rng: () => number): number[] {
  const pool = [...values]
  const picked: number[] = []
  while (pool.length > 0 && picked.length < count) {
    const totalWeight = pool.reduce((sum, value) => sum + weightOf(value), 0)
    if (totalWeight <= 0) {
      picked.push(...pool.slice(0, count - picked.length))
      break
    }
    let cursor = rng() * totalWeight
    let chosenIndex = 0
    for (let index = 0; index < pool.length; index++) {
      cursor -= weightOf(pool[index])
      if (cursor <= 0) {
        chosenIndex = index
        break
      }
    }
    picked.push(pool[chosenIndex])
    pool.splice(chosenIndex, 1)
  }
  return picked
}

function buildMotif(length: number, maxAmplitude: number, rng: () => number): number[] {
  const motif: number[] = []
  for (let index = 0; index < length; index++) {
    motif.push(sampleWeightedStep(maxAmplitude, rng))
  }
  return motif
}

function blockKey(values: number[]): string {
  return values.join(',')
}

function transformSequence(base: Sequence, transform: SequenceTransform, occurrence: number): Sequence {
  if (transform === 'reverse') return base.reverse()
  if (transform === 'rotate') return base.rotate(occurrence)
  if (transform === 'flip') return base.flip(0)
  return new Sequence([...base.data])
}

function transformForOccurrence(occurrence: number, length: number): SequenceTransform {
  if (occurrence === 0) return 'identity'
  if (occurrence % 3 === 1) return 'reverse'
  if (occurrence % 3 === 2 && length > 1) return 'rotate'
  return 'flip'
}

export function buildSymmetryLayer(segmentation: SegmentationResult, maxAmplitude: number, rng: () => number): { layer: number[]; phrases: SymmetryPhrase[] } {
  const library = new Map<string, Sequence>()
  const occurrences = new Map<string, number>()
  const layer: number[] = []
  const phrases: SymmetryPhrase[] = []

  for (const block of segmentation.blocks) {
    const key = blockKey(block.values)
    const occurrence = occurrences.get(key) ?? 0
    occurrences.set(key, occurrence + 1)

    let base = library.get(key)
    if (!base) {
      base = new Sequence(buildMotif(block.values.length, maxAmplitude, rng))
      library.set(key, base)
    }

    const transform = transformForOccurrence(occurrence, base.data.length)
    const transformed = transformSequence(base, transform, occurrence)
    const clamped = transformed.data.map((value) => clampDifference(value, maxAmplitude))
    phrases.push({ key, occurrence, transform, values: clamped })
    layer.push(...clamped)
  }

  return { layer, phrases }
}

export function buildFactorLayer(composition: Composition, maxAmplitude: number, rng: () => number): { layer: number[]; selectedFactors: number[] } {
  if (composition.values.length === 0 || maxAmplitude <= 0) {
    return { layer: composition.values.map(() => 0), selectedFactors: [] }
  }

  const factors = factorsOf(composition.totalDuration)
  const selectedFactors = pickWeightedUnique(
    factors,
    Math.min(3, factors.length),
    (factor) => Math.exp(-Math.abs(Math.sqrt(composition.totalDuration) - factor)),
    rng
  )

  const onsetTimes: number[] = []
  let elapsed = 0
  for (const duration of composition.values) {
    onsetTimes.push(elapsed)
    elapsed += duration
  }

  const layer = onsetTimes.map((time) => {
    let sum = 0
    for (let index = 0; index < selectedFactors.length; index++) {
      const factor = selectedFactors[index]
      const strength = Math.max(1, Math.round(maxAmplitude / (index + 2)))
      sum += Math.round(strength * Math.cos((2 * Math.PI * factor * time) / composition.totalDuration))
    }
    return clampDifference(sum, maxAmplitude)
  })

  return { layer, selectedFactors }
}

export function generateRhythmDrivenSequence(params: SequenceGeneratorParams): GeneratedSequence {
  const rng = params.rng ?? Math.random
  const composition = buildCompositionFromRhythm(params.item, params.repeatCount ?? 1)
  const segmentation = optimizeSegmentation(composition)
  const symmetry = buildSymmetryLayer(segmentation, params.maxAmplitude, rng)
  const factor = buildFactorLayer(composition, params.maxAmplitude, rng)
  const rawDifferences = composition.values.map((_, index) =>
    clampDifference((symmetry.layer[index] ?? 0) + (factor.layer[index] ?? 0), params.maxAmplitude)
  )
  const start = Math.round((params.min + params.max) / 2)
  const walk = buildBouncedWalk(rawDifferences, params.min, params.max, start)

  return {
    composition,
    segmentation,
    symmetryLayer: symmetry.layer,
    factorLayer: factor.layer,
    differences: walk.differences,
    positions: walk.positions,
    phrases: symmetry.phrases,
    selectedFactors: factor.selectedFactors,
    start,
  }
}