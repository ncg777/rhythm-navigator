<template>
  <section>
    <header class="flex items-center justify-between">
      <h2 class="text-lg font-semibold">Rhythm details</h2>
      <div class="text-sm text-slate-400" v-if="selected">Onsets: {{ selected.onsets }}</div>
    </header>

    <div v-if="!selected" class="mt-6 text-slate-400 text-sm">
      Select a rhythm from the list to see details.
    </div>

    <div v-else class="mt-4 space-y-6 text-sm text-slate-300">
      <div class="glass rounded p-3">
        <div class="mb-1 font-medium">Digits (grouped)</div>
        <div class="font-mono break-all">{{ selected.groupedDigitsString }}</div>
      </div>

      <div class="glass rounded p-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <div class="text-slate-400 text-xs">Base</div>
          <div class="font-mono">{{ selected.base }}</div>
        </div>
        <div>
          <div class="text-slate-400 text-xs">Total bits</div>
          <div class="font-mono">{{ details.totalBits }}</div>
        </div>
        <div>
          <div class="text-slate-400 text-xs">Onsets</div>
          <div class="font-mono">{{ details.onsets }}</div>
        </div>
        <div>
          <div class="text-slate-400 text-xs">Rests</div>
          <div class="font-mono">{{ details.rests }}</div>
        </div>
        <div>
          <div class="text-slate-400 text-xs">Density</div>
          <div class="font-mono">{{ details.density }}</div>
        </div>
        <div>
          <div class="text-slate-400 text-xs">Shadow-iso (current)</div>
          <div class="font-mono" :class="details.shadowIsomorphic ? 'text-emerald-300' : 'text-rose-300'">
            {{ details.shadowIsomorphic ? 'Yes' : 'No' }}
          </div>
        </div>
      </div>

      <div class="glass rounded p-3">
        <div class="text-slate-400 text-xs mb-1">Canonical contour (current invariances)</div>
        <div class="font-mono">{{ details.contour }}</div>
      </div>

      <div class="glass rounded p-3">
        <div class="text-slate-400 text-xs mb-1">Shadow canonical contour</div>
        <div class="font-mono">{{ details.shadowContour }}</div>
      </div>

      <div class="glass rounded p-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <div class="text-slate-400 text-xs">Syncopation (LHL approx)</div>
          <div class="font-mono">{{ details.sync.lhlApprox }}</div>
        </div>
        <div>
          <div class="text-slate-400 text-xs">Offbeat weighted sum</div>
          <div class="font-mono">{{ details.sync.offbeatWeighted }}</div>
        </div>
        <div>
          <div class="text-slate-400 text-xs">On-beat / Off-beat</div>
          <div class="font-mono">{{ details.sync.onBeatCount }} / {{ details.sync.offBeatCount }}</div>
        </div>
        <div>
          <div class="text-slate-400 text-xs">Mean onset weight</div>
          <div class="font-mono">{{ details.sync.meanOnsetWeight.toFixed(3) }}</div>
        </div>
      </div>

      <div class="text-xs text-slate-400">
        Notes:
        - Metrical weights use binary halving within each beat (beat, half, quarter, …), with a small bonus on the downbeat.
        - LHL-approx: rest on a stronger position preceding an onset on a weaker position contributes to the score.
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRhythmStore } from '@/stores/rhythmStore'
import { bitsPerDigitForMode } from '@/utils/rhythm'
import { canonicalContourFromOnsets, shadowContourFromOnsets } from '@/utils/contour'
import { parseDigitsFromGroupedString } from '@/utils/relations'
import { bitsPerBeat, computeSyncopationMetrics } from '@/utils/syncopation'

const store = useRhythmStore()
const { selected, circular, rotationInvariant, reflectionInvariant, numerator, denominator } = storeToRefs(store)

function buildOnsetsFromDigits(digits: number[], bpd: number): { onsets: number[]; totalBits: number } {
  const totalBits = digits.length * bpd
  const onsets: number[] = []
  for (let j = 0; j < digits.length; j++) {
    const v = digits[j]
    const offset = j * bpd
    for (let i = 0; i < bpd; i++) {
      const bit = (v >> (bpd - 1 - i)) & 1
      if (bit) onsets.push(offset + i)
    }
  }
  return { onsets, totalBits }
}


const details = computed(() => {
  const sel = selected.value
  if (!sel) {
    return {
      totalBits: 0,
      onsets: 0,
      rests: 0,
      density: '0',
      contour: '',
      shadowContour: '',
      shadowIsomorphic: false,
      sync: { lhlApprox: 0, offbeatWeighted: 0, onBeatCount: 0, offBeatCount: 0, meanOnsetWeight: 0, maxWeight: 0 }
    }
  }

  const digits = parseDigitsFromGroupedString(sel.groupedDigitsString, sel.base)
  const bpd = bitsPerDigitForMode(sel.base)
  const { onsets, totalBits } = buildOnsetsFromDigits(digits, bpd)
  const rests = totalBits - onsets.length
  const density = totalBits ? (onsets.length / totalBits).toFixed(4) : '0'

  const opts = {
    circular: circular.value,
    rotationInvariant: rotationInvariant.value,
    reflectionInvariant: reflectionInvariant.value
  }

  const contour = canonicalContourFromOnsets(onsets, totalBits, opts)
  const shadowContour = shadowContourFromOnsets(onsets, totalBits, opts)
  const shadowIsomorphic = contour.length > 0 && contour === shadowContour

  const spb = bitsPerBeat(sel.base, denominator.value)
  const sync = computeSyncopationMetrics(onsets, totalBits, numerator.value, spb)

  return {
    totalBits,
    onsets: onsets.length,
    rests,
    density,
    contour,
    shadowContour,
    shadowIsomorphic,
    sync
  }
})
</script>