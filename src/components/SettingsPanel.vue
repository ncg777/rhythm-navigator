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

      <div class="flex items-center gap-3">
        <label class="block text-xs uppercase tracking-wide text-slate-400">Max representatives</label>
        <input v-model.number="maxReps" type="number" min="1" class="mt-1 bg-slate-800 border border-white/10 rounded px-3 py-2 w-32" />
      </div>

      <div class="flex items-center gap-3">
        <label class="block text-xs uppercase tracking-wide text-slate-400">Onsets min</label>
        <input v-model.number="minOnsets" type="number" min="0" class="mt-1 bg-slate-800 border border-white/10 rounded px-3 py-2 w-24" />
      </div>

      <div class="flex items-center gap-3">
        <label class="block text-xs uppercase tracking-wide text-slate-400">Onsets max</label>
        <input v-model.number="maxOnsets" type="number" min="0" class="mt-1 bg-slate-800 border border-white/10 rounded px-3 py-2 w-24" />
      </div>

      <div class="flex-1"></div>

      <div class="flex items-center gap-3">
        <button class="px-4 py-2 rounded-md bg-brand-600 hover:bg-brand-500 transition" @click="generate" :disabled="isGenerating">
          {{ isGenerating ? 'Generating…' : 'Generate' }}
        </button>
        <button class="px-4 py-2 rounded-md border border-white/10 hover:bg-white/5 transition" @click="clear" :disabled="isGenerating" title="Clear generated results">
          Clear
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <label class="flex items-center gap-2">
        <input type="checkbox" v-model="circular" />
        <span class="text-sm text-slate-300">Circular contour</span>
      </label>
      <label class="flex items-center gap-2">
        <input type="checkbox" v-model="rotationInvariant" />
        <span class="text-sm text-slate-300">Rotation invariant</span>
      </label>
      <label class="flex items-center gap-2">
        <input type="checkbox" v-model="reflectionInvariant" />
        <span class="text-sm text-slate-300">Reflection invariant</span>
      </label>
      <label class="flex items-center gap-2">
        <input type="checkbox" v-model="excludeTrivial" />
        <span class="text-sm text-slate-300">Exclude all-zeros / all-ones</span>
      </label>
    </div>

    <p class="text-xs text-slate-400">
      Total digits: <b>{{ totalDigits }}</b> (base {{ base }}); total bits: <b>{{ totalBits }}</b>.
      Beware of combinatorial explosion: base^digits = {{ formatBig(approxTotal) }}.
    </p>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useRhythmStore } from '@/stores/rhythmStore'
import { computed } from 'vue'

const store = useRhythmStore()
const { mode, numerator, denominator, maxReps, minOnsets, maxOnsets, circular, rotationInvariant, reflectionInvariant, excludeTrivial, isGenerating } = storeToRefs(store)

const totalDigits = computed(() => numerator.value * denominator.value)
const base = computed(() => (store.mode === 'binary' ? 2 : store.mode === 'octal' ? 8 : 16))
const bitsPerDigit = computed(() => (store.mode === 'binary' ? 1 : store.mode === 'octal' ? 3 : 4))
const totalBits = computed(() => totalDigits.value * bitsPerDigit.value)
const approxTotal = computed(() => BigInt(base.value) ** BigInt(totalDigits.value))

function generate() { store.generate() }
function clear() { store.clear() }

function formatBig(n: bigint) {
  if (n > 10_000_000_000n) {
    const s = n.toString()
    return `${s[0]}.${s.slice(1, 4)}e+${s.length - 1}`
  }
  return n.toString()
}
</script>