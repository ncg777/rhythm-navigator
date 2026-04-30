/// <reference lib="webworker" />
/**
 * Web Worker for constructive stochastic rhythm matrix generation.
 *
 * Uses the same message protocol as the other workers
 * (batch / progress / done) so the store can drive it with identical
 * handler logic.
 *
 * The constructive algorithm fills the matrix row by row, left to right.
 * After placing each cell it immediately tests:
 *  - the union of adjacent cells in the same row (and the cyclic last↔first union)
 *  - the full column union when the last row is placed
 * Cells that fail are retried; if retries run out the whole matrix attempt
 * is abandoned.
 */
import type { Mode } from '@/utils/rhythm'
import { bitsPerDigitForMode } from '@/utils/rhythm'
import { evaluatePredicateTree } from '@/utils/predicateEval'
import type { PredicateGroup } from '@/types/predicateExpression'

type StartPayload = {
  mode: Mode
  numerator: number
  denominator: number
  rowCount: number
  columnCount: number
  maxResults: number       // 0 = unlimited
  maxAttempts: number      // max full matrix construction attempts
  maxCellRetries: number   // max retries per cell
  predicateExpression?: PredicateGroup | null
}

type InMsg = { type: 'start'; payload: StartPayload } | { type: 'stop' }

/** Outgoing messages use plain text blocks for matrices. */
type OutMsg =
  | { type: 'batch'; matrices: string[] }
  | { type: 'progress'; attempts: number; emitted: number }
  | { type: 'done' }

let stopping = false

self.onmessage = (ev: MessageEvent<InMsg>) => {
  const msg = ev.data
  if (msg.type === 'stop') {
    stopping = true
    return
  }
  if (msg.type === 'start') {
    stopping = false
    run(msg.payload).catch((err) => {
      console.error('[matrix worker] unhandled error:', err)
    })
  }
}

// ---------------------------------------------------------------------------
// Helpers (inlined to avoid circular worker-import issues)
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

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

// ---------------------------------------------------------------------------
// Main worker loop
// ---------------------------------------------------------------------------

async function run(p: StartPayload) {
  const post = self as unknown as Worker

  const base = p.mode === 'binary' ? 2 : p.mode === 'octal' ? 8 : 16
  const bpd = bitsPerDigitForMode(p.mode)
  const digitsCount = p.numerator * p.denominator
  const segmentBits = digitsCount * bpd

  const lookup = makeLookup(bpd)
  const encTable = makeEncTable(p.mode, base)

  const predExpr = p.predicateExpression ?? null
  const hasPredicates = !!(predExpr && predExpr.children && predExpr.children.length > 0)
  const canonicalOpts = { circular: true, rotationInvariant: true, reflectionInvariant: true }

  const R = Math.max(1, p.rowCount)
  const C = Math.max(1, p.columnCount)
  const maxResults = p.maxResults <= 0 ? Number.POSITIVE_INFINITY : p.maxResults
  const maxAttempts = p.maxAttempts <= 0 ? Number.POSITIVE_INFINITY : p.maxAttempts
  const maxCellRetries = p.maxCellRetries <= 0 ? 100 : p.maxCellRetries

  const seen = new Set<string>()
  let emitted = 0
  let attempts = 0

  // Reusable per-column union buffers
  const colUnions: Uint8Array[] = Array.from({ length: C }, () => new Uint8Array(segmentBits))

  // Stored bits and text per placed cell
  const cellBits: Uint8Array[][] = Array.from({ length: R }, () =>
    Array.from({ length: C }, () => new Uint8Array(segmentBits))
  )
  const cellText: string[][] = Array.from({ length: R }, () => new Array<string>(C).fill(''))

  // Scratch buffers
  const candidateBits = new Uint8Array(segmentBits)
  const pairBits = new Uint8Array(segmentBits)
  const colBits = new Uint8Array(segmentBits)

  const BATCH_SIZE = 20
  const YIELD_INTERVAL_MS = 50

  let batch: string[] = []
  let lastYield = Date.now()

  const pushBatch = () => {
    if (batch.length) {
      post.postMessage({ type: 'batch', matrices: batch } as OutMsg)
      batch = []
    }
  }

  while (!stopping && emitted < maxResults && attempts < maxAttempts) {
    attempts++

    // Yield to keep the UI responsive
    if ((attempts & 63) === 0) {
      const now = Date.now()
      if (now - lastYield >= YIELD_INTERVAL_MS) {
        pushBatch()
        post.postMessage({ type: 'progress', attempts, emitted } as OutMsg)
        await tick()
        lastYield = Date.now()
        if (stopping) break
      }
    }

    // Reset column unions
    for (let c = 0; c < C; c++) colUnions[c].fill(0)

    let matrixFailed = false

    outer:
    for (let r = 0; r < R; r++) {
      for (let c = 0; c < C; c++) {
        let placed = false

        for (let retry = 0; retry < maxCellRetries; retry++) {
          // Random digits
          const digits = new Array<number>(digitsCount)
          for (let i = 0; i < digitsCount; i++) digits[i] = Math.floor(Math.random() * base)

          // Build bit array
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

          // Skip trivial cells
          if (onsetsCount === 0 || onsetsCount === segmentBits) continue

          if (hasPredicates) {
            let ok = true

            // Row adjacency union: union of cell (r,c-1) and cell (r,c)
            if (ok && c > 0) {
              for (let i = 0; i < segmentBits; i++) pairBits[i] = cellBits[r][c - 1][i] | candidateBits[i]
              if (!evaluatePredicateTree(predExpr, bitsToOnsets(pairBits), segmentBits, canonicalOpts)) ok = false
            }

            // Cyclic row union: union of last cell and first cell in this row
            if (ok && c === C - 1 && C > 1) {
              for (let i = 0; i < segmentBits; i++) pairBits[i] = candidateBits[i] | cellBits[r][0][i]
              if (!evaluatePredicateTree(predExpr, bitsToOnsets(pairBits), segmentBits, canonicalOpts)) ok = false
            }

            // Full column union: only when placing the last row's cell
            if (ok && r === R - 1) {
              colBits.set(colUnions[c])
              for (let i = 0; i < segmentBits; i++) colBits[i] |= candidateBits[i]
              if (!evaluatePredicateTree(predExpr, bitsToOnsets(colBits), segmentBits, canonicalOpts)) ok = false
            }

            if (!ok) continue
          }

          // Accept cell
          cellBits[r][c].set(candidateBits)
          cellText[r][c] = groupDigits(digits, encTable, p.denominator)
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

    // Deduplicate
    const key = cellText.map(row => row.join(' ')).join('\n')
    if (seen.has(key)) continue
    seen.add(key)

    batch.push(`# Matrix ${emitted + 1}\n${key}`)
    emitted++

    if (batch.length >= BATCH_SIZE) pushBatch()
  }

  pushBatch()
  post.postMessage({ type: 'progress', attempts, emitted } as OutMsg)
  post.postMessage({ type: 'done' } as OutMsg)
}
