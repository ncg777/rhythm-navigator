<template>
  <div class="rounded-lg border border-white/10 hover:border-brand-500/40 transition p-3 cursor-pointer" :class="{ 'ring-2 ring-brand-500/60': selected }" @click="$emit('select', rhythm.id)">
    <div class="flex items-center justify-between">
      <div class="text-sm font-mono text-brand-300 truncate" :title="digitsGrouped">{{ digitsGrouped }}</div>
      <div class="text-xs text-slate-400">{{ rhythm.onsets }} onsets</div>
    </div>
    <div class="mt-2 text-xs text-slate-400 font-mono truncate" :title="contour">contour: {{ contour }}</div>
  </div>
</template>

<script setup lang="ts">
import type { RhythmItem } from '@/utils/rhythm'
import { computed } from 'vue'

const props = defineProps<{ rhythm: RhythmItem; selected?: boolean }>()
const digitsGrouped = computed(() => props.rhythm.groupedDigitsString)
const contour = computed(() => props.rhythm.canonicalContour)
</script>