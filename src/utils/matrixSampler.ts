/**
 * Constructive stochastic constrained rhythm matrix generator.
 *
 * Fills the matrix row by row, left to right. After placing each cell:
 * - Tests the union of adjacent cells in the same row (with cyclic wrap for the
 *   last↔first pair) against the predicate expression.
 * - When the last row is filled, tests the full column union against the
 *   predicate expression.
 *
 * If a candidate cell fails constraints, the cell is retried (up to
 * maxCellRetries times). When retries are exhausted the entire matrix
 * attempt is abandoned and a fresh one starts.
 *
 * This is analogous to the stochastic sampler but operates on a 2-D matrix
 * of rhythm segments instead of a single rhythm.
 */

import type { Mode } from '@/utils/rhythm'
import { bitsPerDigitForMode } from '@/utils/rhythm'
import { evaluatePredicateTree } from '@/utils/predicateEval'
import type { PredicateGroup } from '@/types/predicateExpression'

export type MatrixSamplerParams = {
  mode: Mode
  numerator: number
  denominator: number
  rowCount: number
  columnCount: number
  maxResults: number       // 0 = unlimited
  maxAttempts: number      // max full matrix construction attempts (0 = unlimited)
  maxCellRetries: number   // max retries per cell before abandoning the whole matrix
  predicateExpression?: PredicateGroup | null
}

