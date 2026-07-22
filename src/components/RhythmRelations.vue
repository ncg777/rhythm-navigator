<template>
  <section>
    <header class="flex items-center justify-between">
      <h2 class="text-lg font-semibold">Rhythm details</h2>
      <div v-if="selected" class="text-sm text-slate-400">Onsets: {{ selected.onsets }}</div>
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

      <div class="glass rounded p-3">
        <div class="text-slate-400 text-xs mb-1">Binary sequence</div>
        <div class="font-mono break-words">{{ details.binarySequence || 'None' }}</div>
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

      <div class="glass rounded p-3">
        <div class="text-slate-400 text-xs mb-1">IOI sequence (circular)</div>
        <div class="font-mono">{{ details.iois.length ? details.iois.join(' ') : 'None' }}</div>
      </div>

      <div class="glass rounded p-3 space-y-3">
        <div class="text-slate-400 text-xs">Rhythm grid</div>
        <RhythmBitGrid
          :totalBits="details.totalBits"
          :selectedOnsets="selectedPattern.onsets"
          :compareOnsets="comparisonPattern?.onsets ?? []"
          :columns="Math.max(8, Math.min(16, details.totalBits || 8))"
        />
      </div>

      <div class="glass rounded p-3 space-y-3">
        <div class="text-slate-400 text-xs">Rhythm circle</div>
        <RhythmCircleView
          :totalBits="details.totalBits"
          :selectedOnsets="selectedPattern.onsets"
          :compareOnsets="comparisonPattern?.onsets ?? []"
          :beats="details.tsNum"
        />
      </div>

      <div v-if="comparisonTarget" class="glass rounded p-3 space-y-3">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-slate-400 text-xs">Compare target</div>
            <div class="font-mono text-sm text-sky-300 break-all">{{ comparisonTarget.groupedDigitsString }}</div>
          </div>
          <div class="flex items-center gap-2">
            <button class="px-3 py-1 rounded border border-white/10 hover:bg-white/5 text-xs" @click="selectComparisonTarget">Select target</button>
            <button class="px-3 py-1 rounded border border-white/10 hover:bg-white/5 text-xs" @click="swapComparison">Swap</button>
            <button class="px-3 py-1 rounded border border-white/10 hover:bg-white/5 text-xs" @click="clearComparison">Clear</button>
          </div>
        </div>

        <div v-if="pairwise" class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <div class="text-slate-400 text-xs">Relation</div>
            <div class="font-mono">{{ comparisonLabels[pairwise.relation] }}</div>
          </div>
          <div>
            <div class="text-slate-400 text-xs">Shared onsets</div>
            <div class="font-mono">{{ pairwise.sharedOnsets }} / {{ pairwise.unionOnsets }}</div>
          </div>
          <div>
            <div class="text-slate-400 text-xs">Jaccard similarity</div>
            <div class="font-mono">{{ pairwise.jaccardSimilarity.toFixed(3) }}</div>
          </div>
          <div>
            <div class="text-slate-400 text-xs">Only selected</div>
            <div class="font-mono">{{ pairwise.onlyLeftOnsets }}</div>
          </div>
          <div>
            <div class="text-slate-400 text-xs">Only compare target</div>
            <div class="font-mono">{{ pairwise.onlyRightOnsets }}</div>
          </div>
          <div>
            <div class="text-slate-400 text-xs">Contour distance</div>
            <div class="font-mono">{{ pairwise.contourDistance }}</div>
          </div>
          <div>
            <div class="text-slate-400 text-xs">Syncopation delta</div>
            <div class="font-mono">{{ pairwise.syncopationDelta }}</div>
          </div>
          <div>
            <div class="text-slate-400 text-xs">Offbeat delta</div>
            <div class="font-mono">{{ pairwise.offbeatDelta }}</div>
          </div>
          <div>
            <div class="text-slate-400 text-xs">Density delta</div>
            <div class="font-mono">{{ pairwise.densityDelta.toFixed(4) }}</div>
          </div>
        </div>
        <div v-else class="text-xs text-slate-500">
          Select a different rhythm as the compare target.
        </div>
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
          Predicates show results for the selected rhythm. Use the <em>Generator &amp; Filters</em> panel to build filter expressions.
        </div>
      </div>

      <div class="text-xs text-slate-400">
        <button v-if="selected" class="mr-3 rounded border border-white/10 px-2 py-1 text-[11px] hover:bg-white/5" @click="setSelectedAsComparison">
          Use selected as compare target
        </button>
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
import * as Tone from 'tone'
import { useComparisonStore } from '@/stores/comparisonStore'
import RhythmBitGrid from '@/components/RhythmBitGrid.vue'
import RhythmCircleView from '@/components/RhythmCircleView.vue'
import { useRhythmStore } from '@/stores/rhythmStore'
import { useSequencerStore } from '@/stores/sequencerStore'
import { canonicalContourFromOnsets, shadowContourFromOnsets } from '@/utils/contour'
import { circularIntervals, isLowEntropy, hasNoGaps, hasOddIntervalsOddity, hasOrdinal, hasROP23, isMaximallyEven, noAntipodalPairs, relativelyFlat } from '@/utils/predicates'
import { onsetPatternFromGroupedDigits } from '@/utils/onsets'
import { parseDigitsFromGroupedString } from '@/utils/relations'
import { digitsToBits } from '@/utils/rhythm'
import { computePairwiseMetrics } from '@/utils/rhythmComparison'
import { bitsPerBeat, computeSyncopationMetrics } from '@/utils/syncopation'

const comparisonLabels: Record<string, string> = {
  same: 'Same rhythm',
  subset: 'Selected is a subset of compare target',
  superset: 'Selected is a superset of compare target',
  overlap: 'Selected overlaps compare target',
  disjoint: 'Selected and compare target are disjoint',
  incompatible: 'Rhythms have different bit lengths',
}

