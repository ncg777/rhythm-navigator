<template>
  <div class="relative" ref="root">
    <button
      type="button"
      class="action-menu-trigger"
      :title="props.title || props.label"
      :aria-label="props.title || props.label"
      @click="toggle"
    >
      <span v-if="props.icon" aria-hidden="true" class="action-menu-icon">{{ props.icon }}</span>
      <span class="truncate">{{ props.label }}</span>
      <span aria-hidden="true" class="text-[10px] text-slate-400">▾</span>
    </button>
    <div v-if="open" class="action-menu-panel" :class="props.align === 'right' ? 'right-0' : 'left-0'">
      <slot :close="closeMenu" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(defineProps<{ label: string; title?: string; icon?: string; align?: 'left' | 'right' }>(), {
  align: 'left'
})

const open = ref(false)
const root = ref<HTMLElement | null>(null)

function closeMenu() {
  open.value = false
}

function toggle() {
  open.value = !open.value
}

function onWindowClick(event: MouseEvent) {
  if (!open.value) return
  if (!root.value?.contains(event.target as Node)) closeMenu()
}

function onWindowKey(event: KeyboardEvent) {
  if (event.key === 'Escape') closeMenu()
}

onMounted(() => {
  window.addEventListener('click', onWindowClick)
  window.addEventListener('keydown', onWindowKey)
})

onBeforeUnmount(() => {
  window.removeEventListener('click', onWindowClick)
  window.removeEventListener('keydown', onWindowKey)
})
</script>

<style scoped>
.action-menu-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2rem;
  max-width: 100%;
  border-radius: 0.5rem;
  border: 1px solid rgba(103, 232, 249, 0.25);
  background: linear-gradient(120deg, rgba(8, 47, 73, 0.92), rgba(30, 41, 59, 0.96));
  padding: 0.35rem 0.6rem;
  color: #cffafe;
  font-size: 0.72rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  transition: all 0.15s ease;
}

.action-menu-trigger:hover {
  border-color: rgba(167, 139, 250, 0.4);
  color: #e9d5ff;
}

.action-menu-icon {
  font-size: 0.8rem;
}

.action-menu-panel {
  position: absolute;
  top: calc(100% + 0.4rem);
  z-index: 60;
  width: min(92vw, 22rem);
  border-radius: 0.75rem;
  border: 1px solid rgba(103, 232, 249, 0.25);
  background: linear-gradient(160deg, rgba(15, 23, 42, 0.98), rgba(2, 6, 23, 0.98));
  box-shadow: 0 14px 30px rgba(14, 165, 233, 0.2);
  padding: 0.6rem;
}
</style>
