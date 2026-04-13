/**
 * Recursive AND/OR expression tree for combining predicate filters.
 *
 * Leaf nodes represent individual predicate checks.
 * Group nodes (and / or) combine their children with the respective logic:
 *   AND – all children must pass (empty AND = vacuously true)
 *   OR  – at least one child must pass (empty OR  = vacuously true for UX; treated as "no filter")
 */

export type PredicateId =
  | 'isomorphic'
  | 'maximallyEven'
  | 'rop23'
  | 'odd-intervals'
  | 'no-antipodes'
  | 'lowEntropy'
  | 'noGaps'
  | 'relativelyFlat'
  | 'ordinal'
  | 'duplePartitioned'

export interface PredicateLeaf {
  type: 'predicate'
  id: PredicateId
  /** Extra parameters for predicates that need them (e.g. ordinal block size). */
  params?: { n?: number }
}

export interface PredicateGroup {
  type: 'and' | 'or'
  children: PredicateNode[]
}

export type PredicateNode = PredicateLeaf | PredicateGroup

/** Ordered list of all available predicate ids. */
export const ALL_PREDICATE_IDS: PredicateId[] = [
  'isomorphic',
  'maximallyEven',
  'rop23',
  'odd-intervals',
  'no-antipodes',
  'lowEntropy',
  'noGaps',
  'relativelyFlat',
  'ordinal',
  'duplePartitioned'
]

/** Human-readable labels for each predicate. */
export const PREDICATE_LABELS: Record<PredicateId, string> = {
  'isomorphic': 'Shadow-contour isomorphic',
  'maximallyEven': 'Maximally even (Euclidean)',
  'rop23': 'ROP (2/3)',
  'odd-intervals': 'Odd-interval oddity',
  'no-antipodes': 'No antipodal pairs',
  'lowEntropy': 'Low entropy',
  'noGaps': 'No-gap interval vector',
  'relativelyFlat': 'Relatively flat',
  'ordinal': 'Ordinal blocks',
  'duplePartitioned': 'Duple-partitioned'
}

/** Default expression: AND( isomorphic ). */
export function defaultPredicateExpression(): PredicateGroup {
  return {
    type: 'and',
    children: [{ type: 'predicate', id: 'isomorphic' }]
  }
}
