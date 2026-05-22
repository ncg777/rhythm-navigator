import { canonicalContourFromOnsets } from '@/utils/contour'
import { maskFromItem } from '@/utils/relations'
import { bitsPerBeat, computeSyncopationMetrics } from '@/utils/syncopation'
import { bitsPerDigitForMode, type RhythmItem } from '@/utils/rhythm'

export type PairwiseRelation = 'same' | 'subset' | 'superset' | 'overlap' | 'disjoint' | 'incompatible'

export type PairwiseMetrics = {
  relation: PairwiseRelation
  totalBits: number | null
  sharedOnsets: number
  onlyLeftOnsets: number
  onlyRightOnsets: number
  unionOnsets: number
  jaccardSimilarity: number
  contourDistance: number
  syncopationDelta: number
  offbeatDelta: number
  densityDelta: number
}

type ItemAnalysis = {
  onsets: number[]
  totalBits: number
  density: number
  contour: string
  syncopation: ReturnType<typeof computeSyncopationMetrics>
}

export function computePairwiseMetrics(left: RhythmItem, right: RhythmItem): PairwiseMetrics {
  const leftAnalysis = analyzeItem(left)
  const rightAnalysis = analyzeItem(right)

  if (leftAnalysis.totalBits !== rightAnalysis.totalBits) {
    return {
      relation: 'incompatible',
      totalBits: null,
      sharedOnsets: 0,
      onlyLeftOnsets: leftAnalysis.onsets.length,
      onlyRightOnsets: rightAnalysis.onsets.length,
      unionOnsets: leftAnalysis.onsets.length + rightAnalysis.onsets.length,
      jaccardSimilarity: 0,
      contourDistance: levenshteinDistance(leftAnalysis.contour, rightAnalysis.contour),
      syncopationDelta: Math.abs(leftAnalysis.syncopation.lhlApprox - rightAnalysis.syncopation.lhlApprox),
      offbeatDelta: Math.abs(leftAnalysis.syncopation.offbeatWeighted - rightAnalysis.syncopation.offbeatWeighted),
      densityDelta: Math.abs(leftAnalysis.density - rightAnalysis.density),
    }
  }

  const leftMask = maskFromItem(left).mask
  const rightMask = maskFromItem(right).mask
  const sharedMask = leftMask & rightMask
  const unionMask = leftMask | rightMask
  const leftOnlyMask = leftMask & ~rightMask
  const rightOnlyMask = rightMask & ~leftMask
  const sharedOnsets = popcountBigInt(sharedMask)
  const unionOnsets = popcountBigInt(unionMask)

  return {
    relation: classifyRelation(leftMask, rightMask, unionOnsets, sharedOnsets),
    totalBits: leftAnalysis.totalBits,
    sharedOnsets,
    onlyLeftOnsets: popcountBigInt(leftOnlyMask),
    onlyRightOnsets: popcountBigInt(rightOnlyMask),
    unionOnsets,
    jaccardSimilarity: unionOnsets === 0 ? 1 : sharedOnsets / unionOnsets,
    contourDistance: levenshteinDistance(leftAnalysis.contour, rightAnalysis.contour),
    syncopationDelta: Math.abs(leftAnalysis.syncopation.lhlApprox - rightAnalysis.syncopation.lhlApprox),
    offbeatDelta: Math.abs(leftAnalysis.syncopation.offbeatWeighted - rightAnalysis.syncopation.offbeatWeighted),
    densityDelta: Math.abs(leftAnalysis.density - rightAnalysis.density),
  }
}

function classifyRelation(leftMask: bigint, rightMask: bigint, unionOnsets: number, sharedOnsets: number): PairwiseRelation {
  if (leftMask === rightMask) return 'same'
  if ((leftMask & ~rightMask) === 0n) return 'subset'
  if ((rightMask & ~leftMask) === 0n) return 'superset'
  if (sharedOnsets === 0 && unionOnsets > 0) return 'disjoint'
  return 'overlap'
}

function analyzeItem(item: RhythmItem): ItemAnalysis {
  const digits = item.digits ?? parseDigits(item.groupedDigitsString, item.base)
  const bitsPerDigit = bitsPerDigitForMode(item.base)
  const totalBits = digits.length * bitsPerDigit
  const onsets: number[] = []

  for (let digitIndex = 0; digitIndex < digits.length; digitIndex++) {
    const value = digits[digitIndex]
    const offset = digitIndex * bitsPerDigit
    for (let bitIndex = 0; bitIndex < bitsPerDigit; bitIndex++) {
      const bit = (value >> (bitsPerDigit - 1 - bitIndex)) & 1
      if (bit) onsets.push(offset + bitIndex)
    }
  }

  const numerator = typeof item.numerator === 'number' && item.numerator > 0 ? item.numerator : digits.length
  const denominator = typeof item.denominator === 'number' && item.denominator > 0 ? item.denominator : 1

  return {
    onsets,
    totalBits,
    density: totalBits > 0 ? onsets.length / totalBits : 0,
    contour: canonicalContourFromOnsets(onsets, totalBits, {
      circular: true,
      rotationInvariant: true,
      reflectionInvariant: true,
    }),
    syncopation: computeSyncopationMetrics(onsets, totalBits, numerator, bitsPerBeat(item.base, denominator)),
  }
}

function parseDigits(groupedDigitsString: string, base: RhythmItem['base']): number[] {
  const compact = groupedDigitsString.replace(/\s+/g, '')
  if (base === 'hex') return [...compact].map((digit) => parseInt(digit, 16))
  return [...compact].map((digit) => Math.max(0, digit.charCodeAt(0) - 48))
}

function popcountBigInt(value: bigint): number {
  let remaining = value
  let count = 0
  while (remaining > 0n) {
    remaining &= remaining - 1n
    count++
  }
  return count
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) return 0
  if (!left.length) return right.length
  if (!right.length) return left.length

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  let current = new Array<number>(right.length + 1)

  for (let row = 0; row < left.length; row++) {
    current[0] = row + 1
    for (let column = 0; column < right.length; column++) {
      const insertion = current[column] + 1
      const deletion = previous[column + 1] + 1
      const substitution = previous[column] + (left[row] === right[column] ? 0 : 1)
      current[column + 1] = Math.min(insertion, deletion, substitution)
    }
    ;[previous, current] = [current, previous]
  }

  return previous[right.length]
}