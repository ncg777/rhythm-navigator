<template>
  <section>
    <header class="flex items-center justify-between gap-4">
      <h2 class="text-lg font-semibold">All rhythms (representatives)</h2>
      <div class="flex items-center gap-3">
        <span class="text-sm text-slate-400">Count: {{ filtered.length }}</span>
        <SearchBar v-model="query" />
      </div>
    </header>

    <div v-if="!items.length" class="mt-6 text-slate-400 text-sm">No rhythms yet. Click "Generate" above to produce representatives under current settings.</div>

    <div v-else class="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <RhythmCard v-for="r in filtered" :key="r.id" :rhythm="r" :selected="selectedId === r.id" @select="select" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRhythmStore } from '@/stores/rhythmStore'
import RhythmCard from './RhythmCard.vue'
import SearchBar from './SearchBar.vue'
import { storeToRefs } from 'pinia'

const store = useRhythmStore()
const { items, selectedId } = storeToRefs(store)
const query = ref('')

const filtered = computed(() => {
  if (!query.value.trim()) return items.value
  const q = query.value.toLowerCase()
  return items.value.filter((r) => r.groupedDigitsString.toLowerCase().includes(q) || r.base.toLowerCase().includes(q) || r.canonicalContour.toLowerCase().includes(q))
})

function select(id: string) { store.select(id) }
</script>