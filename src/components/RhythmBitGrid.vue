<template>
  <div class="space-y-3">
    <div class="grid gap-1" :style="gridStyle">
      <div
        v-for="cell in cells"
        :key="cell.index"
        class="h-6 rounded border transition-colors"
        :class="cell.className"
        :title="cell.title"
      />
    </div>

    <div class="flex flex-wrap gap-3 text-[11px] text-slate-400">
      <span class="inline-flex items-center gap-1.5">
        <span class="h-3 w-3 rounded border border-emerald-400/40 bg-emerald-400/30" />
        Shared onset
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="h-3 w-3 rounded border border-sky-400/40 bg-sky-400/30" />
        Selected only
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="h-3 w-3 rounded border border-amber-400/40 bg-amber-400/30" />
        Compare only
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="h-3 w-3 rounded border border-white/10 bg-slate-800/80" />
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
  columns?: number
}>(), {
  compareOnsets: () => [],
  columns: 16,
})

const selectedSet = computed(() => new Set(props.selectedOnsets))
const compareSet = computed(() => new Set(props.compareOnsets))
const normalizedColumns = computed(() => {
  if (props.totalBits <= 0) return 1
  return Math.max(1, Math.min(props.columns, props.totalBits))
})

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${normalizedColumns.value}, minmax(0, 1fr))`,
}))

const cells = computed(() => {
  return Array.from({ length: props.totalBits }, (_, index) => {
    const inSelected = selectedSet.value.has(index)
    const inCompare = compareSet.value.has(index)
    let className = 'border-white/10 bg-slate-800/80'
    let title = `Step ${index + 1}: rest`

    if (inSelected && inCompare) {
      className = 'border-emerald-400/40 bg-emerald-400/30'
      title = `Step ${index + 1}: shared onset`
    } else if (inSelected) {
      className = 'border-sky-400/40 bg-sky-400/30'
      title = `Step ${index + 1}: selected onset`
    } else if (inCompare) {
      className = 'border-amber-400/40 bg-amber-400/30'
      title = `Step ${index + 1}: compare onset`
    }

    return { index, className, title }
  })
})
</script>