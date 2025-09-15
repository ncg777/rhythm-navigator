<template>
  <div class="fixed top-2 right-2 z-[60] space-y-2 w-[min(92vw,22rem)]">
    <transition-group name="toast" tag="div">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="glass rounded border border-white/10 px-3 py-2 text-sm flex items-start gap-2 shadow"
        role="status"
        :class="{
          'bg-emerald-700/20': t.type === 'success',
          'bg-rose-700/20': t.type === 'error',
          'bg-slate-700/30': t.type === 'info'
        }"
      >
        <span class="shrink-0" aria-hidden="true">{{ iconFor(t.type) }}</span>
        <div class="flex-1 leading-snug">{{ t.message }}</div>
        <button class="px-1 rounded hover:bg-white/10" @click="remove(t.id)" aria-label="Dismiss">✕</button>
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/uiStore'

const ui = useUiStore()
const { toasts } = storeToRefs(ui)

function remove(id: string) { ui.removeToast(id) }
function iconFor(type?: 'info' | 'success' | 'error') { return type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️' }
</script>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: all .18s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(-6px); }
</style>
