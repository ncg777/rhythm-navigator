<template>
  <section>
    <header class="flex items-center justify-between gap-4">
      <h2 class="text-lg font-semibold">All rhythms</h2>
      <div class="flex items-center gap-3">
  <span class="text-sm text-slate-400">Count: {{ sorted.length }}</span>
        <label class="flex items-center gap-2 text-xs text-slate-400">
          <span>Sort</span>
          <select v-model="sortKey" class="bg-slate-800 border border-white/10 rounded px-2 py-1 text-sm">
            <option value="mode-tsig-onsets">Mode → Time Sig → Onsets</option>
            <option value="tsig-mode-onsets">Time Sig → Mode → Onsets</option>
            <option value="onsets-mode-tsig">Onsets → Mode → Time Sig</option>
            <option value="alpha">Grouped digits (A→Z)</option>
          </select>
        </label>
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
const sortKey = ref<'mode-tsig-onsets' | 'tsig-mode-onsets' | 'onsets-mode-tsig' | 'alpha'>('mode-tsig-onsets')

// Filter with defensive guards to avoid crashing on legacy/incomplete items
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return items.value
  return items.value.filter((r) => {
    const g = (r.groupedDigitsString ?? '').toString().toLowerCase()
    const b = (r.base ?? '').toString().toLowerCase()
    const c = (r.canonicalContour ?? '').toString().toLowerCase()
    return g.includes(q) || b.includes(q) || c.includes(q)
  })
})

// Default sort: by mode, time signature, onsets, then groupedDigitsString
// Mode rank: binary < octal < hex
const modeRank: Record<string, number> = { binary: 0, octal: 1, hex: 2 }
const sorted = computed(() => {
  const arr = filtered.value.slice()
  const byModeTsigOnsets = (a: any, b: any) => {
    const ar = modeRank[(a.base as string) ?? 'hex'] ?? 99
    const br = modeRank[(b.base as string) ?? 'hex'] ?? 99
    if (ar !== br) return ar - br
    const an = Number(a.numerator ?? 0), bn = Number(b.numerator ?? 0)
    if (an !== bn) return an - bn
    const ad = Number(a.denominator ?? 0), bd = Number(b.denominator ?? 0)
    if (ad !== bd) return ad - bd
    const ao = Number(a.onsets ?? 0), bo = Number(b.onsets ?? 0)
    if (ao !== bo) return ao - bo
    const ag = (a.groupedDigitsString ?? ''), bg = (b.groupedDigitsString ?? '')
    if (ag !== bg) return ag < bg ? -1 : 1
    return (a.id ?? '').localeCompare(b.id ?? '')
  }
  const byTsigModeOnsets = (a: any, b: any) => {
    const an = Number(a.numerator ?? 0), bn = Number(b.numerator ?? 0)
    if (an !== bn) return an - bn
    const ad = Number(a.denominator ?? 0), bd = Number(b.denominator ?? 0)
    if (ad !== bd) return ad - bd
    const ar = modeRank[(a.base as string) ?? 'hex'] ?? 99
    const br = modeRank[(b.base as string) ?? 'hex'] ?? 99
    if (ar !== br) return ar - br
    const ao = Number(a.onsets ?? 0), bo = Number(b.onsets ?? 0)
    if (ao !== bo) return ao - bo
    const ag = (a.groupedDigitsString ?? ''), bg = (b.groupedDigitsString ?? '')
    if (ag !== bg) return ag < bg ? -1 : 1
    return (a.id ?? '').localeCompare(b.id ?? '')
  }
  const byOnsetsModeTsig = (a: any, b: any) => {
    const ao = Number(a.onsets ?? 0), bo = Number(b.onsets ?? 0)
    if (ao !== bo) return ao - bo
    const ar = modeRank[(a.base as string) ?? 'hex'] ?? 99
    const br = modeRank[(b.base as string) ?? 'hex'] ?? 99
    if (ar !== br) return ar - br
    const an = Number(a.numerator ?? 0), bn = Number(b.numerator ?? 0)
    if (an !== bn) return an - bn
    const ad = Number(a.denominator ?? 0), bd = Number(b.denominator ?? 0)
    if (ad !== bd) return ad - bd
    const ag = (a.groupedDigitsString ?? ''), bg = (b.groupedDigitsString ?? '')
    if (ag !== bg) return ag < bg ? -1 : 1
    return (a.id ?? '').localeCompare(b.id ?? '')
  }
  const byAlpha = (a: any, b: any) => {
    const ag = (a.groupedDigitsString ?? ''), bg = (b.groupedDigitsString ?? '')
    if (ag !== bg) return ag < bg ? -1 : 1
    return (a.id ?? '').localeCompare(b.id ?? '')
  }
  const cmp = sortKey.value === 'mode-tsig-onsets' ? byModeTsigOnsets
    : sortKey.value === 'tsig-mode-onsets' ? byTsigModeOnsets
    : sortKey.value === 'onsets-mode-tsig' ? byOnsetsModeTsig
    : byAlpha
  arr.sort(cmp)
  return arr
})

const ROW_HEIGHT = 28
const BUFFER_ROWS = 20

const viewport = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const viewportHeight = ref(0)

const totalHeight = computed(() => sorted.value.length * ROW_HEIGHT)
const startIndex = computed(() => Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - BUFFER_ROWS))
const visibleCount = computed(() => Math.ceil(viewportHeight.value / ROW_HEIGHT) + BUFFER_ROWS * 2)
const endIndex = computed(() => Math.min(sorted.value.length, startIndex.value + visibleCount.value))
const visibleItems = computed(() => sorted.value.slice(startIndex.value, endIndex.value))

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