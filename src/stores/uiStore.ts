import { defineStore } from 'pinia'

export type Toast = { id: string; message: string; type?: 'info' | 'success' | 'error'; timeout?: number }

export const useUiStore = defineStore('ui', {
  state: () => ({
    toasts: [] as Toast[]
  }),
  actions: {
    pushToast(message: string, type: 'info' | 'success' | 'error' = 'success', timeout = 3000) {
      const id = `${Date.now()}:${Math.random().toString(36).slice(2, 6)}`
      const toast: Toast = { id, message, type, timeout }
      this.toasts.push(toast)
      if (timeout > 0) {
        setTimeout(() => this.removeToast(id), timeout)
      }
    },
    removeToast(id: string) {
      this.toasts = this.toasts.filter(t => t.id !== id)
    }
  }
})
