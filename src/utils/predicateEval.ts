/**
 * Evaluate a recursive predicate expression tree against a rhythm's onsets.
 *
 * Shared between the main thread and web workers so that a single function
 * handles arbitrarily nested AND/OR trees with short-circuit evaluation.
 */
import { PREDICATE_LABELS, type PredicateNode, type PredicateLeaf, type PredicateGroup, type PredicateId } from '@/types/predicateExpression'
import type { ContourOptions } from './contour'
import { canonicalContourFromOnsets, shadowContourFromOnsets } from './contour'
import {
  circularIntervals,
  intervalVector,
  isMaximallyEven,
  hasROP23,
  hasOddIntervalsOddity,
  noAntipodalPairs,
  isLowEntropy,
  hasNoGaps,
  relativelyFlat,
  hasOrdinal,
  isDuplePartitioned
} from './predicates'

const DEFAULT_CONTOUR_OPTS: ContourOptions = {
  circular: true,
  rotationInvariant: true,
  reflectionInvariant: true
}

export type PredicateLeafTrace = {
  kind: 'predicate'
  id: PredicateId
  label: string
  result: boolean
  summary: string
}

export type PredicateGroupTrace = {
  kind: 'group'
  operator: 'and' | 'or'
  result: boolean
  shortCircuited: boolean
  children: PredicateTrace[]
}

export type PredicateTrace = PredicateLeafTrace | PredicateGroupTrace

export type FlattenedPredicateTrace = {
  id: PredicateId
  label: string
  result: boolean
  summary: string
  depth: number
}

/**
 * Recursively evaluate a predicate expression tree.
 *
 * - AND nodes short-circuit on the first `false` child.
 * - OR  nodes short-circuit on the first `true`  child.
 * - An empty group (no children) returns `true` (no filtering).
 * - A `null` / `undefined` expression returns `true`.
 */
export function evaluatePredicateTree(
  node: PredicateNode | null | undefined,
  onsets: number[],
  totalBits: number,
  contourOpts: ContourOptions = DEFAULT_CONTOUR_OPTS
): boolean {
  if (!node) return true

  if (node.type === 'predicate') {
    return evaluateLeaf(node, onsets, totalBits, contourOpts)
  }

  return evaluateGroup(node, onsets, totalBits, contourOpts)
}

export function explainPredicateTree(
  node: PredicateNode | null | undefined,
  onsets: number[],
  totalBits: number,
  contourOpts: ContourOptions = DEFAULT_CONTOUR_OPTS
): PredicateTrace {
  if (!node) {
    return {
      kind: 'group',
      operator: 'and',
      result: true,
      shortCircuited: false,
      children: []
    }
  }

  if (node.type === 'predicate') {
    return explainLeaf(node, onsets, totalBits, contourOpts)
  }

  return explainGroup(node, onsets, totalBits, contourOpts)
}

export function flattenPredicateTrace(trace: PredicateTrace, depth = 0): FlattenedPredicateTrace[] {
  if (trace.kind === 'predicate') {
    return [{
      id: trace.id,
      label: trace.label,
      result: trace.result,
      summary: trace.summary,
      depth,
    }]
  }

  return trace.children.flatMap((child) => flattenPredicateTrace(child, depth + 1))
}

function evaluateGroup(
  node: PredicateGroup,
  onsets: number[],
  totalBits: number,
  opts: ContourOptions
): boolean {
  const children = node.children
  if (children.length === 0) return true

  if (node.type === 'and') {
    for (const child of children) {
      if (!evaluatePredicateTree(child, onsets, totalBits, opts)) return false
    }
    return true
  }

  // OR
  for (const child of children) {
    if (evaluatePredicateTree(child, onsets, totalBits, opts)) return true
  }
  return false
}

function evaluateLeaf(
  node: PredicateLeaf,
  onsets: number[],
  totalBits: number,
  opts: ContourOptions
): boolean {
  switch (node.id) {
    case 'isomorphic': {
      if (onsets.length < 2) return true
      const c = canonicalContourFromOnsets(onsets, totalBits, opts)
      const s = shadowContourFromOnsets(onsets, totalBits, opts)
      return c.length > 0 && c === s
    }
    case 'maximallyEven':
      return isMaximallyEven(onsets, totalBits)
    case 'rop23':
      return hasROP23(onsets, totalBits)
    case 'odd-intervals':
      return hasOddIntervalsOddity(onsets, totalBits)
    case 'no-antipodes':
      return noAntipodalPairs(onsets, totalBits)
    case 'lowEntropy':
      return isLowEntropy(onsets, totalBits)
    case 'noGaps':
      return hasNoGaps(onsets, totalBits)
    case 'relativelyFlat':
      return relativelyFlat(onsets, totalBits)
    case 'ordinal': {
      const n = node.params?.n ?? 4
      return n >= 2 ? hasOrdinal(onsets, totalBits, n) : true
    }
    case 'duplePartitioned':
      return isDuplePartitioned(onsets, totalBits)
    default:
      return true
  }
}

