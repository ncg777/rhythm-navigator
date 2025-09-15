<template>
  <div class="min-h-screen flex flex-col">
    <header class="sticky top-0 z-30 border-b border-white/10 bg-slate-900/70 backdrop-blur">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between">
        <h1 class="text-lg sm:text-xl font-semibold tracking-tight">Rhythm Navigator</h1>
        <div class="ml-4 glass rounded px-3 py-2"><TransportBar /></div>
      </div>
    </header>

    <main class="flex-1">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <SettingsPanel class="glass rounded-xl p-4" />
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <RhythmList class="glass rounded-xl p-4" />
          <RhythmRelations class="glass rounded-xl p-4 max-h-[60vh] overflow-auto" />
        </div>
        <DrumTracks class="glass rounded-xl p-6 w-full relative z-10" />
      </div>
    </main>

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
</script>

<style scoped></style>