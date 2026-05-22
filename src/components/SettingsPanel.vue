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

      <div class="mt-3 grid gap-3 xl:grid-cols-2">
        <div class="rounded-lg border border-white/10 bg-slate-900/40 p-3">
          <div class="text-xs uppercase tracking-wide text-slate-400">Predicate Explain</div>
          <div v-if="!selected" class="mt-2 text-xs text-slate-500">
            Select a rhythm to see how the current predicate tree evaluates it.
          </div>
          <div v-else-if="!selectedPredicateExplanation" class="mt-2 text-xs text-slate-500">
            No explanation available.
          </div>
          <div v-else class="mt-2 space-y-2">
            <div class="text-xs" :class="selectedPredicateExplanation.result ? 'text-emerald-300' : 'text-rose-300'">
              {{ selectedPredicateExplanation.result ? 'Selected rhythm passes the current predicate tree.' : 'Selected rhythm fails the current predicate tree.' }}
            </div>
            <PredicateExplainTree :trace="selectedPredicateExplanation.trace" />
          </div>
        </div>

        <div class="rounded-lg border border-white/10 bg-slate-900/40 p-3">
          <div class="text-xs uppercase tracking-wide text-slate-400">Generator Guidance</div>
          <div class="mt-2 text-xs text-slate-400">Estimated search space: <b>{{ formatBigInt(searchSpaceSize) }}</b></div>
          <div class="mt-1 text-xs text-slate-400">Active predicate leaves: <b>{{ predicateLeafCount }}</b></div>
          <div v-if="guidanceHints.length" class="mt-3 space-y-2">
            <div v-for="hint in guidanceHints" :key="hint" class="rounded border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              {{ hint }}
            </div>
          </div>
          <div v-else class="mt-3 text-xs text-slate-500">
            Current settings look balanced. Use processed versus emitted counts to judge whether the filter tree is too loose or too strict.
          </div>
        </div>
      </div>
    </div>

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

    <div class="flex flex-wrap items-center gap-4 mt-2">
      <label class="text-xs uppercase tracking-wide text-slate-400">Method</label>
      <div class="flex items-center gap-2">
        <label class="flex items-center gap-1 cursor-pointer text-sm" :class="generationMethod === 'enumerate' ? 'text-white' : 'text-slate-500'">
          <input type="radio" v-model="generationMethod" value="enumerate" class="accent-brand-500" />
          Enumerate
        </label>
        <label class="flex items-center gap-1 cursor-pointer text-sm" :class="generationMethod === 'sample' ? 'text-white' : 'text-slate-500'">
          <input type="radio" v-model="generationMethod" value="sample" class="accent-brand-500" />
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
      <button class="px-4 py-2 rounded-md bg-brand-600 hover:bg-brand-500 transition" @click="isGenerating ? stop() : generate()">
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

    <div class="border-t border-white/10 pt-4 space-y-3">
      <h3 class="text-sm uppercase tracking-wide text-slate-400">Rhythm Matrix Generator</h3>
      <p class="text-xs text-slate-500">
        Generates random R×C matrices of rhythm segments. The predicate expression is enforced on
        the union of each adjacent row pair (cyclically) and on the full column union.
      </p>

      <div class="flex flex-wrap gap-4 items-end">
        <div>
          <label class="block text-xs uppercase tracking-wide text-slate-400">Rows</label>
          <input v-model.number="matrixRows" type="number" min="1" max="32" class="mt-1 bg-slate-800 border border-white/10 rounded px-3 py-2 w-20" />
        </div>
        <div>
          <label class="block text-xs uppercase tracking-wide text-slate-400">Columns</label>
          <input v-model.number="matrixColumns" type="number" min="1" max="32" class="mt-1 bg-slate-800 border border-white/10 rounded px-3 py-2 w-20" />
        </div>
        <div>
          <label class="block text-xs uppercase tracking-wide text-slate-400">Max attempts</label>
          <input v-model.number="matrixMaxAttempts" type="number" min="1" step="1000" class="mt-1 bg-slate-800 border border-white/10 rounded px-3 py-2 w-28" title="Maximum number of matrix construction attempts before stopping" />
        </div>
        <div>
          <label class="block text-xs uppercase tracking-wide text-slate-400">Max cell retries</label>
          <input v-model.number="matrixMaxCellRetries" type="number" min="1" step="10" class="mt-1 bg-slate-800 border border-white/10 rounded px-3 py-2 w-28" title="Maximum retries per cell before abandoning the current matrix attempt" />
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-4">
        <button class="px-4 py-2 rounded-md bg-violet-600 hover:bg-violet-500 transition" @click="isGeneratingMatrix ? stopMatrix() : generateMatrix()">
          {{ isGeneratingMatrix ? 'Stop matrix' : 'Generate matrix' }}
        </button>
        <button class="px-4 py-2 rounded-md border border-white/10 hover:bg-white/5 transition" @click="clearMatrixOutput()" :disabled="isGeneratingMatrix">
          Clear
        </button>
        <div class="text-xs text-slate-400 flex items-center gap-3 pl-3">
          <span>Attempts: <b>{{ matrixAttempts }}</b></span>
          <span>Emitted: <b>{{ matrixEmitted }}</b></span>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <input
          v-model="columnSequence"
          type="text"
          class="bg-slate-800 border border-white/10 rounded px-3 py-2 w-48 font-mono text-sm disabled:opacity-50"
          placeholder="e.g. 2,0,3"
          :disabled="!matrixOutput || isGeneratingMatrix"
          title="0-based column indices to select/reorder, comma-separated (e.g. 2,0,3)"
        />
        <button
          class="px-4 py-2 rounded-md bg-sky-700 hover:bg-sky-600 transition disabled:opacity-50"
          @click="applyColumnSequence()"
          :disabled="!matrixOutput || isGeneratingMatrix || !columnSequence.trim()"
          title="Create a new matrix with columns selected/reordered by the given 0-based sequence"
        >
          Sequence columns
        </button>
        <span class="text-xs text-slate-500">Comma-separated 0-based column indices</span>
      </div>

      <div v-if="matrixOutput || isGeneratingMatrix" class="relative w-full bg-slate-900 border border-white/10 rounded font-mono text-xs text-slate-200">
        <button v-if="matrixOutput" @click="copyMatrix" class="absolute top-2 right-2 px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 transition" title="Copy to clipboard">{{ copiedMatrix ? '✓ Copied' : 'Copy' }}</button>
        <pre class="px-3 py-2 overflow-x-auto whitespace-pre">{{ matrixOutput || 'Generating…' }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import PredicateExplainTree from '@/components/PredicateExplainTree.vue'
import PredicateTreeEditor from '@/components/PredicateTreeEditor.vue'
import { useRhythmStore } from '@/stores/rhythmStore'
import { bitsPerDigitForMode } from '@/utils/rhythm'
import { explainPredicateTree } from '@/utils/predicateEval'
import { parseDigitsFromGroupedString } from '@/utils/relations'

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
  matrixOutput,
  selected,
} = storeToRefs(store)

