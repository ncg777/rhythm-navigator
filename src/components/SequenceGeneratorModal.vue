<template>
  <Modal :open="open" @close="emit('close')">
    <template #title>
      <div class="flex items-center gap-3">
        <span class="text-xl">Seq</span>
        <h3 class="text-lg font-semibold">Rhythm-Driven Sequence Generator</h3>
      </div>
    </template>

    <div class="space-y-5">
      <p class="text-sm text-slate-400 leading-relaxed">
        Pick a rhythm, derive its onset-interval composition, and generate an integer-difference
        walk whose cumulative positions bounce inside your chosen range.
      </p>

      <div>
        <label class="block text-xs uppercase tracking-wide text-slate-400 mb-1">Rhythm</label>
        <div class="flex gap-2 items-center">
          <div
            class="flex-1 bg-slate-800 border rounded px-3 py-2 text-sm min-h-[38px] flex items-center"
            :class="fieldError ? 'border-red-500/60' : 'border-white/10'"
          >
            <span v-if="selectedRhythm" class="text-brand-300 font-mono break-all">{{ selectedRhythm.groupedDigitsString }}</span>
            <span v-else class="text-slate-500">No rhythm selected</span>
          </div>
          <button
            class="px-3 py-2 text-xs rounded border border-white/10 hover:bg-white/5 shrink-0"
            @click="pickerOpen = true"
          >
            Pick
          </button>
        </div>
        <p v-if="fieldError" class="mt-1 text-xs text-red-400">{{ fieldError }}</p>
      </div>

      <div v-if="compositionPreview" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="rounded border border-white/10 bg-slate-800/40 p-3 space-y-1">
          <div class="text-xs uppercase tracking-wide text-slate-400">Composition</div>
          <div class="font-mono text-sm text-slate-200 break-all">{{ formatSequence(compositionPreview.values) }}</div>
          <div class="text-xs text-slate-500">
            {{ compositionPreview.values.length }} durations · total {{ compositionPreview.totalDuration }}
          </div>
        </div>
        <div class="rounded border border-white/10 bg-slate-800/40 p-3 space-y-1">
          <div class="text-xs uppercase tracking-wide text-slate-400">Rhythm Summary</div>
          <div class="text-sm text-slate-200">{{ selectedRhythm?.onsets ?? 0 }} onsets · {{ selectedRhythm?.base ?? 'n/a' }}</div>
          <div class="text-xs text-slate-500">The generated sequence length will match onset count × repeat count.</div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label class="block text-xs uppercase tracking-wide text-slate-400 mb-1">Bounce Min</label>
          <input
            v-model.number="controls.min"
            type="number"
            class="w-full bg-slate-800 border border-white/10 rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label class="block text-xs uppercase tracking-wide text-slate-400 mb-1">Bounce Max</label>
          <input
            v-model.number="controls.max"
            type="number"
            class="w-full bg-slate-800 border border-white/10 rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label class="block text-xs uppercase tracking-wide text-slate-400 mb-1">Max Step Amplitude</label>
          <input
            v-model.number="controls.maxAmplitude"
            type="number"
            min="0"
            class="w-full bg-slate-800 border border-white/10 rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label class="block text-xs uppercase tracking-wide text-slate-400 mb-1">Repeat Rhythm</label>
          <input
            v-model.number="controls.repeatCount"
            type="number"
            min="1"
            class="w-full bg-slate-800 border border-white/10 rounded px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <button
          class="px-4 py-2 text-sm rounded bg-brand-600 hover:bg-brand-500 border border-white/10 font-medium disabled:opacity-40"
          :disabled="isGenerating || !store.items.length"
          @click="generate"
        >
          {{ isGenerating ? 'Generating...' : 'Generate sequence' }}
        </button>
        <span v-if="progressStage" class="text-xs text-slate-400">{{ progressStage }}</span>
      </div>

      <p v-if="runtimeError" class="text-sm text-red-400">{{ runtimeError }}</p>

      <div v-if="result" class="border-t border-white/10 pt-4 space-y-4">
        <div class="flex flex-wrap items-center gap-3">
          <button
            class="px-3 py-2 text-xs rounded border border-white/10 hover:bg-white/5 font-medium"
            @click="copySequence('differences')"
          >
            Copy differences
          </button>
          <button
            class="px-3 py-2 text-xs rounded border border-white/10 hover:bg-white/5 font-medium"
            @click="copySequence('positions')"
          >
            Copy positions
          </button>
          <button
            class="px-3 py-2 text-xs rounded border border-white/10 hover:bg-white/5 font-medium"
            @click="exportSequenceJson"
          >
            Export JSON
          </button>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div class="rounded border border-white/10 bg-slate-800/40 p-3 space-y-2">
            <div class="text-xs uppercase tracking-wide text-slate-400">Integer Differences</div>
            <div class="font-mono text-brand-300 text-sm break-all">{{ formatSequence(result.differences) }}</div>
          </div>
          <div class="rounded border border-white/10 bg-slate-800/40 p-3 space-y-2">
            <div class="text-xs uppercase tracking-wide text-slate-400">Bounced Positions</div>
            <div class="font-mono text-sky-300 text-sm break-all">{{ formatSequence(result.positions) }}</div>
          </div>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 text-xs text-slate-400">
          <div class="rounded border border-white/10 bg-slate-800/30 p-3 space-y-1">
            <div class="uppercase tracking-wide text-slate-500">Segmentation</div>
            <div>{{ result.segmentation.blocks.length }} blocks · score {{ formatScore(result.segmentation.score) }}</div>
          </div>
          <div class="rounded border border-white/10 bg-slate-800/30 p-3 space-y-1">
            <div class="uppercase tracking-wide text-slate-500">Selected Factors</div>
            <div class="font-mono text-slate-200">{{ result.selectedFactors.length ? formatSequence(result.selectedFactors) : 'none' }}</div>
          </div>
          <div class="rounded border border-white/10 bg-slate-800/30 p-3 space-y-1">
            <div class="uppercase tracking-wide text-slate-500">Start Position</div>
            <div class="font-mono text-slate-200">{{ result.start }}</div>
          </div>
        </div>

        <div class="rounded border border-white/10 bg-slate-800/30 p-3 space-y-3">
          <div class="text-xs uppercase tracking-wide text-slate-400">Phrase Library</div>
          <div class="space-y-2">
            <div
              v-for="(phrase, index) in result.phrases"
              :key="`${phrase.key}:${phrase.occurrence}:${index}`"
              class="flex flex-col gap-1 border border-white/5 rounded px-3 py-2"
            >
              <div class="text-slate-300">Block {{ index + 1 }} · {{ phrase.transform }} · occurrence {{ phrase.occurrence + 1 }}</div>
              <div class="font-mono text-[11px] text-slate-500 break-all">durations {{ phrase.key }}</div>
              <div class="font-mono text-brand-300 break-all">motif {{ formatSequence(phrase.values) }}</div>
            </div>
          </div>
        </div>
      </div>

      <p v-if="!store.items.length" class="text-sm text-slate-500">
        Generate or import at least one rhythm before using the sequence generator.
      </p>
    </div>
  </Modal>

  <RhythmPickerModal :open="pickerOpen" @close="pickerOpen = false" @pick="onPick" />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, toRaw, watch } from 'vue'