export type MatrixSamplerResult = {
  /** One formatted text block per accepted matrix. */
  matrices: string[]
  attempts: number
  emitted: number
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function makeLookup(bpd: number): number[][] {
  const size = 1 << bpd
  const out: number[][] = new Array(size)
  for (let v = 0; v < size; v++) {
    const indices: number[] = []
    for (let i = 0; i < bpd; i++) {
      if ((v >> (bpd - 1 - i)) & 1) indices.push(i)
    }
    out[v] = indices
  }
  return out
}

function makeEncTable(mode: Mode, base: number): string[] {
  const enc = new Array<string>(base)
  for (let i = 0; i < base; i++) {
    enc[i] = mode === 'hex' ? i.toString(16).toUpperCase() : String(i)
  }
  return enc
}

function groupDigits(digits: number[], encTable: string[], perGroup: number): string {
  const parts: string[] = []
  let group = ''
  for (let i = 0; i < digits.length; i++) {
    group += encTable[digits[i]]
    if ((i + 1) % perGroup === 0) {
      parts.push(group)
      group = ''
    }
  }
  if (group) parts.push(group)
  return parts.join(' ')
}

function bitsToOnsets(bits: Uint8Array): number[] {
  const out: number[] = []
  for (let i = 0; i < bits.length; i++) {
    if (bits[i]) out.push(i)
  }
  return out
}

// ---------------------------------------------------------------------------
// Main sampler
// ---------------------------------------------------------------------------

export function sampleRhythmMatrices(params: MatrixSamplerParams): MatrixSamplerResult {
  const base = params.mode === 'binary' ? 2 : params.mode === 'octal' ? 8 : 16
  const bpd = bitsPerDigitForMode(params.mode)
  const digitsCount = params.numerator * params.denominator
  const segmentBits = digitsCount * bpd

  const lookup = makeLookup(bpd)
  const encTable = makeEncTable(params.mode, base)

  const predExpr = params.predicateExpression ?? null
  const hasPredicates = !!(predExpr && predExpr.children && predExpr.children.length > 0)
  const canonicalOpts = { circular: true, rotationInvariant: true, reflectionInvariant: true }

  const R = Math.max(1, params.rowCount)
  const C = Math.max(1, params.columnCount)
  const maxResults = params.maxResults <= 0 ? Number.POSITIVE_INFINITY : params.maxResults
  const maxAttempts = params.maxAttempts <= 0 ? Number.POSITIVE_INFINITY : params.maxAttempts
  const maxCellRetries = params.maxCellRetries <= 0 ? 100 : params.maxCellRetries

  const seen = new Set<string>()
  const matrices: string[] = []
  let attempts = 0

  // Reusable per-column union buffers (reset each matrix attempt)
  const colUnions: Uint8Array[] = Array.from({ length: C }, () => new Uint8Array(segmentBits))

  // Stored bits and text per placed cell
  const cellBits: Uint8Array[][] = Array.from({ length: R }, () =>
    Array.from({ length: C }, () => new Uint8Array(segmentBits))
  )
  const cellText: string[][] = Array.from({ length: R }, () => new Array<string>(C).fill(''))

  // Reusable scratch buffers
  const candidateBits = new Uint8Array(segmentBits)
  const pairBits = new Uint8Array(segmentBits)
  const colBits = new Uint8Array(segmentBits)

  while (matrices.length < maxResults && attempts < maxAttempts) {
    attempts++

    // Reset column unions for this attempt
    for (let c = 0; c < C; c++) colUnions[c].fill(0)

    let matrixFailed = false

    outer:
    for (let r = 0; r < R; r++) {
      for (let c = 0; c < C; c++) {
        let placed = false

        for (let retry = 0; retry < maxCellRetries; retry++) {
          // Generate random digits for this cell
          const digits = new Array<number>(digitsCount)
          for (let i = 0; i < digitsCount; i++) digits[i] = Math.floor(Math.random() * base)

          // Build bit array for this cell
          candidateBits.fill(0)
          let onsetsCount = 0
          for (let j = 0; j < digitsCount; j++) {
            const v = digits[j]
            if (v) {
              const indices = lookup[v]
              const offset = j * bpd
              for (const idx of indices) {
                candidateBits[offset + idx] = 1
                onsetsCount++
              }
            }
          }

          // Skip trivial all-zero or all-one cells
          if (onsetsCount === 0 || onsetsCount === segmentBits) continue

          if (hasPredicates) {
            let ok = true

            // Individual cell check
            if (!evaluatePredicateTree(predExpr, bitsToOnsets(candidateBits), segmentBits, canonicalOpts)) ok = false

            // Row adjacency union: union of (c-1) and c
            if (ok && c > 0) {
              for (let i = 0; i < segmentBits; i++) pairBits[i] = cellBits[r][c - 1][i] | candidateBits[i]
              if (!evaluatePredicateTree(predExpr, bitsToOnsets(pairBits), segmentBits, canonicalOpts)) ok = false
            }

            // Cyclic row union: union of last cell (c = C-1) and first cell (c = 0)
            if (ok && c === C - 1 && C > 1) {
              for (let i = 0; i < segmentBits; i++) pairBits[i] = candidateBits[i] | cellBits[r][0][i]
              if (!evaluatePredicateTree(predExpr, bitsToOnsets(pairBits), segmentBits, canonicalOpts)) ok = false
            }

            // Full column union: tested only when this is the last row
            if (ok && r === R - 1) {
              colBits.set(colUnions[c])
              for (let i = 0; i < segmentBits; i++) colBits[i] |= candidateBits[i]
              if (!evaluatePredicateTree(predExpr, bitsToOnsets(colBits), segmentBits, canonicalOpts)) ok = false
            }

            if (!ok) continue
          }

          // Accept the cell
          cellBits[r][c].set(candidateBits)
          cellText[r][c] = groupDigits(digits, encTable, params.denominator)
          for (let i = 0; i < segmentBits; i++) colUnions[c][i] |= candidateBits[i]
          placed = true
          break
        }

        if (!placed) {
          matrixFailed = true
          break outer
        }
      }
    }

    if (matrixFailed) continue

    // Deduplicate by canonical text key
    const key = cellText.map(row => row.join(' ')).join('\n')
    if (seen.has(key)) continue
    seen.add(key)

    matrices.push(`# Matrix ${matrices.length + 1}\n${key}`)
  }

  return { matrices, attempts, emitted: matrices.length }
}

// ---------------------------------------------------------------------------
// Column sequencing
// ---------------------------------------------------------------------------

/**
 * Re-order or subset the columns of a formatted matrix text block.
 *
 * Each cell in a row occupies exactly `tokensPerCell` space-separated tokens
 * (because `groupDigits` splits digits into `numerator` groups, each of
 * `denominator` characters, joined by spaces — so `tokensPerCell = numerator`).
 *
 * @param matrixText    The matrix text block produced by `sampleRhythmMatrices`.
 * @param columnIndices 0-based column indices in the desired output order.
 *   Duplicates are allowed; the result has exactly `columnIndices.length` columns.
 * @param columnCount   The number of columns in the original matrix.
 * @returns A new matrix text block with columns re-ordered / subsetted.
 * @throws Error if `columnIndices` contains out-of-bounds indices or if the
 *   matrix text cannot be parsed with the given `columnCount`.
 */
export function sequenceMatrixColumns(
  matrixText: string,
  columnIndices: number[],
  columnCount: number
): string {
  const lines = matrixText.split('\n')
  const header = lines[0]
  const dataLines = lines.slice(1).filter(l => l.length > 0)

  if (dataLines.length === 0 || columnCount <= 0) return matrixText

  const tokensPerRow = dataLines[0].split(' ').length
  if (tokensPerRow % columnCount !== 0) {
    throw new Error(
      `Cannot parse matrix: row has ${tokensPerRow} token(s), which is not divisible by column count ${columnCount}.`
    )
  }
  const tokensPerCell = tokensPerRow / columnCount

  for (const idx of columnIndices) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= columnCount) {
      throw new Error(
        `Column index ${idx} is out of bounds (matrix has ${columnCount} column(s), 0-based).`
      )
    }
  }

  const newDataLines = dataLines.map(line => {
    const tokens = line.split(' ')
    return columnIndices
      .map(ci => tokens.slice(ci * tokensPerCell, (ci + 1) * tokensPerCell).join(' '))
      .join(' ')
  })

  return `${header}\n${newDataLines.join('\n')}`
}
