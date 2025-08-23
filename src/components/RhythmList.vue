<template>
  <section>
    <header class="flex items-center justify-between gap-4">
      <h2 class="text-lg font-semibold">All rhythms</h2>
      <div class="flex items-center gap-3">
        <span class="text-sm text-slate-400">Count: {{ filtered.length }}</span>
        <SearchBar v-model="query" />
      </div>
    </header>

    <div v-if="!items.length" class="mt-6 text-slate-400 text-sm">
      No rhythms yet. Click "Generate" above (only shadow-contour–isomorphic rhythms if enabled).
    </div>

    <div
      v-else
      ref="viewport"
      class="mt-4 rounded-lg border border-white/10 overflow-auto"
      style="height: 70vh"
      @scroll="onScroll"
    >
      <!-- Windowed list using top/bottom spacers to ensure smooth native scrolling -->
      <div>
        <div :style="{ height: topPadding + 'px' }"></div>

        <button
          v-for="r in visibleItems"
          :key="r.id"
          @click="select(r.id)"
          class="w-full text-left px-3 hover:bg-white/5 focus:outline-none focus:bg-white/10 flex items-center gap-3"
          :class="selectedId === r.id ? 'ring-1 ring-brand-500/60' : ''"
          :style="{ height: ROW_HEIGHT + 'px', lineHeight: ROW_HEIGHT + 'px' }"
          :title="r.groupedDigitsString"
        >
          <span class="font-mono text-brand-300 truncate grow">{{ r.groupedDigitsString }}</span>
          <span class="text-[11px] text-slate-400 shrink-0">{{ r.onsets }} onsets</span>
        </button>

        <div :style="{ height: bottomPadding + 'px' }"></div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRhythmStore } from '@/stores/rhythmStore'
import SearchBar from './SearchBar.vue'
import { storeToRefs } from 'pinia'

const store = useRhythmStore()
const { items, selectedId } = storeToRefs(store)
const query = ref('')

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return items.value
  return items.value.filter(
    (r) =>
      r.groupedDigitsString.toLowerCase().includes(q) ||
      r.base.toLowerCase().includes(q) ||
      r.canonicalContour.toLowerCase().includes(q)
  )
})

const ROW_HEIGHT = 28
const BUFFER_ROWS = 20

const viewport = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const viewportHeight = ref(0)

const totalHeight = computed(() => filtered.value.length * ROW_HEIGHT)
const startIndex = computed(() => Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - BUFFER_ROWS))
const visibleCount = computed(() => Math.ceil(viewportHeight.value / ROW_HEIGHT) + BUFFER_ROWS * 2)
const endIndex = computed(() => Math.min(filtered.value.length, startIndex.value + visibleCount.value))
const visibleItems = computed(() => filtered.value.slice(startIndex.value, endIndex.value))

const topPadding = computed(() => startIndex.value * ROW_HEIGHT)
const bottomPadding = computed(() => Math.max(0, totalHeight.value - topPadding.value - visibleItems.value.length * ROW_HEIGHT))

function onScroll() {
  if (!viewport.value) return
  scrollTop.value = viewport.value.scrollTop
}

function handleResize() {
  if (!viewport.value) return
  viewportHeight.value = viewport.value.clientHeight
}

let ro: ResizeObserver | null = null

onMounted(() => {
  handleResize()
  ro = new ResizeObserver(handleResize)
  if (viewport.value) ro.observe(viewport.value)
})

onBeforeUnmount(() => {
  if (ro && viewport.value) ro.unobserve(viewport.value)
  ro = null
})

function select(id: string) {
  store.select(id)
}
</script>