import { defineStore } from 'pinia'
import { useUiStore } from '@/stores/uiStore'
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
    numerator: 4,
    denominator: 1,

    // 0 = unlimited (runs until stopped or space exhausted)
    maxReps: 0,
  // Allow empty-contour cases by default
  minOnsets: 0,
    maxOnsets: 99,

  // Invariance now fixed to dihedral; trivial patterns always excluded

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


    // generation state
    isGenerating: false,
    processed: 0,
    emitted: 0,

  // agglutination state
  isAgglutinating: false,
  agglProcessed: 0,
  agglEmitted: 0,
  agglTotalPairs: 0,

    items: [] as RhythmItem[],
    selectedId: '' as string,

    // Tracks unique rhythms already listed to prevent duplicates across generations
    _itemKeySet: new Set<string>() as Set<string>,

    _worker: null as Worker | null,
    _agglWorker: null as Worker | null
  }),
  getters: {
    selected(state) {
      return state.items.find((x) => x.id === state.selectedId)
    }
  },
  actions: {
    initPersistence() {
      const KEY = 'rn.rhythms'
      // Load
      try {
        const raw = localStorage.getItem(KEY)
        if (raw) {
          const data = JSON.parse(raw)
          if (data && Array.isArray(data.items)) {
            this.items = data.items
            this.selectedId = typeof data.selectedId === 'string' ? data.selectedId : ''
            // Rebuild dedupe set
            this._itemKeySet.clear()
            for (const it of this.items) {
              try { this._itemKeySet.add(`${it.base}:${it.groupedDigitsString}`) } catch {}
            }
          }
        }
      } catch (e) {
        console.warn('[rhythmStore] failed to load rhythms from storage', e)
      }

      // Save on any items/selection change
      this.$subscribe(() => {
        try {
          const payload = { items: this.items, selectedId: this.selectedId }
          localStorage.setItem(KEY, JSON.stringify(payload))
        } catch (e) {
          console.warn('[rhythmStore] failed to save rhythms to storage', e)
        }
      }, { detached: true })
    },
    clear() {
      this.items = []
      this.selectedId = ''
      this.processed = 0
      this.emitted = 0
      this.isAgglutinating = false
      this.agglProcessed = 0
      this.agglEmitted = 0
      this._itemKeySet.clear()
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
    stopAgglutination() {
      if (this._agglWorker) {
        try { this._agglWorker.terminate() } catch {}
        this._agglWorker = null
      }
      const wasAdded = this.agglEmitted
      this.isAgglutinating = false
      try { useUiStore().pushToast(wasAdded ? `Stopped agglutination after ${this.agglProcessed} checks; added ${this.agglEmitted}.` : 'Agglutination stopped.', 'info') } catch {}
    },
    async generate() {
      if (this.isGenerating) return
      this.isGenerating = true

      const worker = new Worker(new URL('@/workers/generate.ts', import.meta.url), { type: 'module' })
      this._worker = worker

      worker.onmessage = (ev: MessageEvent<WorkerMessage>) => {
        const msg = ev.data
        if (msg.type === 'batch') {
          if (msg.items.length) {
            // Deduplicate by stable key: base + groupedDigitsString
            const toAdd: RhythmItem[] = []
            for (const it of msg.items) {
              const key = `${it.base}:${it.groupedDigitsString}`
              if (!this._itemKeySet.has(key)) {
                this._itemKeySet.add(key)
                toAdd.push(it)
              }
            }
            if (toAdd.length) {
              this.items = this.items.concat(toAdd)
              if (!this.selectedId && this.items.length) this.selectedId = this.items[0].id
            }
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

  // Generate all ordered pairs (A+B) where A and B share base and time signature, and A||B passes current filters.
    agglutinate() {
      const pool = this.items
      if (pool.length < 2) return

      // Spawn a dedicated worker to avoid blocking UI
  const worker = new Worker(new URL('@/workers/agglutinate.ts', import.meta.url), { type: 'module' })
      this._agglWorker = worker
      this.isAgglutinating = true
      this.agglProcessed = 0
      this.agglEmitted = 0
  const KEY = (it: RhythmItem) => `${it.base}:${it.groupedDigitsString}`

      let added = 0
      worker.onmessage = (ev: MessageEvent<any>) => {
        const msg = ev.data
        if (!msg || !msg.type) return
        if (msg.type === 'meta') {
          this.agglTotalPairs = Number(msg.totalPairs) || 0
        } else if (msg.type === 'batch') {
          const items: RhythmItem[] = msg.items || []
          if (items.length) {
            const fresh: RhythmItem[] = []
            for (const it of items) {
              const key = KEY(it)
              if (!this._itemKeySet.has(key)) {
                this._itemKeySet.add(key)
                fresh.push(it)
              }
            }
            if (fresh.length) {
              added += fresh.length
              this.items = [...fresh, ...this.items]
              if (!this.selectedId && this.items.length) this.selectedId = this.items[0].id
            }
          }
        } else if (msg.type === 'progress') {
          this.agglProcessed = Number(msg.processed) || 0
          this.agglEmitted = Number(msg.emitted) || 0
        } else if (msg.type === 'done') {
          try {
            useUiStore().pushToast(added > 0 ? `Agglutinated ${added} pair(s).` : `No valid pairs found for current filters.`, added > 0 ? 'success' : 'info')
          } catch {}
          worker.terminate()
          if (this._agglWorker === worker) this._agglWorker = null
          this.isAgglutinating = false
        }
      }

      worker.postMessage({
        type: 'start',
        payload: {
          items: pool.map(it => ({ base: it.base, groupedDigitsString: it.groupedDigitsString, numerator: Number(it.numerator || this.numerator), denominator: Number(it.denominator || this.denominator) })),
          fallbackNumerator: this.numerator, // not used but retained for compatibility
          fallbackDenominator: this.denominator, // not used but retained for compatibility
          circular: true,
          rotationInvariant: true,
          reflectionInvariant: true,
          excludeTrivial: true,
          minOnsets: this.minOnsets,
          maxOnsets: this.maxOnsets,
          onlyIsomorphic: this.onlyIsomorphic,
          onlyMaximallyEven: this.onlyMaximallyEven,
          oddityType: this.oddityType,
          onlyLowEntropy: this.onlyLowEntropy,
          onlyHasNoGaps: this.onlyHasNoGaps,
          onlyRelativelyFlat: this.onlyRelativelyFlat,
          ordinalEnabled: this.ordinalEnabled,
          ordinalN: this.ordinalN
        }
      })
    }
  }
})