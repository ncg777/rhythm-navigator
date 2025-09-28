<template>
  <teleport to="body">
    <Modal :open="open" @close="emit('close')">
      <template #title>
        <div class="flex items-center justify-between w-full">
          <h3 class="text-lg font-semibold">Select a rhythm</h3>
          <SearchBar v-model="query" />
        </div>
      </template>
      <div class="max-h-[70vh] overflow-y-auto">
        <div v-if="!items.length" class="text-slate-400 text-sm">No rhythms. Generate some first.</div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <RhythmCard v-for="r in filtered" :key="r.id" :rhythm="r" @select="pickById" />
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
