<template>
  <Modal :open="open" @close="emit('close')">
    <template #title>
      <div class="flex items-center gap-3">
        <span class="text-xl">✳️</span>
        <h3 class="text-lg font-semibold">XOR Circular Convolution</h3>
      </div>
    </template>

    <div class="space-y-5">
      <p class="text-sm text-slate-400 leading-relaxed">
        Convolve two rhythms using XOR circular convolution. Enter carrier and impulse as
        grouped digit strings (spaces optional). The result can be added to your rhythm list.
      </p>

      <!-- Mode & denominator -->
      <div class="flex flex-wrap gap-4 items-end">
        <div>
          <label class="block text-xs uppercase tracking-wide text-slate-400 mb-1">Mode</label>
          <select v-model="mode" class="bg-slate-800 border border-white/10 rounded px-3 py-2 text-sm">
            <option value="binary">Binary</option>
            <option value="octal">Octal</option>
            <option value="hex">Hexadecimal</option>
          </select>
        </div>
        <div>
          <label class="block text-xs uppercase tracking-wide text-slate-400 mb-1">Digits per group</label>
          <input v-model.number="denominator" type="number" min="1" max="64"
            class="bg-slate-800 border border-white/10 rounded px-3 py-2 text-sm w-28" />
        </div>
      </div>

      <!-- Carrier -->
      <div>
        <label class="block text-xs uppercase tracking-wide text-slate-400 mb-1">
          Carrier
          <span class="ml-1 normal-case text-slate-500">(grouped digit string)</span>
        </label>
        <div class="flex gap-2 items-end">
          <input v-model="carrier" type="text" placeholder="e.g. F0 or 1010 1010"
            class="flex-1 bg-slate-800 border border-white/10 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-white/30"
            :class="{ 'border-red-500/60': errors.carrier }" />
          <div>
            <label class="block text-xs uppercase tracking-wide text-slate-400 mb-1">Scale</label>
            <input v-model.number="carrierScale" type="number" min="1" max="64"
              class="bg-slate-800 border border-white/10 rounded px-3 py-2 text-sm w-20" />
          </div>
        </div>
        <p v-if="errors.carrier" class="mt-1 text-xs text-red-400">{{ errors.carrier }}</p>
      </div>

      <!-- Impulse -->
      <div>
        <label class="block text-xs uppercase tracking-wide text-slate-400 mb-1">
          Impulse
          <span class="ml-1 normal-case text-slate-500">(grouped digit string)</span>
        </label>
        <div class="flex gap-2 items-end">
          <input v-model="impulse" type="text" placeholder="e.g. 80 or 1000 0000"
            class="flex-1 bg-slate-800 border border-white/10 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-white/30"
            :class="{ 'border-red-500/60': errors.impulse }" />
          <div>
            <label class="block text-xs uppercase tracking-wide text-slate-400 mb-1">Scale</label>
            <input v-model.number="impulseScale" type="number" min="1" max="64"
              class="bg-slate-800 border border-white/10 rounded px-3 py-2 text-sm w-20" />
          </div>
        </div>
        <p v-if="errors.impulse" class="mt-1 text-xs text-red-400">{{ errors.impulse }}</p>
      </div>

      <!-- Actions -->
      <div class="flex flex-wrap gap-3">
        <button
          class="px-4 py-2 text-sm rounded bg-brand-600 hover:bg-brand-500 border border-white/10 font-medium"
          @click="runConvolution"
        >
          Convolve
        </button>
        <button
          v-if="result"
          class="px-4 py-2 text-sm rounded border border-white/10 hover:bg-white/5 font-medium"
          @click="addToList"
        >
          Add result to rhythm list
        </button>
      </div>

      <!-- Result -->
      <div v-if="result" class="border-t border-white/10 pt-4 space-y-2">
        <h4 class="text-sm uppercase tracking-wide text-slate-400">Result</h4>
        <div class="bg-slate-800/50 rounded p-3 space-y-1">
          <div class="font-mono text-brand-300 text-base break-all">{{ result.result }}</div>
          <div class="text-xs text-slate-500 flex flex-wrap gap-4 mt-2">
            <span>Length: {{ result.resultLength }} bits</span>
            <span>Onsets: {{ result.onsets }}</span>
            <span>Carrier: {{ result.carrierLength }} bits</span>
            <span>Impulse: {{ result.impulseLength }} bits</span>
          </div>
        </div>
      </div>

      <!-- Error message -->
      <p v-if="convError" class="text-sm text-red-400">{{ convError }}</p>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import Modal from './Modal.vue'