const store = useRhythmStore()
const { selected, numerator, denominator, mode } = storeToRefs(store)
const comparisonStore = useComparisonStore()
const seq = useSequencerStore()
const { bpm: seqBpm } = storeToRefs(seq)

const comparisonTarget = computed(() => store.items.find((item) => item.id === comparisonStore.secondaryId) ?? null)
const pairwise = computed(() => {
  if (!selected.value || !comparisonTarget.value) return null
  if (selected.value.id === comparisonTarget.value.id) return null
  return computePairwiseMetrics(selected.value, comparisonTarget.value)
})
const selectedPattern = computed(() => {
  if (!selected.value) return { onsets: [] as number[], totalBits: 0 }
  return onsetPatternFromGroupedDigits(selected.value.groupedDigitsString, selected.value.base)
})
const comparisonPattern = computed(() => {
  if (!comparisonTarget.value) return null
  return onsetPatternFromGroupedDigits(comparisonTarget.value.groupedDigitsString, comparisonTarget.value.base)
})

const details = computed(() => {
  const sel = selected.value
  if (!sel) {
    return {
      totalBits: 0,
      onsets: 0,
      rests: 0,
      density: '0',
      binarySequence: '',
      contour: '',
      shadowContour: '',
      iois: [] as number[],
      shadowIsomorphic: false,
      sync: { lhlApprox: 0, offbeatWeighted: 0, onBeatCount: 0, offBeatCount: 0, meanOnsetWeight: 0, maxWeight: 0 },
      predicates: {
        maximallyEven: false,
        rop23: false,
        oddIntervalsOddity: false,
        noAntipodes: true,
        lowEntropy: false,
        noGaps: false,
        relativelyFlat: false,
        ordinal: false,
      }
    }
  }

  const { onsets, totalBits } = onsetPatternFromGroupedDigits(sel.groupedDigitsString, sel.base)
  const rests = totalBits - onsets.length
  const density = totalBits ? (onsets.length / totalBits).toFixed(4) : '0'
  const digits = sel.digits ?? parseDigitsFromGroupedString(sel.groupedDigitsString, sel.base)
  const binarySequence = Array.from(digitsToBits(digits, sel.base), (bit) => (bit ? '1' : '0')).join(' ')
  const tsNum = typeof sel.numerator === 'number' && sel.numerator > 0 ? sel.numerator : numerator.value
  const tsDen = typeof sel.denominator === 'number' && sel.denominator > 0 ? sel.denominator : denominator.value
  const contour = canonicalContourFromOnsets(onsets, totalBits, { circular: true, rotationInvariant: true, reflectionInvariant: true })
  const shadowContour = shadowContourFromOnsets(onsets, totalBits, { circular: true, rotationInvariant: true, reflectionInvariant: true })
  const iois = circularIntervals(onsets, totalBits)
  const shadowIsomorphic = contour.length > 0 && contour === shadowContour
  const sync = computeSyncopationMetrics(onsets, totalBits, numerator.value, bitsPerBeat(sel.base, denominator.value))

  return {
    totalBits,
    onsets: onsets.length,
    rests,
    density,
    binarySequence,
    tsNum,
    tsDen,
    contour,
    shadowContour,
    iois,
    shadowIsomorphic,
    sync,
    predicates: {
      maximallyEven: isMaximallyEven(onsets, totalBits),
      rop23: hasROP23(onsets, totalBits),
      oddIntervalsOddity: hasOddIntervalsOddity(onsets, totalBits),
      noAntipodes: noAntipodalPairs(onsets, totalBits),
      lowEntropy: isLowEntropy(onsets, totalBits),
      noGaps: hasNoGaps(onsets, totalBits),
      relativelyFlat: relativelyFlat(onsets, totalBits),
      ordinal: hasOrdinal(onsets, totalBits, 4),
    }
  }
})

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

  const bitsPerStep = bitsPerBeat(mode.value, denominator.value)
  if (bitsPerStep <= 0 || !onsets.length || totalBits <= 0) return
  const beatDuration = 60 / seqBpm.value
  const bitDuration = beatDuration / bitsPerStep
  const events = onsets.map((position) => ({ time: position * bitDuration }))
  const loopEnd = totalBits * bitDuration

  if (part) {
    part.dispose()
    part = null
  }

  part = new Tone.Part((time: any) => {
    synth?.triggerAttackRelease('C5', 0.03, time)
  }, events)
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
  if (!isPlaying.value || !selected.value) return
  const { onsets, totalBits } = onsetPatternFromGroupedDigits(selected.value.groupedDigitsString, selected.value.base)
  startAudio(onsets, totalBits)
}

function togglePlay() {
  if (isPlaying.value) {
    stopAudio()
    isPlaying.value = false
    return
  }

  if (!selected.value) return
  const { onsets, totalBits } = onsetPatternFromGroupedDigits(selected.value.groupedDigitsString, selected.value.base)
  startAudio(onsets, totalBits).then(() => {
    isPlaying.value = true
  })
}

function clearComparison() {
  comparisonStore.clearSecondary()
}

function setSelectedAsComparison() {
  if (!selected.value) return
  comparisonStore.setSecondary(selected.value.id)
}

function selectComparisonTarget() {
  if (!comparisonTarget.value) return
  store.select(comparisonTarget.value.id)
}

function swapComparison() {
  if (!selected.value || !comparisonTarget.value) return
  const nextSelectedId = comparisonTarget.value.id
  comparisonStore.setSecondary(selected.value.id)
  store.select(nextSelectedId)
}

watch(seqBpm, () => {
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