<template>
  <div class="space-y-5">
    <!-- Info banner -->
    <p class="text-sm text-slate-400 leading-relaxed">
      Build rhythms from sequences. Each field accepts comma-separated alternatives;
      all combinations are generated as a cartesian product.
    </p>

    <!-- Input grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <!-- Composition -->
      <div class="sm:col-span-2">
        <label class="block text-xs uppercase tracking-wide text-slate-400 mb-1">
          Composition
          <span class="ml-1 normal-case text-slate-500">(space-separated positive integers)</span>
        </label>
        <input
          v-model="composition"
          type="text"
          placeholder="e.g.  4 4 4 4   or   4 4 4 4, 3 5 3 5"
          class="w-full bg-slate-800 border border-white/10 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-white/30"
          :class="{ 'border-red-500/60': fieldErrors.composition }"
          @input="clearErrors"
        />
        <p v-if="fieldErrors.composition" class="mt-1 text-xs text-red-400">{{ fieldErrors.composition }}</p>
      </div>

      <!-- Head / Tails -->
      <div>
        <label class="block text-xs uppercase tracking-wide text-slate-400 mb-1">
          Head / Tails
          <span class="ml-1 normal-case text-slate-500">(H or T tokens)</span>
        </label>
        <input
          v-model="headTails"
          type="text"
          placeholder="e.g.  H T H T   or   H, T"
          class="w-full bg-slate-800 border border-white/10 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-white/30"
          :class="{ 'border-red-500/60': fieldErrors.headTails }"
          @input="clearErrors"
        />
        <p v-if="fieldErrors.headTails" class="mt-1 text-xs text-red-400">{{ fieldErrors.headTails }}</p>
      </div>

      <!-- Durations -->
      <div>
        <label class="block text-xs uppercase tracking-wide text-slate-400 mb-1">
          Durations
          <span class="ml-1 normal-case text-slate-500">(pulse spacing, cycles)</span>
        </label>
        <input
          v-model="durations"
          type="text"
          placeholder="e.g.  1   or   1, 2"
          class="w-full bg-slate-800 border border-white/10 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-white/30"
          :class="{ 'border-red-500/60': fieldErrors.durations }"
          @input="clearErrors"
        />
        <p v-if="fieldErrors.durations" class="mt-1 text-xs text-red-400">{{ fieldErrors.durations }}</p>
      </div>

      <!-- Multiples -->
      <div>
        <label class="block text-xs uppercase tracking-wide text-slate-400 mb-1">
          Multiples
          <span class="ml-1 normal-case text-slate-500">(pulses per segment, cycles)</span>
        </label>
        <input
          v-model="multiples"
          type="text"
          placeholder="e.g.  2   or   1, 2, 3"
          class="w-full bg-slate-800 border border-white/10 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-white/30"
          :class="{ 'border-red-500/60': fieldErrors.multiples }"
          @input="clearErrors"
        />
        <p v-if="fieldErrors.multiples" class="mt-1 text-xs text-red-400">{{ fieldErrors.multiples }}</p>
      </div>
    </div>

    <!-- Mode info + combination count -->
    <div class="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 border-t border-white/10 pt-4">
      <span>
        Mode: <strong class="text-slate-200">{{ mode }}</strong>
        · {{ numerator }}/{{ denominator }}
        · {{ bitsPerDigit }} bit{{ bitsPerDigit !== 1 ? 's' : '' }}/digit
      </span>
      <span v-if="comboCount > 1" class="text-sky-400">
        {{ comboCount }} combinations will be generated
      </span>
    </div>

    <!-- Actions -->
    <div class="flex flex-wrap items-center gap-3">
      <button
        class="px-4 py-2 rounded bg-sky-700 hover:bg-sky-600 text-white text-sm font-medium disabled:opacity-40"
        :disabled="!canGenerate"
        @click="generate"
      >
        Generate
      </button>
      <button
        class="px-4 py-2 rounded border border-white/10 hover:bg-white/5 text-sm"
        @click="reset"
      >
        Reset
      </button>
      <span v-if="lastAdded !== null" class="text-xs" :class="lastAdded > 0 ? 'text-green-400' : 'text-slate-400'">
        {{ lastAdded > 0 ? `Added ${lastAdded} rhythm${lastAdded !== 1 ? 's' : ''}` : 'All duplicates — nothing new added' }}
      </span>
    </div>

    <!-- Error list -->
    <div v-if="generalErrors.length" class="rounded border border-red-500/40 bg-red-900/20 p-3 space-y-1">
      <p v-for="(err, i) in generalErrors" :key="i" class="text-xs text-red-300">{{ err }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRhythmStore } from '@/stores/rhythmStore'
import { useUiStore } from '@/stores/uiStore'
import { bitsPerDigitForMode } from '@/utils/rhythm'
import { expandCartesian, buildAllPulsations } from '@/utils/pulsations'

// ─── Store ────────────────────────────────────────────────────────────────────

const rhythmStore = useRhythmStore()
const uiStore = useUiStore()
const { mode, numerator, denominator } = storeToRefs(rhythmStore)

// ─── Local state ──────────────────────────────────────────────────────────────

const composition = ref('4 4 4 4')
const headTails = ref('H')
const durations = ref('1')
const multiples = ref('1')

const fieldErrors = ref<Partial<Record<'composition' | 'headTails' | 'durations' | 'multiples', string>>>({})
const generalErrors = ref<string[]>([])
const lastAdded = ref<number | null>(null)

// ─── Computed ─────────────────────────────────────────────────────────────────

const bitsPerDigit = computed(() => bitsPerDigitForMode(mode.value))

const comboCount = computed(() => {
  try {
    return expandCartesian({
      composition: composition.value,
      headTails: headTails.value,
      durations: durations.value,
      multiples: multiples.value
    }).length
  } catch {
    return 0
  }
})

const canGenerate = computed(
  () =>
    composition.value.trim().length > 0 &&
    headTails.value.trim().length > 0 &&
    durations.value.trim().length > 0 &&
    multiples.value.trim().length > 0
)

// ─── Actions ──────────────────────────────────────────────────────────────────

function clearErrors() {
  fieldErrors.value = {}
  generalErrors.value = []
  lastAdded.value = null
}

function generate() {
  clearErrors()

  const { items, errors } = buildAllPulsations(
    {
      composition: composition.value,
      headTails: headTails.value,
      durations: durations.value,
      multiples: multiples.value
    },
    mode.value,
    numerator.value,
    denominator.value
  )

  if (errors.length) {
    generalErrors.value = errors
  }

  const added = rhythmStore.addItems(items)
  lastAdded.value = items.length > 0 ? added : null

  if (items.length > 0) {
    const skipped = items.length - added
    const msg =
      added > 0
        ? `Pulsations: added ${added} rhythm${added !== 1 ? 's' : ''}${skipped > 0 ? ` (${skipped} duplicate${skipped !== 1 ? 's' : ''} skipped)` : ''}.`
        : `Pulsations: all ${skipped} generated rhythm${skipped !== 1 ? 's' : ''} already exist.`
    uiStore.pushToast(msg, added > 0 ? 'success' : 'info')
  } else if (!errors.length) {
    uiStore.pushToast('Pulsations: no valid rhythms produced. Check your inputs.', 'error')
  }
}

function reset() {
  composition.value = '4 4 4 4'
  headTails.value = 'H'
  durations.value = '1'
  multiples.value = '1'
  clearErrors()
}
</script>
