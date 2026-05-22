<template>
  <div class="space-y-3">
    <svg :viewBox="`0 0 ${size} ${size}`" class="mx-auto w-full max-w-[20rem] overflow-visible">
      <circle
        :cx="center"
        :cy="center"
        :r="radius"
        class="fill-slate-950/40 stroke-white/10"
        stroke-width="1.5"
      />

      <line
        v-for="separator in beatSeparators"
        :key="`separator-${separator.index}`"
        :x1="separator.x1"
        :y1="separator.y1"
        :x2="separator.x2"
        :y2="separator.y2"
        class="stroke-white/25"
        stroke-width="1.5"
      />

      <path
        v-if="selectedPath"
        :d="selectedPath"
        class="fill-none stroke-sky-300/60"
        stroke-width="2"
        stroke-linejoin="round"
      />

      <path
        v-if="comparePath"
        :d="comparePath"
        class="fill-none stroke-amber-300/60"
        stroke-width="2"
        stroke-linejoin="round"
        stroke-dasharray="4 3"
      />

      <line
        v-for="tick in ticks"
        :key="`tick-${tick.index}`"
        :x1="tick.x1"
        :y1="tick.y1"
        :x2="tick.x2"
        :y2="tick.y2"
        class="stroke-white/10"
        :class="tick.major ? 'stroke-white/20' : ''"
        :stroke-width="tick.major ? 1.5 : 1"
      />

      <circle
        v-for="point in points"
        :key="`point-${point.index}`"
        :cx="point.x"
        :cy="point.y"
        :r="pointRadius"
        :class="point.className"
      />

      <text
        v-for="label in labels"
        :key="`label-${label.index}`"
        :x="label.x"
        :y="label.y"
        text-anchor="middle"
        dominant-baseline="middle"
        class="fill-slate-500 text-[8px]"
      >
        {{ label.text }}
      </text>

      <text
        v-for="label in beatLabels"
        :key="`beat-${label.index}`"
        :x="label.x"
        :y="label.y"
        text-anchor="middle"
        dominant-baseline="middle"
        class="fill-slate-300 text-[9px]"
      >
        {{ label.text }}
      </text>
    </svg>

    <div v-if="showLegend" class="flex flex-wrap gap-3 text-[11px] text-slate-400">
      <span class="inline-flex items-center gap-1.5">
        <span class="h-3 w-3 rounded-full border border-emerald-400/40 bg-emerald-400/30" />
        Shared onset
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="h-3 w-3 rounded-full border border-sky-400/40 bg-sky-400/30" />
        Selected only
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="h-3 w-3 rounded-full border border-amber-400/40 bg-amber-400/30" />
        Compare only
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="h-3 w-3 rounded-full border border-white/10 bg-slate-800/80" />
        Rest
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  totalBits: number
  selectedOnsets: number[]
  compareOnsets?: number[]
  beats?: number
  size?: number
  showLegend?: boolean
}>(), {
  compareOnsets: () => [],
  beats: 0,
  size: 240,
  showLegend: true,
})

const center = computed(() => props.size / 2)
const radius = computed(() => props.size * 0.34)
const pointRadius = computed(() => Math.max(3, props.size * 0.018))
const selectedSet = computed(() => new Set(props.selectedOnsets))
const compareSet = computed(() => new Set(props.compareOnsets))
const stepsPerBeat = computed(() => {
  if (props.beats <= 0 || props.totalBits <= 0 || props.totalBits % props.beats !== 0) return 0
  return props.totalBits / props.beats
})

const beatSeparators = computed(() => {
  if (stepsPerBeat.value <= 0) return []
  return Array.from({ length: props.beats }, (_, index) => {
    const angle = angleForIndex(index * stepsPerBeat.value, props.totalBits)
    const inner = polar(radius.value * 0.2, angle)
    const outer = polar(radius.value + 14, angle)
    return {
      index,
      x1: center.value + inner.x,
      y1: center.value + inner.y,
      x2: center.value + outer.x,
      y2: center.value + outer.y,
    }
  })
})

const ticks = computed(() => {
  return Array.from({ length: props.totalBits }, (_, index) => {
    const angle = angleForIndex(index, props.totalBits)
    const major = stepsPerBeat.value > 0 && index % stepsPerBeat.value === 0
    const outer = polar(radius.value + (major ? 10 : 6), angle)
    const inner = polar(radius.value - (major ? 10 : 6), angle)
    return {
      index,
      major,
      x1: center.value + inner.x,
      y1: center.value + inner.y,
      x2: center.value + outer.x,
      y2: center.value + outer.y,
    }
  })
})

const points = computed(() => {
  return Array.from({ length: props.totalBits }, (_, index) => {
    const angle = angleForIndex(index, props.totalBits)
    const position = polar(radius.value - 20, angle)
    const inSelected = selectedSet.value.has(index)
    const inCompare = compareSet.value.has(index)
    let className = 'fill-slate-800/80 stroke-white/10'
    if (inSelected && inCompare) className = 'fill-emerald-400/30 stroke-emerald-400/40'
    else if (inSelected) className = 'fill-sky-400/30 stroke-sky-400/40'
    else if (inCompare) className = 'fill-amber-400/30 stroke-amber-400/40'
    return {
      index,
      x: center.value + position.x,
      y: center.value + position.y,
      className,
    }
  })
})

const selectedPath = computed(() => pathForOnsets(props.selectedOnsets))
const comparePath = computed(() => pathForOnsets(props.compareOnsets))

const labels = computed(() => {
  if (props.totalBits > 32) return []
  return Array.from({ length: props.totalBits }, (_, index) => {
    const angle = angleForIndex(index, props.totalBits)
    const position = polar(radius.value + 22, angle)
    return {
      index,
      x: center.value + position.x,
      y: center.value + position.y,
      text: String(index + 1),
    }
  })
})

const beatLabels = computed(() => {
  if (stepsPerBeat.value <= 0 || props.beats > 24) return []
  return Array.from({ length: props.beats }, (_, index) => {
    const stepIndex = index * stepsPerBeat.value
    const angle = angleForIndex(stepIndex, props.totalBits)
    const position = polar(radius.value + 36, angle)
    return {
      index,
      x: center.value + position.x,
      y: center.value + position.y,
      text: `B${index + 1}`,
    }
  })
})

function angleForIndex(index: number, total: number) {
  const ratio = total > 0 ? index / total : 0
  return ratio * Math.PI * 2 - Math.PI / 2
}

function polar(length: number, angle: number) {
  return {
    x: Math.cos(angle) * length,
    y: Math.sin(angle) * length,
  }
}

function pathForOnsets(onsets: number[]) {
  if (props.totalBits <= 0 || onsets.length < 2) return ''
  const commands = onsets.map((step, index) => {
    const angle = angleForIndex(step, props.totalBits)
    const point = polar(radius.value - 20, angle)
    const prefix = index === 0 ? 'M' : 'L'
    return `${prefix} ${center.value + point.x} ${center.value + point.y}`
  })
  return `${commands.join(' ')} Z`
}
</script>