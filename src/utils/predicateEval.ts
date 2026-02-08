/**
 * Evaluate a recursive predicate expression tree against a rhythm's onsets.
 *
 * Shared between the main thread and web workers so that a single function
 * handles arbitrarily nested AND/OR trees with short-circuit evaluation.
 */
import type { PredicateNode, PredicateLeaf, PredicateGroup } from '@/types/predicateExpression'
import type { ContourOptions } from './contour'
import { canonicalContourFromOnsets, shadowContourFromOnsets } from './contour'
import {
  isMaximallyEven,
  hasROP23,
  hasOddIntervalsOddity,
  noAntipodalPairs,
  isLowEntropy,
  hasNoGaps,
  relativelyFlat,
  hasOrdinal
} from './predicates'

const DEFAULT_CONTOUR_OPTS: ContourOptions = {
  circular: true,
  rotationInvariant: true,
  reflectionInvariant: true
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
    default:
      return true
  }
}
