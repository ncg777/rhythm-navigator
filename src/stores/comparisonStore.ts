import { defineStore } from 'pinia'

const STORAGE_KEY = 'rn.comparison'

export const useComparisonStore = defineStore('comparison', {
  state: () => ({
    secondaryId: '' as string,
    _hasPersistence: false,
  }),
  actions: {
    initPersistence(validIds: string[] = []) {
      if (this._hasPersistence) return
      this._hasPersistence = true

      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const data = JSON.parse(raw) as { secondaryId?: unknown }
          this.secondaryId = typeof data?.secondaryId === 'string' ? data.secondaryId : ''
        }
      } catch (error) {
        console.warn('[comparisonStore] failed to load comparison state', error)
      }

      this.reconcile(validIds)

      this.$subscribe(() => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ secondaryId: this.secondaryId }))
        } catch (error) {
          console.warn('[comparisonStore] failed to save comparison state', error)
        }
      }, { detached: true })
    },
    setSecondary(id: string) {
      this.secondaryId = id
    },
    clearSecondary() {
      this.secondaryId = ''
    },
    reconcile(validIds: string[]) {
      if (!this.secondaryId) return
      if (!validIds.includes(this.secondaryId)) {
        this.secondaryId = ''
      }
    },
  }
})