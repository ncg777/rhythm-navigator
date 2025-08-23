import { bitsPerDigitForMode, type Mode } from '@/utils/rhythm'
import type { RhythmItem } from '@/utils/rhythm'

// Parse digits back from grouped string like "AF 2B" | "17 03" | "1010 1100"
export function parseDigitsFromGroupedString(s: string, mode: Mode): number[] {
  const compact = s.replace(/\s+/g, '')
  const chars = [...compact]
  if (mode === 'hex') {
    return chars.map((c) => parseInt(c, 16))
  }
  // octal or binary -> decimal chars '0'..'7' or '0'/'1'
  return chars.map((c) => {
    const code = c.charCodeAt(0) - 48 // '0' -> 0
    return code < 0 ? 0 : code
  })
}

export function maskFromDigits(digits: number[], mode: Mode): { mask: bigint; length: number } {
  const bpd = bitsPerDigitForMode(mode)
  const L = digits.length * bpd
  let mask = 0n
  let pos = 0 // bit position: first produced bit = position 0 (LSB side in our mask)
  const max = (1 << bpd) - 1
  for (const d of digits) {
    const v = Math.max(0, Math.min(d, max))
    // MSB-first per digit
    for (let i = 0; i < bpd; i++) {
      const bit = (v >> (bpd - 1 - i)) & 1
      if (bit) mask |= 1n << BigInt(pos)
      pos++
    }
  }
  return { mask, length: L }
}

export function maskFromItem(item: RhythmItem): { mask: bigint; length: number } {
  // Prefer digits if present; else parse from the grouped string using this item's base
  const digits =
    item.digits ?? parseDigitsFromGroupedString(item.groupedDigitsString, item.base)
  return maskFromDigits(digits, item.base)
}

export type Relations = {
  subsets: RhythmItem[]
  supersets: RhythmItem[]
  overlaps: RhythmItem[]
}

export function computeRelations(
  selected: RhythmItem,
  items: RhythmItem[]
): Relations {
  const { mask: selMask, length: L } = maskFromItem(selected)
  const fullMask = (1n << BigInt(L)) - 1n

  const subsets: RhythmItem[] = []
  const supersets: RhythmItem[] = []
  const overlaps: RhythmItem[] = []

  // Cache masks per id (only for items that match length)
  const cache = new Map<string, { mask: bigint; length: number }>()

  for (const r of items) {
    if (r.id === selected.id) continue

    let rec = cache.get(r.id)
    if (!rec) {
      rec = maskFromItem(r)
      cache.set(r.id, rec)
    }

    if (rec.length !== L) continue // only compare rhythms with same total bit-length

    const a = rec.mask
    const b = selMask

    const equal = a === b
    const aSubsetB = (a & (fullMask ^ b)) === 0n // all bits of a are within b
    const bSubsetA = (b & (fullMask ^ a)) === 0n // all bits of b are within a
    const intersect = (a & b) !== 0n

    if (!equal && aSubsetB) {
      subsets.push(r)
    } else if (!equal && bSubsetA) {
      supersets.push(r)
    } else if (intersect) {
      overlaps.push(r)
    }
  }

  return { subsets, supersets, overlaps }
}