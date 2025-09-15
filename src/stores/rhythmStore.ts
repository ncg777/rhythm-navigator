import { defineStore } from 'pinia'
import type { Mode, RhythmItem } from '@/utils/rhythm'
import { bitsPerDigitForMode } from '@/utils/rhythm'
import { parseDigitsFromGroupedString } from '@/utils/relations'
import { canonicalContourFromOnsets, shadowContourFromOnsets } from '@/utils/contour'
import { isMaximallyEven, hasROP23, hasOddIntervalsOddity, noAntipodalPairs, isLowEntropy, hasNoGaps, relativelyFlat, hasOrdinal } from '@/utils/predicates'

type WorkerMessage =
  | { type: 'batch'; items: RhythmItem[] }
  | { type: 'done' }
  | { type: 'progress'; processed: number; emitted: number }

export const useRhythmStore = defineStore('rhythm', {
  state: () => ({
    mode: 'hex' as Mode,
    numerator: 2,
    denominator: 2,

    // 0 = unlimited (runs until stopped or space exhausted)
    maxReps: 0,
  // Allow empty-contour cases by default
  minOnsets: 0,
    maxOnsets: 99,

    circular: true,
    rotationInvariant: true,
    reflectionInvariant: true,
    excludeTrivial: true,

    // Only include rhythms that are shadow-contour isomorphic
    onlyIsomorphic: true,

    // Music theory predicates
    onlyMaximallyEven: false,
    oddityType: 'off' as 'off' | 'rop23' | 'odd-intervals' | 'no-antipodes',
  onlyLowEntropy: false,
  onlyHasNoGaps: false,
  onlyRelativelyFlat: false,
  ordinalEnabled: false,
  ordinalN: 4,

  // Agglutination
  agglSegments: 4,

    // generation state
    isGenerating: false,
    processed: 0,
    emitted: 0,

    items: [] as RhythmItem[],
    selectedId: '' as string,

    _worker: null as Worker | null
  }),
  getters: {
    selected(state) {
      return state.items.find((x) => x.id === state.selectedId)
    }
  },
  actions: {
    clear() {
      this.items = []
      this.selectedId = ''
      this.processed = 0
      this.emitted = 0
    },
    select(id: string) {
      this.selectedId = id
    },
    stop() {
      if (this._worker) {
        this._worker.terminate()
        this._worker = null
      }
      this.isGenerating = false
    },
    async generate() {
      if (this.isGenerating) return
      this.clear()
      this.isGenerating = true

      const worker = new Worker(new URL('@/workers/generate.ts', import.meta.url), { type: 'module' })
      this._worker = worker

      worker.onmessage = (ev: MessageEvent<WorkerMessage>) => {
        const msg = ev.data
        if (msg.type === 'batch') {
          if (msg.items.length) {
            this.items = this.items.concat(msg.items)
            if (!this.selectedId) this.selectedId = this.items[0].id
          }
        } else if (msg.type === 'progress') {
          this.processed = msg.processed
          this.emitted = msg.emitted
        } else if (msg.type === 'done') {
          this.isGenerating = false
          worker.terminate()
          if (this._worker === worker) this._worker = null
        }
      }

      worker.postMessage({
        type: 'start',
        payload: {
          mode: this.mode,
          numerator: this.numerator,
          denominator: this.denominator,
          maxReps: this.maxReps,
          minOnsets: this.minOnsets,
          maxOnsets: this.maxOnsets,
          circular: this.circular,
          rotationInvariant: this.rotationInvariant,
          reflectionInvariant: this.reflectionInvariant,
          excludeTrivial: this.excludeTrivial,
          onlyIsomorphic: this.onlyIsomorphic,
          onlyMaximallyEven: this.onlyMaximallyEven,
          oddityType: this.oddityType,
          onlyLowEntropy: this.onlyLowEntropy
          , onlyHasNoGaps: this.onlyHasNoGaps
          , onlyRelativelyFlat: this.onlyRelativelyFlat
          , ordinalEnabled: this.ordinalEnabled
          , ordinalN: this.ordinalN
        }
      })
    },

  // Concatenate randomly chosen rhythms ensuring each prefix remains valid under current filters.
    agglutinate() {
      const pool = this.items
      if (!pool.length) return

      const segments = Math.max(1, Math.floor(this.agglSegments))
      const mode = this.mode
      const bpd = bitsPerDigitForMode(mode)
      const perGroup = this.denominator
  const opts = () => ({ circular: this.circular, rotationInvariant: this.rotationInvariant, reflectionInvariant: this.reflectionInvariant })

      const parseItemDigits = (item: RhythmItem) => parseDigitsFromGroupedString(item.groupedDigitsString, item.base)
      const digitsToOnsets = (digits: number[]) => {
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
      const groupDigits = (digits: number[]) => {
        const enc = (d: number) => (mode === 'hex' ? d.toString(16).toUpperCase() : String(d))
        const parts: string[] = []
        for (let i = 0; i < digits.length; i += perGroup) {
          parts.push(digits.slice(i, i + perGroup).map(enc).join(''))
        }
        return parts.join(' ')
      }
      const isValid = (digits: number[]) => {
        const { onsets, totalBits } = digitsToOnsets(digits)
        const onsetsCount = onsets.length
        // respect onsets constraints
        if (onsetsCount < this.minOnsets || onsetsCount > this.maxOnsets) return false
        // exclude trivial if enabled
        if (this.excludeTrivial) {
          const allZero = onsetsCount === 0
          const allOne = onsetsCount === totalBits
          if (allZero || allOne) return false
        }

        // apply filters
        if (this.onlyIsomorphic) {
          const co = canonicalContourFromOnsets(onsets, totalBits, opts())
          const so = shadowContourFromOnsets(onsets, totalBits, opts())
          if (!(co.length > 0 && co === so)) return false
        }
        if (this.onlyMaximallyEven && !isMaximallyEven(onsets, totalBits)) return false
        switch (this.oddityType) {
          case 'rop23':
            if (!hasROP23(onsets, totalBits)) return false
            break
          case 'odd-intervals':
            if (!hasOddIntervalsOddity(onsets, totalBits)) return false
            break
          case 'no-antipodes':
            if (!noAntipodalPairs(onsets, totalBits)) return false
            break
        }
        if (this.onlyLowEntropy && !isLowEntropy(onsets, totalBits)) return false
        if (this.onlyHasNoGaps && !hasNoGaps(onsets, totalBits)) return false
        if (this.onlyRelativelyFlat && !relativelyFlat(onsets, totalBits)) return false
        if (this.ordinalEnabled && this.ordinalN >= 2 && !hasOrdinal(onsets, totalBits, this.ordinalN)) return false
        return true
      }
      const pickRandom = () => pool[Math.floor(Math.random() * pool.length)]

      const MAX_TRIES_PER_STEP = 5000
      let aggregated: number[] = []

      // pick the first ISO segment
      {
        let seg = pickRandom()
        let d = parseItemDigits(seg)
        let tries = 0
  while (tries < MAX_TRIES_PER_STEP && !isValid(d)) {
          seg = pickRandom()
          d = parseItemDigits(seg)
          tries++
        }
  if (!isValid(d)) return // no valid starting segment found
        aggregated = d.slice()
      }

      // grow with ISO-preserving concatenations
      for (let s = 1; s < segments; s++) {
        let found = false
        for (let t = 0; t < MAX_TRIES_PER_STEP; t++) {
          const cand = pickRandom()
          const dc = parseItemDigits(cand)
          const next = aggregated.concat(dc)
          if (isValid(next)) {
            aggregated = next
            found = true
            break
          }
        }
        if (!found) break
      }

      // build resulting RhythmItem
      const groupedDigitsString = groupDigits(aggregated)
      const { onsets, totalBits } = digitsToOnsets(aggregated)
      const canonicalContour = canonicalContourFromOnsets(onsets, totalBits, {
        circular: this.circular,
        rotationInvariant: this.rotationInvariant,
        reflectionInvariant: this.reflectionInvariant
      })
      const item: RhythmItem = {
        id: `aggl:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        base: mode,
        groupedDigitsString,
        onsets: onsets.length,
        canonicalContour,
        digits: aggregated
      }
      this.items = [item, ...this.items]
      this.selectedId = item.id
    }
  }
})