import { defineStore } from 'pinia'
import type { Mode, RhythmItem } from '@/utils/rhythm'

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
    maxReps: 60,
    // Default to 2 to avoid empty-contour cases by default
    minOnsets: 2,
    maxOnsets: 99,

    circular: true,
    rotationInvariant: true,
    reflectionInvariant: true,
    excludeTrivial: true,

    // Only include rhythms that are shadow-contour isomorphic
    onlyIsomorphic: true,

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
          onlyIsomorphic: this.onlyIsomorphic
        }
      })
    }
  }
})