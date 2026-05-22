import { describe, expect, it } from 'vitest'
import type { PredicateGroup } from '@/types/predicateExpression'
import { evaluatePredicateTree, explainPredicateTree, flattenPredicateTrace } from './predicateEval'

describe('predicate explanation', () => {
  it('matches the boolean evaluator for nested groups', () => {
    const node: PredicateGroup = {
      type: 'and',
      children: [
        { type: 'predicate', id: 'maximallyEven' },
        {
          type: 'or',
          children: [
            { type: 'predicate', id: 'no-antipodes' },
            { type: 'predicate', id: 'lowEntropy' },
          ]
        }
      ]
    }

    const onsets = [0, 3, 5]
    const totalBits = 8

    expect(explainPredicateTree(node, onsets, totalBits).result).toBe(
      evaluatePredicateTree(node, onsets, totalBits)
    )
  })

  it('flattens evaluated leaves in order', () => {
    const node: PredicateGroup = {
      type: 'and',
      children: [
        { type: 'predicate', id: 'maximallyEven' },
        { type: 'predicate', id: 'no-antipodes' },
      ]
    }

    const flat = flattenPredicateTrace(explainPredicateTree(node, [0, 2, 4], 6))

    expect(flat).toHaveLength(2)
    expect(flat[0].id).toBe('maximallyEven')
    expect(flat[1].id).toBe('no-antipodes')
  })
})