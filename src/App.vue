<template>
  <div class="min-h-screen flex flex-col">
    <header class="sticky top-0 z-30 border-b border-white/10 bg-slate-900/70 backdrop-blur">
      <div class="mx-auto max-w-7xl px-2 sm:px-4 lg:px-8 py-2 flex flex-wrap items-center gap-2 overflow-x-auto">
        <h1 class="text-base sm:text-lg font-semibold tracking-tight shrink-0 pr-2">Rhythm Navigator</h1>

  <div class="glass rounded px-2 sm:px-3 py-2 flex-1 min-w-[260px]"><TransportBar /></div>

        <!-- Generated rhythms compact bar: visible on mobile, compressed -->
        <div class="glass rounded px-2 sm:px-3 py-2 flex items-center gap-2 ml-auto">
          <span class="text-base" aria-hidden="true">🎵</span>
          <div class="leading-tight hidden xs:block">
            <div class="text-[11px] text-slate-300">Rhythms</div>
            <div class="text-[10px] text-slate-500">{{ items.length }} · {{ numerator * denominator }} · {{ mode }}</div>
          </div>
          <button class="px-3 py-2 text-xs rounded border border-white/10 hover:bg-white/5" @click="rhythmsOpen = true" aria-label="Open generated rhythms">Open</button>
          <button class="px-3 py-2 text-xs rounded border border-white/10 hover:bg-white/5" title="Generator & filters" aria-label="Open generator settings" @click="settingsOpen = true">⚙</button>
        </div>
      </div>
    </header>

    <main class="flex-1">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
  <!-- Sequencer first -->
        <DrumTracks class="glass rounded-xl p-6 w-full relative z-10" />
      </div>
    </main>

  <!-- Global toast host -->
  <ToastHost />

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
import ToastHost from '@/components/ToastHost.vue'
import { storeToRefs } from 'pinia'
import { useRhythmStore } from '@/stores/rhythmStore'
import { ref } from 'vue'

const r = useRhythmStore()
const { items, numerator, denominator, mode } = storeToRefs(r)
const rhythmsOpen = ref(false)
const settingsOpen = ref(false)
</script>

<style scoped></style>

<!-- Global toast host -->
<ToastHost />