<template>
  <div class="space-y-4">
    <div class="flex flex-wrap gap-4 items-end">
      <div>
        <label class="block text-xs uppercase tracking-wide text-slate-400">Mode</label>
        <select v-model="mode" class="mt-1 bg-slate-800 border border-white/10 rounded px-3 py-2">
          <option value="binary">Binary</option>
          <option value="octal">Octal</option>
          <option value="hex">Hexadecimal</option>
        </select>
      </div>

      <div>
        <label class="block text-xs uppercase tracking-wide text-slate-400">Numerator (beats)</label>
        <input v-model.number="numerator" type="number" min="1" class="mt-1 bg-slate-800 border border-white/10 rounded px-3 py-2 w-28" />
      </div>

      <div>
        <label class="block text-xs uppercase tracking-wide text-slate-400">Denominator (digits/beat)</label>
        <input v-model.number="denominator" type="number" min="1" class="mt-1 bg-slate-800 border border-white/10 rounded px-3 py-2 w-28" />
      </div>
    </div>

    <div class="border-t border-white/10 pt-4">
      <h3 class="text-sm uppercase tracking-wide text-slate-400 mb-2">Predicate Filters</h3>
  <div class="flex flex-wrap gap-4 items-center">
        <label class="flex items-center gap-2">
          <input type="checkbox" v-model="onlyIsomorphic" />
          <span class="text-sm text-slate-300">Only shadow-contour isomorphic</span>
        </label>

        <label class="flex items-center gap-2">
          <input type="checkbox" v-model="onlyMaximallyEven" />
          <span class="text-sm text-slate-300">Only maximally even (Euclidean)</span>
        </label>

        <label class="flex items-center gap-2">
          <input type="checkbox" v-model="onlyLowEntropy" />
          <span class="text-sm text-slate-300">Only low-entropy</span>
        </label>

        <label class="flex items-center gap-2">
          <input type="checkbox" v-model="onlyHasNoGaps" />
          <span class="text-sm text-slate-300">Only no-gap interval vector</span>
        </label>

        <label class="flex items-center gap-2">
          <input type="checkbox" v-model="onlyRelativelyFlat" />
          <span class="text-sm text-slate-300">Only relatively flat</span>
        </label>

        <div class="flex items-center gap-2">
          <label class="text-xs uppercase tracking-wide text-slate-400">Oddity</label>
          <select v-model="oddityType" class="bg-slate-800 border border-white/10 rounded px-3 py-2">
            <option value="off">Off</option>
            <option value="rop23">ROP (2/3)</option>
            <option value="odd-intervals">Odd-interval oddity</option>
            <option value="no-antipodes">No antipodal pairs</option>
          </select>
        </div>

        <div class="flex items-center gap-2">
          <label class="text-xs uppercase tracking-wide text-slate-400">Ordinal blocks (n)</label>
          <div class="flex items-center gap-2">
            <input v-model.number="ordinalN" type="number" min="2" class="bg-slate-800 border border-white/10 rounded px-3 py-2 w-24" />
            <label class="flex items-center gap-2">
              <input type="checkbox" v-model="ordinalEnabled" />
              <span class="text-sm text-slate-300">Enable</span>
            </label>
          </div>
        </div>

      </div>
    </div>

    <!-- Retention control on its own line above generate -->
    <div class="flex items-center gap-2 mt-2">
      <label class="text-xs uppercase tracking-wide text-slate-400">Retention</label>
      <div class="flex items-center gap-2">
        <input
          v-model.number="retentionProbability"
          type="number"
          min="0"
          max="100"
          step="1"
          class="bg-slate-800 border border-white/10 rounded px-3 py-2 w-20"
          title="Probability (0-100%) of keeping a valid rhythm"
        />
        <span class="text-sm text-slate-400">%</span>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-4">
      <button
        class="px-4 py-2 rounded-md bg-brand-600 hover:bg-brand-500 transition"
        @click="isGenerating ? stop() : generate()"
      >
        {{ isGenerating ? 'Stop' : 'Generate' }}
      </button>
      <button
        class="px-4 py-2 rounded-md border border-white/10 hover:bg-white/5 transition"
        @click="clear"
        :disabled="isGenerating"
        title="Clear generated results"
      >
        Clear
      </button>
      <div class="text-xs text-slate-400 flex items-center gap-3 pl-3">
        <span>Total digits: <b>{{ totalDigits }}</b> (base {{ base }})</span>
        <span>Processed: <b>{{ processed }}</b> / {{ processedMaxDisplay }}</span>
        <span>Emitted: <b>{{ emitted }}</b></span>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-4">
      <button
        class="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 transition disabled:opacity-50"
        @click="isAgglutinating ? stopAgglutination() : agglutinate()"
        :disabled="!canAgglutinate"
        :title="isAgglutinating ? 'Stop agglutination' : 'Generate all valid concatenations of pairs with the same time signature'"
      >
        {{ isAgglutinating ? 'Stop agglutination' : 'Agglutinate pairs' }}
      </button>
      <span class="text-xs text-slate-500">Concatenate all item pairs sharing the same time signature that satisfy current filters.</span>
      <span v-if="isAgglutinating" class="text-xs text-slate-400">
        {{ agglProcessed }} / {{ agglTotalPairs }} checked · added {{ agglEmitted }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useRhythmStore } from '@/stores/rhythmStore'
import { computed } from 'vue'

const store = useRhythmStore()
const {
  mode,
  numerator,
  denominator,
  onlyIsomorphic,
  onlyMaximallyEven,
  onlyLowEntropy,
  onlyHasNoGaps,
  onlyRelativelyFlat,
  oddityType,
  ordinalEnabled,
  ordinalN,
  isGenerating,
  processed,
  emitted
  , isAgglutinating
  , agglProcessed
  , agglEmitted
  , agglTotalPairs
} = storeToRefs(store)

// Retention percentage (0-100)
const { retentionProbability } = storeToRefs(store)

const totalDigits = computed(() => numerator.value * denominator.value)
const base = computed(() => (store.mode === 'binary' ? 2 : store.mode === 'octal' ? 8 : 16))
const processedMaxDisplay = computed(() => {
  const b = Number(base.value)
  const d = Number(totalDigits.value)
  // Try fast Number math within safe range
  const val = Math.pow(b, d)
  if (Number.isFinite(val) && val <= Number.MAX_SAFE_INTEGER) {
    return String(Math.trunc(val))
  }
  // For moderately large exponents, try BigInt with a reasonable cap
  if (d <= 64) {
    try {
      const n = (BigInt(b) ** BigInt(d))
      return n.toString()
    } catch {}
  }
  // Fallback to symbolic notation if too large
  return `${b}^${d}`
})

function generate() { store.generate() }
function stop() { store.stop() }
function clear() { store.clear() }
function agglutinate() { store.agglutinate() }
function stopAgglutination() { store.stopAgglutination() }
const canAgglutinate = computed(() => store.items.length > 1)
</script>