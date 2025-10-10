<template>
  <teleport to="body">
    <Modal :open="open" @close="emit('close')">
      <template #title>
        <div class="flex items-center justify-between w-full">
          <h3 class="text-lg font-semibold">Select a rhythm</h3>
          <div class="flex items-center gap-2">
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
        </div>
      </template>
      <div class="max-h-[70vh] overflow-y-auto">
        <div v-if="!items.length" class="text-slate-400 text-sm">No rhythms. Generate some first.</div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <RhythmCard v-for="r in sorted" :key="r.id" :rhythm="r" @select="pickById" />
        </div>
      </div>
    </Modal>
  </teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Modal from './Modal.vue'
import SearchBar from './SearchBar.vue'
import RhythmCard from './RhythmCard.vue'
import { useRhythmStore } from '@/stores/rhythmStore'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'pick', id: string): void }>()

const store = useRhythmStore()
const query = ref('')

const items = computed(() => store.items)
const sortKey = ref<'mode-tsig-onsets' | 'tsig-mode-onsets' | 'onsets-mode-tsig' | 'alpha'>('mode-tsig-onsets')
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

// Sorted view: mode -> numerator -> denominator -> onsets -> groupedDigitsString
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

function pickById(id: string) { emit('pick', id); emit('close') }
</script>

<style scoped>
/**** Ensure Modal is properly fixed and centered ****/
.fixed.inset-0 {
  display: flex;
  align-items: center;
  justify-content: center;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 50;
}
</style>
