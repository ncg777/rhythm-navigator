import { parseDigitsFromGroupedString } from '@/utils/relations'
import { bitsPerDigitForMode, type Mode, type RhythmItem } from '@/utils/rhythm'

export type OnsetPattern = {
  onsets: number[]
  totalBits: number
}

export function buildOnsetsFromDigits(digits: number[], bitsPerDigit: number): OnsetPattern {
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
  return { onsets, totalBits }
}

export function onsetPatternFromGroupedDigits(groupedDigitsString: string, mode: Mode): OnsetPattern {
  const digits = parseDigitsFromGroupedString(groupedDigitsString, mode)
  return buildOnsetsFromDigits(digits, bitsPerDigitForMode(mode))
}

export function onsetPatternFromItem(item: Pick<RhythmItem, 'base' | 'groupedDigitsString' | 'digits'>): OnsetPattern {
  const digits = item.digits ?? parseDigitsFromGroupedString(item.groupedDigitsString, item.base)
  return buildOnsetsFromDigits(digits, bitsPerDigitForMode(item.base))
}