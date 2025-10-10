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
      <div class="glass rounded p-3 flex items-center gap-3">
        <button class="px-3 py-1 rounded bg-brand-600 hover:bg-brand-500" @click="togglePlay">{{ isPlaying ? 'Stop' : 'Play' }}</button>
        <span class="text-slate-500 text-xs">Synthesized clave (uses global BPM)</span>
      </div>
      <div class="glass rounded p-3">
        <div class="mb-1 font-medium">Digits (grouped)</div>
        <div class="font-mono break-all">{{ selected.groupedDigitsString }}</div>
      </div>

      <div class="glass rounded p-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <div class="text-slate-400 text-xs">Mode</div>
          <div class="font-mono">{{ selected.base }}</div>
        </div>
        <div>
          <div class="text-slate-400 text-xs">Time sig (beats × digits/beat)</div>
          <div class="font-mono">{{ details.tsNum }} × {{ details.tsDen }}</div>
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
        <div class="text-slate-400 text-xs mb-1">Canonical contour (dihedral invariance)</div>
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

      <div class="glass rounded p-3">
        <div class="text-slate-400 text-xs mb-2">Music Theory Properties</div>
  <div class="grid grid-cols-2 sm:grid-cols-8 gap-3">
          <div>
            <div class="text-slate-400 text-[10px] uppercase">Maximally even</div>
            <div class="font-mono text-sm" :class="details.predicates.maximallyEven ? 'text-emerald-300' : 'text-slate-400'">
              {{ details.predicates.maximallyEven ? 'Yes' : 'No' }}
            </div>
          </div>
          <div>
            <div class="text-slate-400 text-[10px] uppercase">ROP {2,3}</div>
            <div class="font-mono text-sm" :class="details.predicates.rop23 ? 'text-emerald-300' : 'text-slate-400'">
              {{ details.predicates.rop23 ? 'Yes' : 'No' }}
            </div>
          </div>
          <div>
            <div class="text-slate-400 text-[10px] uppercase">Odd-interval oddity</div>
            <div class="font-mono text-sm" :class="details.predicates.oddIntervalsOddity ? 'text-emerald-300' : 'text-slate-400'">
              {{ details.predicates.oddIntervalsOddity ? 'Yes' : 'No' }}
            </div>
          </div>
          <div>
            <div class="text-slate-400 text-[10px] uppercase">No antipodes</div>
            <div class="font-mono text-sm" :class="details.predicates.noAntipodes ? 'text-emerald-300' : 'text-slate-400'">
              {{ details.predicates.noAntipodes ? 'Yes' : 'No' }}
            </div>
          </div>
          <div>
            <div class="text-slate-400 text-[10px] uppercase">Low entropy</div>
            <div class="font-mono text-sm" :class="details.predicates.lowEntropy ? 'text-emerald-300' : 'text-slate-400'">
              {{ details.predicates.lowEntropy ? 'Yes' : 'No' }}
            </div>
          </div>
          <div>
            <div class="text-slate-400 text-[10px] uppercase">No gaps</div>
            <div class="font-mono text-sm" :class="details.predicates.noGaps ? 'text-emerald-300' : 'text-slate-400'">
              {{ details.predicates.noGaps ? 'Yes' : 'No' }}
            </div>
          </div>
          <div>
            <div class="text-slate-400 text-[10px] uppercase">Relatively flat</div>
            <div class="font-mono text-sm" :class="details.predicates.relativelyFlat ? 'text-emerald-300' : 'text-slate-400'">
              {{ details.predicates.relativelyFlat ? 'Yes' : 'No' }}
            </div>
          </div>
          <div>
            <div class="text-slate-400 text-[10px] uppercase">Ordinal(n)</div>
            <div class="font-mono text-sm" :class="details.predicates.ordinal ? 'text-emerald-300' : 'text-slate-400'">
              {{ details.predicates.ordinal ? 'Yes' : 'No' }}
            </div>
          </div>
        </div>
        <div class="mt-2 text-xs text-slate-500">
          Current oddity filter: <span class="font-mono">{{ oddityType === 'off' ? 'Off' : oddityType === 'rop23' ? 'ROP (2/3)' : oddityType === 'odd-intervals' ? 'Odd-interval oddity' : 'No antipodal pairs' }}</span>
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
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRhythmStore } from '@/stores/rhythmStore'
import { useSequencerStore } from '@/stores/sequencerStore'
import { bitsPerDigitForMode } from '@/utils/rhythm'
import { canonicalContourFromOnsets, shadowContourFromOnsets } from '@/utils/contour'
import { parseDigitsFromGroupedString } from '@/utils/relations'
import { bitsPerBeat, computeSyncopationMetrics } from '@/utils/syncopation'
import { isMaximallyEven, hasROP23, hasOddIntervalsOddity, noAntipodalPairs, isLowEntropy, hasNoGaps, relativelyFlat, hasOrdinal } from '@/utils/predicates'
import * as Tone from 'tone'