import { convolveRhythms } from '@/utils/convolution'
import type { ConvolutionResult } from '@/utils/convolution'
import type { Mode, RhythmItem } from '@/utils/rhythm'
import { bitsPerDigitForMode, countOnsets, digitsToBits } from '@/utils/rhythm'
import { useRhythmStore } from '@/stores/rhythmStore'
import { useUiStore } from '@/stores/uiStore'
import { canonicalContourFromOnsets } from '@/utils/contour'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const store = useRhythmStore()
const ui = useUiStore()

const mode = ref<Mode>('hex')
const denominator = ref(1)
const carrier = ref('')
const impulse = ref('')
const carrierScale = ref(1)
const impulseScale = ref(1)
const result = ref<ConvolutionResult | null>(null)
const convError = ref('')
const errors = reactive({ carrier: '', impulse: '' })

function validate(): boolean {
  errors.carrier = ''
  errors.impulse = ''
  convError.value = ''

  if (!carrier.value.trim()) {
    errors.carrier = 'Carrier is required'
  }
  if (!impulse.value.trim()) {
    errors.impulse = 'Impulse is required'
  }
  return !errors.carrier && !errors.impulse
}

function runConvolution() {
  if (!validate()) return
  result.value = null
  convError.value = ''

  try {
    result.value = convolveRhythms({
      carrier: carrier.value.trim(),
      impulse: impulse.value.trim(),
      mode: mode.value,
      carrierScale: carrierScale.value,
      impulseScale: impulseScale.value,
      denominator: denominator.value
    })
  } catch (err: any) {
    convError.value = err?.message ?? 'Convolution failed'
  }
}

function addToList() {
  if (!result.value) return

  const grouped = result.value.result
  const bpd = bitsPerDigitForMode(mode.value)

  // Parse digits from the grouped string
  const compact = grouped.replace(/\s+/g, '')
  const digits: number[] = []
  for (const c of compact) {
    if (mode.value === 'hex') {
      digits.push(parseInt(c, 16))
    } else {
      digits.push(c.charCodeAt(0) - 48) // '0' -> 0
    }
  }

  const bits = digitsToBits(digits, mode.value)
  const onsetCount = countOnsets(bits)
  const totalBits = bits.length
  const totalDigits = digits.length
  const denom = denominator.value || 1
  const numerator = Math.ceil(totalDigits / denom)

  // Compute onset positions for contour calculation
  const onsetPositions: number[] = []
  for (let i = 0; i < totalBits; i++) {
    if (bits[i]) onsetPositions.push(i)
  }
  const canonicalOpts = { circular: true, rotationInvariant: true, reflectionInvariant: true }
  const contour = canonicalContourFromOnsets(onsetPositions, totalBits, canonicalOpts)

  const item: RhythmItem = {
    id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    base: mode.value,
    groupedDigitsString: grouped,
    onsets: onsetCount,
    canonicalContour: contour,
    numerator,
    denominator: denom,
    digits
  }

  const added = store.addItems([item])
  if (added > 0) {
    ui.pushToast('Convolution result added to rhythm list.', 'success')
  } else {
    ui.pushToast('Rhythm already exists in the list.', 'info')
  }
}
</script>