import Modal from './Modal.vue'
import RhythmPickerModal from './RhythmPickerModal.vue'
import { useRhythmStore } from '@/stores/rhythmStore'
import { useUiStore } from '@/stores/uiStore'
import { buildCompositionFromRhythm, type GeneratedSequence } from '@/utils/rhythmSequence'
import type { RhythmItem } from '@/utils/rhythm'

type WorkerOutMessage =
  | { type: 'progress'; progress: number; stage: string }
  | { type: 'result'; result: GeneratedSequence }
  | { type: 'done' }
  | { type: 'error'; message: string }

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const store = useRhythmStore()
const ui = useUiStore()

const selectedId = ref<string | null>(store.selectedId || null)
const pickerOpen = ref(false)
const isGenerating = ref(false)
const progressStage = ref('')
const fieldError = ref('')
const runtimeError = ref('')
const result = ref<GeneratedSequence | null>(null)
const worker = ref<Worker | null>(null)
const controls = reactive({ min: -7, max: 7, maxAmplitude: 4, repeatCount: 1 })

type CopyTarget = 'differences' | 'positions'

const selectedRhythm = computed(() =>
  selectedId.value ? store.items.find((item) => item.id === selectedId.value) ?? null : null
)

const compositionPreview = computed(() => {
  if (!selectedRhythm.value) return null
  try {
    return buildCompositionFromRhythm(selectedRhythm.value, controls.repeatCount)
  } catch {
    return null
  }
})

watch(
  () => props.open,
  (open) => {
    if (open && !selectedId.value && store.selectedId) {
      selectedId.value = store.selectedId
    }
    if (!open) {
      stopWorker()
      progressStage.value = ''
      runtimeError.value = ''
    }
  }
)

onBeforeUnmount(() => {
  stopWorker()
})

function stopWorker() {
  if (!worker.value) return
  worker.value.terminate()
  worker.value = null
  isGenerating.value = false
}

