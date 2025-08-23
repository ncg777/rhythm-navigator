<template>
  <section>
    <header class="flex items-center justify-between">
      <h2 class="text-lg font-semibold">Related rhythms</h2>
      <div class="text-sm text-slate-400" v-if="selected">Selected onsets: {{ selected.onsets }}</div>
    </header>

    <div v-if="!selected" class="mt-6 text-slate-400 text-sm">Select a rhythm from the main list to see its subsets, supersets, and rotations (placeholder).</div>

    <div v-else class="mt-4 text-sm text-slate-300">
      <div class="mb-2 font-medium">Digits</div>
      <div class="font-mono">{{ selected.groupedDigitsString }}</div>
      <div class="mt-3">Contour: <span class="font-mono">{{ selected.canonicalContour }}</span></div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useRhythmStore } from '@/stores/rhythmStore'

const { selected } = storeToRefs(useRhythmStore())
</script>