function explainGroup(
  node: PredicateGroup,
  onsets: number[],
  totalBits: number,
  opts: ContourOptions
): PredicateGroupTrace {
  const children = node.children
  if (children.length === 0) {
    return {
      kind: 'group',
      operator: node.type,
      result: true,
      shortCircuited: false,
      children: []
    }
  }

  const traces: PredicateTrace[] = []
  if (node.type === 'and') {
    for (const child of children) {
      const trace = explainPredicateTree(child, onsets, totalBits, opts)
      traces.push(trace)
      if (!trace.result) {
        return {
          kind: 'group',
          operator: 'and',
          result: false,
          shortCircuited: traces.length < children.length,
          children: traces,
        }
      }
    }
    return {
      kind: 'group',
      operator: 'and',
      result: true,
      shortCircuited: false,
      children: traces,
    }
  }

  for (const child of children) {
    const trace = explainPredicateTree(child, onsets, totalBits, opts)
    traces.push(trace)
    if (trace.result) {
      return {
        kind: 'group',
        operator: 'or',
        result: true,
        shortCircuited: traces.length < children.length,
        children: traces,
      }
    }
  }

  return {
    kind: 'group',
    operator: 'or',
    result: false,
    shortCircuited: false,
    children: traces,
  }
}

function explainLeaf(
  node: PredicateLeaf,
  onsets: number[],
  totalBits: number,
  opts: ContourOptions
): PredicateLeafTrace {
  const intervals = circularIntervals(onsets, totalBits)
  const contour = onsets.length >= 2 ? canonicalContourFromOnsets(onsets, totalBits, opts) : ''
  const shadow = onsets.length >= 2 ? shadowContourFromOnsets(onsets, totalBits, opts) : ''
  const vector = intervalVector(onsets, totalBits)
  let result = true
  let summary = ''

  switch (node.id) {
    case 'isomorphic': {
      result = onsets.length < 2 ? true : contour.length > 0 && contour === shadow
      summary = onsets.length < 2
        ? 'Fewer than two onsets, so the contour comparison is vacuously true.'
        : `Canonical ${contour || '∅'} vs shadow ${shadow || '∅'}.`
      break
    }
    case 'maximallyEven':
      result = isMaximallyEven(onsets, totalBits)
      summary = `Circular intervals: ${formatNumberList(intervals)}.`
      break
    case 'rop23':
      result = hasROP23(onsets, totalBits)
      summary = `Requires even length and intervals only in {2,3}; got ${formatNumberList(intervals)}.`
      break
    case 'odd-intervals':
      result = hasOddIntervalsOddity(onsets, totalBits)
      summary = `Requires even length and all intervals odd; got ${formatNumberList(intervals)}.`
      break
    case 'no-antipodes':
      result = noAntipodalPairs(onsets, totalBits)
      summary = totalBits % 2 === 0
        ? `Checks for onset pairs separated by ${totalBits / 2}.`
        : 'Odd cycle length has no antipodal positions.'
      break
    case 'lowEntropy':
      result = isLowEntropy(onsets, totalBits)
      summary = `Entropy test over circular intervals ${formatNumberList(intervals)}.`
      break
    case 'noGaps':
      result = hasNoGaps(onsets, totalBits)
      summary = `Interval vector: ${formatNumberList(vector)}.`
      break
    case 'relativelyFlat':
      result = relativelyFlat(onsets, totalBits)
      summary = `Non-zero interval vector bins should stay near the mean; vector ${formatNumberList(vector)}.`
      break
    case 'ordinal': {
      const n = node.params?.n ?? 4
      result = n >= 2 ? hasOrdinal(onsets, totalBits, n) : true
      summary = `Checks reversed bit blocks of size ${n}.`
      break
    }
    case 'duplePartitioned':
      result = isDuplePartitioned(onsets, totalBits)
      summary = `Composition intervals: ${formatNumberList(intervals)}.`
      break
    default:
      result = true
      summary = 'No explanation available.'
  }

  return {
    kind: 'predicate',
    id: node.id,
    label: PREDICATE_LABELS[node.id],
    result,
    summary,
  }
}

function formatNumberList(values: number[]): string {
  return values.length ? values.join(', ') : 'none'
}
