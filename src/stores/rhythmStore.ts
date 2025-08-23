import { defineStore } from 'pinia'
import { bitsPerDigitForMode, digitsToBits, countOnsets, type Mode, type RhythmItem } from '@/utils/rhythm'
import { canonicalContourForBits } from '@/utils/contour'

export const useRhythmStore = defineStore('rhythm', {
  state: () => ({
    mode: 'hex' as Mode,
    numerator: 2,
    denominator: 2,
    maxReps: 60,
    minOnsets: 1,
    maxOnsets: 99,
    circular: true,
    rotationInvariant: true,
    reflectionInvariant: true,
    excludeTrivial: true,
    isGenerating: false,
    items: [] as RhythmItem[],
    selectedId: '' as string
  }),
  getters: {
    selected(state) { return state.items.find((x) => x.id === state.selectedId) }
  },
  actions: {
    clear() { this.items = []; this.selectedId = '' },
    select(id: string) { this.selectedId = id },
    async generate() {
      if (this.isGenerating) return
      this.isGenerating = true
      try {
        const base = this.mode === 'binary' ? 2 : this.mode === 'octal' ? 8 : 16
        const digitsCount = this.numerator * this.denominator
        const maxItems = Math.max(1, Math.min(this.maxReps, 200))
        const out: RhythmItem[] = []

        // Iterate a limited range of integers to keep generation bounded
        const maxIter = Math.min(BigInt(base) ** BigInt(digitsCount), BigInt(5000))
        for (let n = 0n; n < maxIter && out.length < maxItems; n++) {
          // Convert n to base digitsCount array
          const digits: number[] = new Array(digitsCount).fill(0)
          let x = n
          for (let i = digitsCount - 1; i >= 0; i--) {
            digits[i] = Number(x % BigInt(base))
            x = x / BigInt(base)
          }

          if (this.excludeTrivial) {
            const allZero = digits.every((d) => d === 0)
            const allMax = digits.every((d) => d === base - 1)
            if (allZero || allMax) continue
          }

          const bits = digitsToBits(digits, this.mode)
          const onsets = countOnsets(bits)
          if (onsets < this.minOnsets || onsets > this.maxOnsets) continue

          const contour = canonicalContourForBits(bits, {
            circular: this.circular,
            rotationInvariant: this.rotationInvariant,
            reflectionInvariant: this.reflectionInvariant
          })

          const groupedDigitsString = groupDigits(digits, this.mode, this.denominator)
          const id = `${this.mode}:${groupedDigitsString}`
          out.push({ id, base: this.mode, digits, groupedDigitsString, bits, onsets, canonicalContour: contour })
        }

        this.items = out
        this.selectedId = out[0]?.id ?? ''
      } finally {
        this.isGenerating = false
      }
    }
  }
})

function groupDigits(digits: number[], mode: Mode, perGroup: number): string {
  const enc = (d: number) => (mode === 'hex' ? d.toString(16).toUpperCase() : String(d))
  const parts: string[] = []
  for (let i = 0; i < digits.length; i += perGroup) {
    parts.push(digits.slice(i, i + perGroup).map(enc).join(''))
  }
  return parts.join(' ')
}