const totalDigits = computed(() => numerator.value * denominator.value)
const base = computed(() => (store.mode === 'binary' ? 2 : store.mode === 'octal' ? 8 : 16))
const processedMaxDisplay = computed(() => {
  const b = Number(base.value)
  const d = Number(totalDigits.value)
  const val = Math.pow(b, d)
  if (Number.isFinite(val) && val <= Number.MAX_SAFE_INTEGER) {
    return String(Math.trunc(val))
  }
  if (d <= 64) {
    try {
      const n = BigInt(b) ** BigInt(d)
      return n.toString()
    } catch {}
  }
  return `${b}^${d}`
})

const searchSpaceSize = computed(() => {
  const b = BigInt(base.value)
  const d = BigInt(totalDigits.value)
  if (d <= 0n) return 1n
  return b ** d
})

const predicateLeafCount = computed(() => countPredicateLeaves(predicateExpression.value))
const selectedPredicateExplanation = computed(() => {
  if (!selected.value) return null

  const digits = parseDigitsFromGroupedString(selected.value.groupedDigitsString, selected.value.base)
  const bitsPerDigit = bitsPerDigitForMode(selected.value.base)
  const onsets: number[] = []

  for (let digitIndex = 0; digitIndex < digits.length; digitIndex++) {
    const value = digits[digitIndex]
    const offset = digitIndex * bitsPerDigit
    for (let bitIndex = 0; bitIndex < bitsPerDigit; bitIndex++) {
      const bit = (value >> (bitsPerDigit - 1 - bitIndex)) & 1
      if (bit) onsets.push(offset + bitIndex)
    }
  }

  const trace = explainPredicateTree(predicateExpression.value, onsets, digits.length * bitsPerDigit)
  return {
    result: trace.result,
    trace,
  }
})

const guidanceHints = computed(() => {
  const hints: string[] = []
  const searchSpace = searchSpaceSize.value
  const emittedValue = Number(emitted.value)
  const processedValue = Number(processed.value)

  if (generationMethod.value === 'enumerate' && searchSpace > 1_000_000n) {
    hints.push(`Enumerating ${formatBigInt(searchSpace)} candidates will be expensive. Prefer Sample unless you need completeness.`)
  }
  if (generationMethod.value === 'sample' && searchSpace <= 65_536n) {
    hints.push(`This search space is only ${formatBigInt(searchSpace)} candidates. Enumerate can finish exhaustively.`)
  }
  if (predicateLeafCount.value >= 4) {
    hints.push(`There are ${predicateLeafCount.value} active predicate leaves. Nested filters will usually thin the result set quickly.`)
  }
  if (retentionProbability.value < 100) {
    hints.push(`Retention is ${retentionProbability.value}%, so valid rhythms are being randomly dropped after filtering.`)
  }
  if (processedValue >= 1000 && emittedValue === 0) {
    hints.push('No rhythms have been emitted yet. Relax one predicate or raise retention before increasing attempts.')
  } else if (processedValue > 0 && emittedValue > 0 && emittedValue / processedValue < 0.01) {
    hints.push('Current filters are very selective. Sampling may converge slowly unless you loosen the predicate tree.')
  }

  return hints
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

const columnSequence = ref('')

function applyColumnSequence() {
  store.applyColumnSequence(columnSequence.value)
}

const copiedMatrix = ref(false)
async function copyMatrix() {
  try {
    await navigator.clipboard.writeText(matrixOutput.value)
    copiedMatrix.value = true
    setTimeout(() => { copiedMatrix.value = false }, 2000)
  } catch (err) {
    console.warn('[SettingsPanel] clipboard write failed:', err)
  }
}

function countPredicateLeaves(node: { type: 'predicate' } | { type: 'and' | 'or'; children: any[] } | null | undefined): number {
  if (!node) return 0
  if (node.type === 'predicate') return 1
  return node.children.reduce((total, child) => total + countPredicateLeaves(child), 0)
}

function formatBigInt(value: bigint): string {
  const raw = value.toString()
  if (raw.length <= 9) return raw
  return `${raw.slice(0, 3)}e${raw.length - 1}`
}
</script>