const store = useRhythmStore()
const { selected, numerator, denominator, oddityType, ordinalEnabled, ordinalN, mode } = storeToRefs(store)
// Use global BPM from the sequencer store
const seq = useSequencerStore()
const { bpm: seqBpm } = storeToRefs(seq)

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
      sync: { lhlApprox: 0, offbeatWeighted: 0, onBeatCount: 0, offBeatCount: 0, meanOnsetWeight: 0, maxWeight: 0 },
      predicates: {
        maximallyEven: false,
        rop23: false,
        oddIntervalsOddity: false,
        noAntipodes: true
      }
    }
  }

  const digits = parseDigitsFromGroupedString(sel.groupedDigitsString, sel.base)
  const bpd = bitsPerDigitForMode(sel.base)
  const { onsets, totalBits } = buildOnsetsFromDigits(digits, bpd)
  const rests = totalBits - onsets.length
  const density = totalBits ? (onsets.length / totalBits).toFixed(4) : '0'
  // Determine display time signature (prefer per-item values when present)
  const tsNum = typeof sel.numerator === 'number' && sel.numerator > 0 ? sel.numerator : numerator.value
  const tsDen = typeof sel.denominator === 'number' && sel.denominator > 0 ? sel.denominator : denominator.value

  // Invariance is fixed to dihedral (circular + rotation + reflection)
  const opts = { circular: true, rotationInvariant: true, reflectionInvariant: true }

  const contour = canonicalContourFromOnsets(onsets, totalBits, opts)
  const shadowContour = shadowContourFromOnsets(onsets, totalBits, opts)
  const shadowIsomorphic = contour.length > 0 && contour === shadowContour

  const spb = bitsPerBeat(sel.base, denominator.value)
  const sync = computeSyncopationMetrics(onsets, totalBits, numerator.value, spb)

  // Calculate music theory predicates
  const maximallyEven = isMaximallyEven(onsets, totalBits)
  const rop23 = hasROP23(onsets, totalBits)
  const oddIntervalsOddity = hasOddIntervalsOddity(onsets, totalBits)
  const noAntipodes = noAntipodalPairs(onsets, totalBits)
  const lowEntropy = isLowEntropy(onsets, totalBits)
  const noGaps = hasNoGaps(onsets, totalBits)
  const relFlat = relativelyFlat(onsets, totalBits)
  const ord = ordinalEnabled.value && ordinalN.value >= 2 ? hasOrdinal(onsets, totalBits, ordinalN.value) : false

  return {
    totalBits,
    onsets: onsets.length,
    rests,
    density,
  tsNum,
  tsDen,
    contour,
    shadowContour,
    shadowIsomorphic,
    sync,
    predicates: {
      maximallyEven,
      rop23,
      oddIntervalsOddity,
      noAntipodes,
  lowEntropy,
  noGaps: noGaps,
  relativelyFlat: relFlat,
  ordinal: ord
    }
  }
})

// --- Playback (Tone.js)
const isPlaying = ref(false)
let part: any | null = null
let synth: any | null = null

async function startAudio(onsets: number[], totalBits: number) {
  await Tone.start()
  Tone.Transport.stop()
  Tone.Transport.cancel()
  Tone.Transport.bpm.value = seqBpm.value

  if (!synth) {
    synth = new Tone.MembraneSynth({
      pitchDecay: 0.008,
      octaves: 6,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0.0, release: 0.01 }
    }).toDestination()
  }

  // Compute timing in seconds based on BPM and bits-per-beat
  const spb = bitsPerBeat(mode.value, denominator.value) // bits per beat
  if (spb <= 0) return
  const beatDur = 60 / seqBpm.value
  const bitDur = beatDur / spb
  if (!onsets.length || totalBits <= 0) return
  const eventsSec = onsets.map((p) => p * bitDur)
  const loopEnd = totalBits * bitDur

  if (part) {
    part.dispose()
    part = null
  }

  part = new Tone.Part((time: any) => {
    if (synth) synth.triggerAttackRelease('C5', 0.03, time)
  }, eventsSec.map((t) => ({ time: t })))
  part.loop = true
  part.loopEnd = loopEnd
  part.start(0)

  Tone.Transport.start()
}

function stopAudio() {
  if (part) {
    part.stop()
    part.dispose()
    part = null
  }
  Tone.Transport.stop()
}

function rebuildIfPlaying() {
  if (!isPlaying.value) return
  const sel = selected.value
  if (!sel) return
  const digits = parseDigitsFromGroupedString(sel.groupedDigitsString, sel.base)
  const bpd = bitsPerDigitForMode(sel.base)
  const { onsets, totalBits } = buildOnsetsFromDigits(digits, bpd)
  startAudio(onsets, totalBits)
}

function togglePlay() {
  if (isPlaying.value) {
    stopAudio()
    isPlaying.value = false
    return
  }
  const sel = selected.value
  if (!sel) return
  const digits = parseDigitsFromGroupedString(sel.groupedDigitsString, sel.base)
  const bpd = bitsPerDigitForMode(sel.base)
  const { onsets, totalBits } = buildOnsetsFromDigits(digits, bpd)
  startAudio(onsets, totalBits).then(() => (isPlaying.value = true))
}

watch(seqBpm, (v) => {
  if (isPlaying.value) rebuildIfPlaying()
})

onBeforeUnmount(() => {
  stopAudio()
})

watch(selected, () => {
  if (isPlaying.value) {
    stopAudio()
    isPlaying.value = false
  }
})

watch([numerator, denominator, mode], () => {
  if (isPlaying.value) {
    stopAudio()
    isPlaying.value = false
  }
})
</script>