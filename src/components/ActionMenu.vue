<template>
  <div class="relative" ref="root">
    <button
      ref="trigger"
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
    <Teleport to="body">
      <div v-if="open" ref="panel" class="action-menu-panel" :style="panelStyle">
        <slot :close="closeMenu" />
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{ label: string; title?: string; icon?: string; align?: 'left' | 'right' }>(), {
  align: 'left'
})

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

function updatePanelPosition() {
  if (!open.value || !trigger.value) return

  const viewportPadding = 8
  const preferredWidth = Math.min(window.innerWidth - viewportPadding * 2, 352)
  const triggerRect = trigger.value.getBoundingClientRect()
  let left = props.align === 'right' ? triggerRect.right - preferredWidth : triggerRect.left
  left = Math.max(viewportPadding, Math.min(left, window.innerWidth - preferredWidth - viewportPadding))

  // Keep the panel on screen by flipping above the trigger when there is not enough room below.
  const estimatedHeight = panel.value?.offsetHeight ?? 280
  const canFitBelow = triggerRect.bottom + 6 + estimatedHeight <= window.innerHeight - viewportPadding
  const top = canFitBelow
    ? triggerRect.bottom + 6
    : Math.max(viewportPadding, triggerRect.top - estimatedHeight - 6)

  panelStyle.value = {
    position: 'fixed',
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    width: `${Math.round(preferredWidth)}px`
  }
}

function closeMenu() {
  open.value = false
}

function toggle() {
  open.value = !open.value
  if (open.value) {
    nextTick(() => updatePanelPosition())
  }
}

function onWindowClick(event: MouseEvent) {
  if (!open.value) return
  const target = event.target as Node
  if (root.value?.contains(target)) return
  if (panel.value?.contains(target)) return
  closeMenu()
}

function onWindowKey(event: KeyboardEvent) {
  if (event.key === 'Escape') closeMenu()
}

function onViewportChange() {
  updatePanelPosition()
}

watch(open, (isOpen) => {
  if (!isOpen) return
  nextTick(() => updatePanelPosition())
})

onMounted(() => {
  window.addEventListener('click', onWindowClick)
  window.addEventListener('keydown', onWindowKey)
  window.addEventListener('resize', onViewportChange)
  window.addEventListener('scroll', onViewportChange, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('click', onWindowClick)
  window.removeEventListener('keydown', onWindowKey)
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('scroll', onViewportChange, true)
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
  position: fixed;
  z-index: 90;
  width: min(92vw, 22rem);
  border-radius: 0.75rem;
  border: 1px solid rgba(103, 232, 249, 0.25);
  background: linear-gradient(160deg, rgba(15, 23, 42, 0.98), rgba(2, 6, 23, 0.98));
  box-shadow: 0 14px 30px rgba(14, 165, 233, 0.2);
  padding: 0.6rem;
}
</style>
