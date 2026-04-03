<template>
  <div
    class="knob-wrap"
    :style="{ width: size + 'px' }"
    @mouseenter="hovering = true"
    @mouseleave="hovering = false"
  >
    <!-- Tooltip -->
    <transition name="knob-tip">
      <div v-if="showTooltip" class="knob-tooltip">{{ displayValue }}</div>
    </transition>

    <svg
      :width="size"
      :height="size"
      :viewBox="`0 0 ${size} ${size}`"
      class="knob-svg"
      @mousedown.prevent="onPointerDown"
      @dblclick.prevent="onDoubleClick"
      @wheel.prevent="onWheel"
      role="slider"
      :aria-valuemin="min"
      :aria-valuemax="max"
      :aria-valuenow="modelValue"
      :aria-label="label"
      tabindex="0"
      @keydown="onKey"
    >
      <!-- Outer ring / background track -->
      <circle
        :cx="cx" :cy="cy" :r="outerR"
        fill="#1e293b"
        stroke="#334155"
        :stroke-width="strokeW * 0.5"
      />

      <!-- Background arc (track) -->
      <path
        :d="bgArc"
        fill="none"
        stroke="#334155"
        :stroke-width="strokeW"
        stroke-linecap="round"
      />

      <!-- Value arc -->
      <path
        v-if="valueArc"
        :d="valueArc"
        fill="none"
        :stroke="activeColor"
        :stroke-width="strokeW"
        stroke-linecap="round"
      />

      <!-- Knob face -->
      <circle
        :cx="cx" :cy="cy" :r="knobR"
        :fill="dragging ? '#334155' : '#1e293b'"
        :stroke="dragging ? activeColor : '#475569'"
        :stroke-width="1.5"
        class="knob-face"
      />

      <!-- Pointer notch -->
      <line
        :x1="notchX1" :y1="notchY1"
        :x2="notchX2" :y2="notchY2"
        :stroke="activeColor"
        :stroke-width="2"
        stroke-linecap="round"
      />
    </svg>

    <div v-if="label" class="knob-label">{{ label }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: number
  min?: number
  max?: number
  step?: number
  label?: string
  size?: number
  color?: string
  defaultValue?: number
}>(), {
  min: 0,
  max: 1,
  step: 0.01,
  size: 48,
  color: '#06b6d4', // cyan-500
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

// --- Layout geometry ---
const cx = computed(() => props.size / 2)
const cy = computed(() => props.size / 2)
const strokeW = computed(() => Math.max(2, props.size * 0.08))
const outerR = computed(() => props.size / 2 - strokeW.value / 2 - 1)
const knobR = computed(() => outerR.value - strokeW.value - 1)

// Arc sweep: 270° from 135° (bottom-left) to 405° (bottom-right)
const ARC_START = 135
const ARC_END = 405
const ARC_RANGE = ARC_END - ARC_START // 270

function degToRad(deg: number) { return (deg * Math.PI) / 180 }

function polarToXY(angleDeg: number, r: number) {
  const rad = degToRad(angleDeg)
  return {
    x: cx.value + r * Math.cos(rad),
    y: cy.value + r * Math.sin(rad),
  }
}

function arcPath(startDeg: number, endDeg: number, r: number): string {
  if (Math.abs(endDeg - startDeg) < 0.1) return ''
  const s = polarToXY(startDeg, r)
  const e = polarToXY(endDeg, r)
  const largeArc = (endDeg - startDeg) > 180 ? 1 : 0
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`
}

const bgArc = computed(() => arcPath(ARC_START, ARC_END, outerR.value))

const fraction = computed(() => {
  const range = props.max - props.min
  if (range === 0) return 0
  return Math.max(0, Math.min(1, (props.modelValue - props.min) / range))
})

const valueDeg = computed(() => ARC_START + fraction.value * ARC_RANGE)

const valueArc = computed(() => {
  if (fraction.value < 0.002) return ''
  return arcPath(ARC_START, valueDeg.value, outerR.value)
})

// Pointer notch
const notchLen = computed(() => knobR.value * 0.38)
const notchX1 = computed(() => {
  const r = knobR.value * 0.25
  return polarToXY(valueDeg.value, r).x
})
const notchY1 = computed(() => {
  const r = knobR.value * 0.25
  return polarToXY(valueDeg.value, r).y
})
const notchX2 = computed(() => polarToXY(valueDeg.value, knobR.value - 2).x)
const notchY2 = computed(() => polarToXY(valueDeg.value, knobR.value - 2).y)

const activeColor = computed(() => props.color)

// --- Display ---
const hovering = ref(false)
const dragging = ref(false)
const showTooltip = computed(() => hovering.value || dragging.value)

const displayValue = computed(() => {
  const v = props.modelValue
  const range = props.max - props.min
  if (range >= 1000) return Math.round(v).toString()
  if (range >= 100) return v.toFixed(1)
  if (range >= 1) return v.toFixed(2)
  return v.toFixed(3)
})

// --- Interaction ---
let startY = 0
let startVal = 0

function clampAndSnap(raw: number): number {
  const s = props.step
  const snapped = Math.round(raw / s) * s
  // Fix floating-point
  const decimals = (s.toString().split('.')[1] || '').length
  const fixed = Number(snapped.toFixed(decimals))
  return Math.max(props.min, Math.min(props.max, fixed))
}

function onPointerDown(e: MouseEvent) {
  dragging.value = true
  startY = e.clientY
  startVal = props.modelValue
  document.addEventListener('mousemove', onPointerMove)
  document.addEventListener('mouseup', onPointerUp)
  // Request pointer lock for seamless dragging
  try { (e.target as Element)?.closest('svg')?.requestPointerLock?.() } catch {}
}

function onPointerMove(e: MouseEvent) {
  if (!dragging.value) return
  const range = props.max - props.min
  // Use movementY for pointer lock, fallback to clientY diff
  let dy: number
  if (document.pointerLockElement) {
    dy = -e.movementY
  } else {
    dy = startY - e.clientY
    startY = e.clientY
    startVal = props.modelValue
  }
  const sensitivity = e.shiftKey ? 0.1 : 1
  const pxPerFullRange = 200
  const delta = (dy / pxPerFullRange) * range * sensitivity
  const next = clampAndSnap(startVal + delta)
  if (document.pointerLockElement) {
    startVal = next
  }
  if (next !== props.modelValue) emit('update:modelValue', next)
}

function onPointerUp() {
  dragging.value = false
  document.removeEventListener('mousemove', onPointerMove)
  document.removeEventListener('mouseup', onPointerUp)
  try { document.exitPointerLock?.() } catch {}
}

function onWheel(e: WheelEvent) {
  const dir = e.deltaY < 0 ? 1 : -1
  const mult = e.shiftKey ? 0.1 : 1
  const next = clampAndSnap(props.modelValue + dir * props.step * mult)
  if (next !== props.modelValue) emit('update:modelValue', next)
}

function onDoubleClick() {
  if (props.defaultValue != null) {
    const v = clampAndSnap(props.defaultValue)
    if (v !== props.modelValue) emit('update:modelValue', v)
  }
}

function onKey(e: KeyboardEvent) {
  const mult = e.shiftKey ? 0.1 : 1
  if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
    e.preventDefault()
    const next = clampAndSnap(props.modelValue + props.step * mult)
    if (next !== props.modelValue) emit('update:modelValue', next)
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
    e.preventDefault()
    const next = clampAndSnap(props.modelValue - props.step * mult)
    if (next !== props.modelValue) emit('update:modelValue', next)
  }
}

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onPointerMove)
  document.removeEventListener('mouseup', onPointerUp)
  try { if (document.pointerLockElement) document.exitPointerLock?.() } catch {}
})
</script>

<style scoped>
.knob-wrap {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  user-select: none;
}
.knob-svg {
  cursor: grab;
  outline: none;
}
.knob-svg:active { cursor: grabbing; }
.knob-svg:focus-visible { outline: 2px solid #06b6d4; outline-offset: 2px; border-radius: 50%; }
.knob-face { transition: fill 0.15s, stroke 0.15s; }
.knob-label {
  margin-top: 2px;
  font-size: 10px;
  color: #94a3b8;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  line-height: 1.2;
}
.knob-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 4px;
  padding: 2px 6px;
  font-size: 11px;
  color: #f1f5f9;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 4px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 50;
}
.knob-tip-enter-active,
.knob-tip-leave-active {
  transition: opacity 0.12s ease;
}
.knob-tip-enter-from,
.knob-tip-leave-to {
  opacity: 0;
}
</style>
