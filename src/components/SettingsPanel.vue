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
      <PredicateTreeEditor
        :node="predicateExpression"
        @update="predicateExpression = $event"
      />
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

    <!-- Generation method toggle -->
    <div class="flex flex-wrap items-center gap-4 mt-2">
      <label class="text-xs uppercase tracking-wide text-slate-400">Method</label>
      <div class="flex items-center gap-2">
        <label class="flex items-center gap-1 cursor-pointer text-sm"
               :class="generationMethod === 'enumerate' ? 'text-white' : 'text-slate-500'">
          <input type="radio" v-model="generationMethod" value="enumerate"
                 class="accent-brand-500" />
          Enumerate
        </label>
        <label class="flex items-center gap-1 cursor-pointer text-sm"
               :class="generationMethod === 'sample' ? 'text-white' : 'text-slate-500'">
          <input type="radio" v-model="generationMethod" value="sample"
                 class="accent-brand-500" />
          Sample
        </label>
      </div>
      <div v-if="generationMethod === 'sample'" class="flex items-center gap-2">
        <label class="text-xs uppercase tracking-wide text-slate-400">Max attempts</label>
        <input
          v-model.number="maxSampleAttempts"
          type="number"
          min="1000"
          step="1000"
          class="bg-slate-800 border border-white/10 rounded px-3 py-2 w-32"
          title="Maximum random trials before stopping"
        />
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-4">
      <button
        class="px-4 py-2 rounded-md bg-brand-600 hover:bg-brand-500 transition"
        @click="isGenerating ? stop() : generate()"
      >
        {{ isGenerating ? 'Stop' : (generationMethod === 'sample' ? 'Sample' : 'Generate') }}
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
        <span>{{ generationMethod === 'sample' ? 'Attempts' : 'Processed' }}: <b>{{ processed }}</b><template v-if="generationMethod === 'enumerate'"> / {{ processedMaxDisplay }}</template></span>
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

    <!-- Matrix generator section -->
    <div class="border-t border-white/10 pt-4 space-y-3">
      <h3 class="text-sm uppercase tracking-wide text-slate-400">Rhythm Matrix Generator</h3>
      <p class="text-xs text-slate-500">
        Generates random R×C matrices of rhythm segments. The predicate expression is enforced on
        the union of each adjacent row pair (cyclically) and on the full column union.
      </p>

      <div class="flex flex-wrap gap-4 items-end">
        <div>
          <label class="block text-xs uppercase tracking-wide text-slate-400">Rows</label>
          <input v-model.number="matrixRows" type="number" min="1" max="32"
                 class="mt-1 bg-slate-800 border border-white/10 rounded px-3 py-2 w-20" />
        </div>
        <div>
          <label class="block text-xs uppercase tracking-wide text-slate-400">Columns</label>
          <input v-model.number="matrixColumns" type="number" min="1" max="32"
                 class="mt-1 bg-slate-800 border border-white/10 rounded px-3 py-2 w-20" />
        </div>
        <div>
          <label class="block text-xs uppercase tracking-wide text-slate-400">Max attempts</label>
          <input v-model.number="matrixMaxAttempts" type="number" min="1" step="1000"
                 class="mt-1 bg-slate-800 border border-white/10 rounded px-3 py-2 w-28"
                 title="Maximum number of matrix construction attempts before stopping" />
        </div>
        <div>
          <label class="block text-xs uppercase tracking-wide text-slate-400">Max cell retries</label>
          <input v-model.number="matrixMaxCellRetries" type="number" min="1" step="10"
                 class="mt-1 bg-slate-800 border border-white/10 rounded px-3 py-2 w-28"
                 title="Maximum retries per cell before abandoning the current matrix attempt" />
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-4">
        <button
          class="px-4 py-2 rounded-md bg-violet-600 hover:bg-violet-500 transition"
          @click="isGeneratingMatrix ? stopMatrix() : generateMatrix()"
        >
          {{ isGeneratingMatrix ? 'Stop matrix' : 'Generate matrix' }}
        </button>
        <button
          class="px-4 py-2 rounded-md border border-white/10 hover:bg-white/5 transition"
          @click="clearMatrixOutput()"
          :disabled="isGeneratingMatrix"
        >
          Clear
        </button>
        <div class="text-xs text-slate-400 flex items-center gap-3 pl-3">
          <span>Attempts: <b>{{ matrixAttempts }}</b></span>
          <span>Emitted: <b>{{ matrixEmitted }}</b></span>
        </div>
      </div>

      <textarea
        v-if="matrixOutput || isGeneratingMatrix"
        :value="matrixOutput"
        readonly
        rows="12"
        class="w-full bg-slate-900 border border-white/10 rounded px-3 py-2 font-mono text-xs text-slate-200 resize-y"
        placeholder="Generated matrices will appear here…"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useRhythmStore } from '@/stores/rhythmStore'
import { computed } from 'vue'
import PredicateTreeEditor from '@/components/PredicateTreeEditor.vue'

const store = useRhythmStore()
const {
  mode,
  numerator,
  denominator,
  predicateExpression,
  retentionProbability,
  generationMethod,
  maxSampleAttempts,
  isGenerating,
  processed,
  emitted,
  isAgglutinating,
  agglProcessed,
  agglEmitted,
  agglTotalPairs,
  matrixRows,
  matrixColumns,
  matrixMaxAttempts,
  matrixMaxCellRetries,
  isGeneratingMatrix,
  matrixAttempts,
  matrixEmitted,
  matrixOutput
} = storeToRefs(store)

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
function generateMatrix() { store.generateMatrix() }
function stopMatrix() { store.stopMatrix() }
function clearMatrixOutput() { store.clearMatrixOutput() }
</script>