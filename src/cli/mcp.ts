/**
 * Rhythm Navigator MCP Server
 *
 * Exposes rhythm generation tools via the Model Context Protocol (MCP).
 * Supports both enumerative and stochastic sampling approaches.
 *
 * Tools:
 *   - enumerate_rhythms: Exhaustive generate-and-test rhythm enumeration
 *   - sample_rhythms: Fast stochastic rhythm sampling
 *   - build_pulsations: Generate rhythms from a Pulsations specification
 *   - convolve_rhythms: XOR circular convolution of two rhythms
 *   - list_predicates: List available predicate filters
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import {
  enumerateRhythms,
  sampleRhythms,
  buildAllPulsations,
  convolveRhythms,
  ALL_PREDICATE_IDS,
  PREDICATE_LABELS
} from './engine.js'
import type { PredicateGroup, PredicateId, RhythmItem } from './engine.js'

function buildPredicateExpression(predicateIds: string[]): PredicateGroup | null {
  if (!predicateIds || predicateIds.length === 0) return null
  const validIds = predicateIds.filter(id =>
    ALL_PREDICATE_IDS.includes(id as PredicateId)
  ) as PredicateId[]
  if (validIds.length === 0) return null
  return {
    type: 'and',
    children: validIds.map(id => ({ type: 'predicate' as const, id }))
  }
}

export async function startMcpServer(): Promise<void> {
  const server = new McpServer({
    name: 'rhythm-navigator',
    version: '0.3.1'
  })

  // Tool: enumerate_rhythms
  server.tool(
    'enumerate_rhythms',
    'Exhaustive generate-and-test rhythm enumeration. Systematically explores all possible rhythm patterns within the search space and filters them using predicate conditions. Best for small search spaces where completeness is desired.',
    {
      mode: z.enum(['binary', 'octal', 'hex']).default('hex')
        .describe('Digit encoding mode: binary (1 bit/digit), octal (3 bits/digit), hex (4 bits/digit)'),
      numerator: z.number().int().min(1).default(4)
        .describe('Time signature numerator (number of beats)'),
      denominator: z.number().int().min(1).default(1)
        .describe('Digits per beat'),
      maxResults: z.number().int().min(0).default(0)
        .describe('Maximum number of results to return (0 = unlimited, runs until space exhausted)'),
      predicates: z.array(z.string()).default([])
        .describe(`Array of predicate filter IDs to apply as AND conditions. Available: ${ALL_PREDICATE_IDS.join(', ')}`),
      retentionProbability: z.number().min(0).max(100).default(100)
        .describe('Percentage probability (0-100) of keeping each valid rhythm')
    },
    async (params) => {
      const predicateExpression = buildPredicateExpression(params.predicates)
      const result = enumerateRhythms({
        mode: params.mode,
        numerator: params.numerator,
        denominator: params.denominator,
        maxReps: params.maxResults,
        predicateExpression,
        retentionProbability: Math.max(0, Math.min(1, params.retentionProbability / 100))
      })

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            method: 'enumerate',
            processed: result.processed,
            emitted: result.emitted,
            count: result.items.length,
            items: result.items.map(item => ({
              id: item.id,
              base: item.base,
              pattern: item.groupedDigitsString,
              onsets: item.onsets,
              contour: item.canonicalContour,
              numerator: item.numerator,
              denominator: item.denominator
            }))
          }, null, 2)
        }]
      }
    }
  )

  // Tool: sample_rhythms
  server.tool(
    'sample_rhythms',
    'Fast stochastic rhythm sampling. Randomly generates rhythm patterns and tests them against predicate filters. Much faster than enumeration for large search spaces. Discovers diverse results quickly.',
    {
      mode: z.enum(['binary', 'octal', 'hex']).default('hex')
        .describe('Digit encoding mode: binary (1 bit/digit), octal (3 bits/digit), hex (4 bits/digit)'),
      numerator: z.number().int().min(1).default(4)
        .describe('Time signature numerator (number of beats)'),
      denominator: z.number().int().min(1).default(1)
        .describe('Digits per beat'),
      maxResults: z.number().int().min(1).default(50)
        .describe('Maximum number of results to return'),
      maxAttempts: z.number().int().min(1).default(1000000)
        .describe('Maximum number of random trials before stopping'),
      predicates: z.array(z.string()).default([])
        .describe(`Array of predicate filter IDs to apply as AND conditions. Available: ${ALL_PREDICATE_IDS.join(', ')}`),
      retentionProbability: z.number().min(0).max(100).default(100)
        .describe('Percentage probability (0-100) of keeping each valid rhythm')
    },
    async (params) => {
      const predicateExpression = buildPredicateExpression(params.predicates)
      const result = sampleRhythms({
        mode: params.mode,
        numerator: params.numerator,
        denominator: params.denominator,
        maxResults: params.maxResults,
        maxAttempts: params.maxAttempts,
        predicateExpression,
        retentionProbability: Math.max(0, Math.min(1, params.retentionProbability / 100))
      })

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            method: 'sample',
            attempts: result.attempts,
            emitted: result.emitted,
            count: result.items.length,
            items: result.items.map(item => ({
              id: item.id,
              base: item.base,
              pattern: item.groupedDigitsString,
              onsets: item.onsets,
              contour: item.canonicalContour,
              numerator: item.numerator,
              denominator: item.denominator
            }))
          }, null, 2)
        }]
      }
    }
  )

  // Tool: build_pulsations
  server.tool(
    'build_pulsations',
    'Generate rhythm patterns from a Pulsations specification. Segments of a composition are each filled with evenly-spaced pulses, placed from the Head (start) or Tail (end). Comma-separate any parameter to produce the Cartesian product of all alternatives.',
    {
      mode: z.enum(['binary', 'octal', 'hex']).default('hex')
        .describe('Digit encoding mode: binary (1 bit/digit), octal (3 bits/digit), hex (4 bits/digit)'),
      numerator: z.number().int().min(1).default(4)
        .describe('Time signature numerator (number of beats)'),
      denominator: z.number().int().min(1).default(1)
        .describe('Digits per beat'),
      composition: z.string()
        .describe('Space-separated positive integers giving the length of each segment (e.g. "4 4 4 4"). Comma-separate for multiple alternatives.'),
      headTails: z.string().default('H')
        .describe('Space-separated H or T tokens — one per segment, cycling if shorter than composition (e.g. "H T"). Comma-separate for alternatives.'),
      durations: z.string().default('1')
        .describe('Space-separated positive integers for pulse spacing — one per segment, cycling if shorter (e.g. "1 2"). Comma-separate for alternatives.'),
      multiples: z.string().default('1')
        .describe('Space-separated positive integers for pulse count — one per segment, cycling if shorter (e.g. "2 3"). Comma-separate for alternatives.')
    },
    async (params) => {
      const { items, errors } = buildAllPulsations(
        {
          composition: params.composition,
          headTails: params.headTails,
          durations: params.durations,
          multiples: params.multiples
        },
        params.mode,
        params.numerator,
        params.denominator
      )

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            method: 'pulsations',
            emitted: items.length,
            errors,
            items: items.map((item: RhythmItem) => ({
              id: item.id,
              base: item.base,
              pattern: item.groupedDigitsString,
              onsets: item.onsets,
              contour: item.canonicalContour,
              numerator: item.numerator,
              denominator: item.denominator
            }))
          }, null, 2)
        }]
      }
    }
  )

  // Tool: convolve_rhythms
  server.tool(
    'convolve_rhythms',
    'XOR circular convolution of two rhythms. Combines a carrier and impulse rhythm by placing a copy of the impulse at each carrier onset, using XOR to merge overlapping pulses. Supports optional dilation (scaling) of either rhythm before convolution.',
    {
      mode: z.enum(['binary', 'octal', 'hex']).default('hex')
        .describe('Digit encoding mode: binary (1 bit/digit), octal (3 bits/digit), hex (4 bits/digit)'),
      carrier: z.string()
        .describe('Carrier rhythm as a grouped digit string (e.g. "F0" in hex, "1010" in binary)'),
      impulse: z.string()
        .describe('Impulse rhythm as a grouped digit string (e.g. "80" in hex, "1000" in binary)'),
      denominator: z.number().int().min(1).default(1)
        .describe('Digits per beat (controls output grouping)'),
      carrierScale: z.number().int().min(1).default(1)
        .describe('Dilation factor for carrier onset positions (default: 1, no scaling)'),
      impulseScale: z.number().int().min(1).default(1)
        .describe('Dilation factor for impulse onset positions (default: 1, no scaling)')
    },
    async (params) => {
      try {
        const result = convolveRhythms({
          carrier: params.carrier,
          impulse: params.impulse,
          mode: params.mode,
          carrierScale: params.carrierScale,
          impulseScale: params.impulseScale,
          denominator: params.denominator
        })

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              method: 'convolve',
              result: result.result,
              carrierLength: result.carrierLength,
              impulseLength: result.impulseLength,
              resultLength: result.resultLength,
              onsets: result.onsets
            }, null, 2)
          }]
        }
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              error: error instanceof Error ? error.message : String(error)
            })
          }],
          isError: true
        }
      }
    }
  )

  // Tool: list_predicates
  server.tool(
    'list_predicates',
    'List all available predicate filters for rhythm analysis with their descriptions.',
    {},
    async () => {
      const predicates = ALL_PREDICATE_IDS.map(id => ({
        id,
        label: PREDICATE_LABELS[id]
      }))

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ predicates }, null, 2)
        }]
      }
    }
  )

  // Start stdio transport
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
