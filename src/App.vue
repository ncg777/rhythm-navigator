<template>
  <div class="min-h-screen flex flex-col">
    <header class="sticky top-0 z-30 border-b border-white/10 bg-slate-900/70 backdrop-blur">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-3">
        <h1 class="text-lg sm:text-xl font-semibold tracking-tight">Rhythm Navigator</h1>
        <div class="flex items-center gap-2 ml-2">
          <div class="glass rounded px-3 py-2"><TransportBar /></div>
          <!-- Generated rhythms compact bar next to transport -->
          <div class="glass rounded px-3 py-2 hidden sm:flex items-center gap-3">
            <span class="text-lg">🎵</span>
            <div class="leading-tight">
              <div class="text-xs text-slate-300">Generated rhythms</div>
              <div class="text-[11px] text-slate-500">Cnt: {{ items.length }} · Digits: {{ numerator * denominator }} · Mode: {{ mode }}</div>
            </div>
            <div class="flex items-center gap-2 pl-2">
              <button class="px-2 py-1 text-xs rounded border border-white/10 hover:bg-white/5" @click="rhythmsOpen = true" title="Open generated rhythms browser">Open</button>
              <button class="px-2 py-1 text-xs rounded border border-white/10 hover:bg-white/5" title="Generator & filters" @click="settingsOpen = true">⚙</button>
            </div>
          </div>
        </div>
      </div>
    </header>

    <main class="flex-1">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
  <!-- Sequencer first -->
        <DrumTracks class="glass rounded-xl p-6 w-full relative z-10" />
      </div>
    </main>

    <!-- Settings modal -->
    <Modal :open="settingsOpen" @close="settingsOpen = false">
      <template #title>
        <h3 class="text-lg font-semibold">Generator & Filters</h3>
      </template>
      <SettingsPanel />
    </Modal>

    <!-- Generated rhythms modal -->
    <Modal :open="rhythmsOpen" @close="rhythmsOpen = false">
      <template #title>
        <div class="flex items-center gap-3">
          <span class="text-xl">🎵</span>
          <h3 class="text-lg font-semibold">Generated rhythms</h3>
          <span class="text-xs text-slate-500">Count: {{ items.length }} · Total digits: {{ numerator * denominator }} · Mode: {{ mode }}</span>
        </div>
      </template>
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <RhythmList class="glass rounded-xl p-4" />
        <RhythmRelations class="glass rounded-xl p-4 max-h-[60vh] overflow-auto" />
      </div>
    </Modal>

    <footer class="border-t border-white/10">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 text-sm text-slate-400">
        Built with Vue 3 + TypeScript · PWA enabled
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import SettingsPanel from '@/components/SettingsPanel.vue'
import RhythmList from '@/components/RhythmList.vue'
import RhythmRelations from '@/components/RhythmRelations.vue'
import TransportBar from '@/components/TransportBar.vue'
import DrumTracks from '@/components/DrumTracks.vue'
import Modal from '@/components/Modal.vue'
import { storeToRefs } from 'pinia'
import { useRhythmStore } from '@/stores/rhythmStore'
import { ref } from 'vue'

const r = useRhythmStore()
const { items, numerator, denominator, mode } = storeToRefs(r)
const rhythmsOpen = ref(false)
const settingsOpen = ref(false)
</script>

<style scoped></style>