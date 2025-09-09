import type { Mode, RhythmItem } from '@/utils/rhythm'
import { bitsPerDigitForMode } from '@/utils/rhythm'
import { parseDigitsFromGroupedString } from '@/utils/relations'
import { canonicalContourFromOnsets, shadowContourFromOnsets } from '@/utils/contour'

function digitsToOnsets(digits: number[], mode: Mode): { onsets: number[]; totalBits: number } {
  const bpd = bitsPerDigitForMode(mode)
  const totalBits = digits.length * bpd
  const onsets: number[] = []
  const max = (1 << bpd) - 1
  for (let j = 0; j < digits.length; j++) {
    const v = Math.max(0, Math.min(digits[j], max))
    const base = j * bpd
    for (let i = 0; i < bpd; i++) {
      const bit = (v >> (bpd - 1 - i)) & 1
      if (bit) onsets.push(base + i)
    }
  }
  return { onsets, totalBits }
}

export function isShadowContourIsomorphicFromDigits(digits: number[], mode: Mode, opts: { circular: boolean; rotationInvariant: boolean; reflectionInvariant: boolean }): boolean {
  const { onsets, totalBits } = digitsToOnsets(digits, mode)
  if (onsets.length < 2) return true
  const c = canonicalContourFromOnsets(onsets, totalBits, opts)
  const s = shadowContourFromOnsets(onsets, totalBits, opts)
  return c.length > 0 && c === s
}

export function isShadowContourIsomorphicItem(item: RhythmItem, opts: { circular: boolean; rotationInvariant: boolean; reflectionInvariant: boolean }): boolean {
  const digits = item.digits ?? parseDigitsFromGroupedString(item.groupedDigitsString, item.base)
  return isShadowContourIsomorphicFromDigits(digits, item.base, opts)
}