function onPick(id: string) {
  selectedId.value = id
  pickerOpen.value = false
  fieldError.value = ''
  runtimeError.value = ''
  result.value = null
}

function validate(): boolean {
  fieldError.value = ''
  runtimeError.value = ''

  if (!selectedRhythm.value) {
    fieldError.value = 'Pick a rhythm to generate a sequence from.'
    return false
  }
  if (!compositionPreview.value || compositionPreview.value.values.length === 0) {
    fieldError.value = 'The selected rhythm must contain at least one onset.'
    return false
  }
  if (!Number.isInteger(controls.min) || !Number.isInteger(controls.max)) {
    runtimeError.value = 'Bounce bounds must be integers.'
    return false
  }
  if (controls.min > controls.max) {
    runtimeError.value = 'Bounce minimum must be less than or equal to the maximum.'
    return false
  }
  if (!Number.isInteger(controls.maxAmplitude) || controls.maxAmplitude < 0) {
    runtimeError.value = 'Max step amplitude must be a non-negative integer.'
    return false
  }
  if (!Number.isInteger(controls.repeatCount) || controls.repeatCount <= 0) {
    runtimeError.value = 'Repeat count must be a positive integer.'
    return false
  }
  return true
}

function toPlainRhythmItem(item: RhythmItem): RhythmItem {
  const raw = toRaw(item) as RhythmItem
  return {
    id: raw.id,
    base: raw.base,
    groupedDigitsString: raw.groupedDigitsString,
    onsets: raw.onsets,
    canonicalContour: raw.canonicalContour,
    numerator: raw.numerator,
    denominator: raw.denominator,
    digits: raw.digits ? [...raw.digits] : undefined,
  }
}

function generate() {
  if (!validate()) return

  stopWorker()
  result.value = null
  isGenerating.value = true
  progressStage.value = 'Starting worker...'

  const instance = new Worker(new URL('@/workers/rhythmSequenceWorker.ts', import.meta.url), { type: 'module' })
  worker.value = instance

  instance.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
    const message = event.data
    if (message.type === 'progress') {
      progressStage.value = `${message.progress}% · ${message.stage}`
      return
    }
    if (message.type === 'result') {
      result.value = message.result
      runtimeError.value = ''
      return
    }
    if (message.type === 'error') {
      runtimeError.value = message.message
      ui.pushToast(message.message, 'error')
      return
    }
    if (message.type === 'done') {
      isGenerating.value = false
      worker.value = null
      instance.terminate()
    }
  }

  instance.postMessage({
    type: 'start',
    payload: {
      item: toPlainRhythmItem(selectedRhythm.value!),
      min: controls.min,
      max: controls.max,
      maxAmplitude: controls.maxAmplitude,
      repeatCount: controls.repeatCount,
    },
  })
}

async function copySequence(target: CopyTarget) {
  if (!result.value) return
  const values = target === 'differences' ? result.value.differences : result.value.positions
  const text = formatSequence(values)
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      copyViaTextarea(text)
    }
    ui.pushToast(`${target === 'differences' ? 'Differences' : 'Positions'} copied.`, 'success')
  } catch {
    try {
      copyViaTextarea(text)
      ui.pushToast(`${target === 'differences' ? 'Differences' : 'Positions'} copied.`, 'success')
    } catch {
      ui.pushToast('Copy failed in this browser context.', 'error')
    }
  }
}

function copyViaTextarea(text: string) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

function exportSequenceJson() {
  if (!result.value || !selectedRhythm.value || !compositionPreview.value) return

  const payload = {
    rhythm: {
      id: selectedRhythm.value.id,
      base: selectedRhythm.value.base,
      groupedDigitsString: selectedRhythm.value.groupedDigitsString,
      onsets: selectedRhythm.value.onsets,
      numerator: selectedRhythm.value.numerator,
      denominator: selectedRhythm.value.denominator,
    },
    controls: {
      min: controls.min,
      max: controls.max,
      maxAmplitude: controls.maxAmplitude,
      repeatCount: controls.repeatCount,
    },
    composition: compositionPreview.value,
    result: result.value,
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = buildExportFilename()
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
  ui.pushToast('Sequence exported as JSON.', 'success')
}

function buildExportFilename(): string {
  const stem = (selectedRhythm.value?.groupedDigitsString ?? 'sequence')
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 32) || 'sequence'
  return `rhythm-sequence-${stem}.json`
}

function formatSequence(values: number[]): string {
  return values.join(' ')
}

function formatScore(value: number): string {
  if (!Number.isFinite(value)) return 'inf'
  return value.toFixed(2)
}
</script>