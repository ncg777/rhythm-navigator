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
        Convolve two rhythms using XOR circular convolution. Pick a carrier and impulse from
        your rhythm list. The result can be added back to the list.
      </p>

      <!-- Carrier -->
      <div>
        <label class="block text-xs uppercase tracking-wide text-slate-400 mb-1">Carrier</label>
        <div class="flex gap-2 items-center">
          <div
            class="flex-1 bg-slate-800 border rounded px-3 py-2 text-sm font-mono min-h-[38px] flex items-center"
            :class="errors.carrier ? 'border-red-500/60' : 'border-white/10'"
          >
            <span v-if="carrierRhythm" class="text-brand-300 break-all">{{ carrierRhythm.groupedDigitsString }}</span>
            <span v-else class="text-slate-500">No rhythm selected</span>
          </div>
          <button
            class="px-3 py-2 text-xs rounded border border-white/10 hover:bg-white/5 shrink-0"
            @click="carrierPickerOpen = true"
          >
            Pick
          </button>
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
        <label class="block text-xs uppercase tracking-wide text-slate-400 mb-1">Impulse</label>
        <div class="flex gap-2 items-center">
          <div
            class="flex-1 bg-slate-800 border rounded px-3 py-2 text-sm font-mono min-h-[38px] flex items-center"
            :class="errors.impulse ? 'border-red-500/60' : 'border-white/10'"
          >
            <span v-if="impulseRhythm" class="text-brand-300 break-all">{{ impulseRhythm.groupedDigitsString }}</span>
            <span v-else class="text-slate-500">No rhythm selected</span>
          </div>
          <button
            class="px-3 py-2 text-xs rounded border border-white/10 hover:bg-white/5 shrink-0"
            @click="impulsePickerOpen = true"
          >
            Pick
          </button>
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

  <!-- Rhythm pickers (teleported to body by RhythmPickerModal) -->
  <RhythmPickerModal :open="carrierPickerOpen" @close="carrierPickerOpen = false" @pick="onCarrierPick" />
  <RhythmPickerModal :open="impulsePickerOpen" @close="impulsePickerOpen = false" @pick="onImpulsePick" />
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import Modal from './Modal.vue'
import RhythmPickerModal from './RhythmPickerModal.vue'
import { convolveRhythms } from '@/utils/convolution'
import type { ConvolutionResult } from '@/utils/convolution'
import type { Mode, RhythmItem } from '@/utils/rhythm'
import { countOnsets, digitsToBits } from '@/utils/rhythm'
import { useRhythmStore } from '@/stores/rhythmStore'
import { useUiStore } from '@/stores/uiStore'
import { canonicalContourFromOnsets } from '@/utils/contour'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const store = useRhythmStore()
const ui = useUiStore()

const carrierId = ref<string | null>(null)
const impulseId = ref<string | null>(null)
const carrierScale = ref(1)
const impulseScale = ref(1)
const result = ref<ConvolutionResult | null>(null)
const convError = ref('')
const errors = reactive({ carrier: '', impulse: '' })

const carrierPickerOpen = ref(false)
const impulsePickerOpen = ref(false)

const carrierRhythm = computed(() =>
  carrierId.value ? store.items.find(r => r.id === carrierId.value) ?? null : null
)
const impulseRhythm = computed(() =>
  impulseId.value ? store.items.find(r => r.id === impulseId.value) ?? null : null
)

function onCarrierPick(id: string) {
  carrierId.value = id
  errors.carrier = ''
}

function onImpulsePick(id: string) {
  impulseId.value = id
  errors.impulse = ''
}

function validate(): boolean {
  errors.carrier = ''
  errors.impulse = ''
  convError.value = ''

  if (!carrierRhythm.value) {
    errors.carrier = 'Pick a carrier rhythm'
  }
  if (!impulseRhythm.value) {
    errors.impulse = 'Pick an impulse rhythm'
  }
  if (carrierRhythm.value && impulseRhythm.value && carrierRhythm.value.base !== impulseRhythm.value.base) {
    convError.value = 'Carrier and impulse must use the same mode (binary/octal/hex)'
  }
  return !errors.carrier && !errors.impulse && !convError.value
}

function runConvolution() {
  if (!validate()) return
  const cr = carrierRhythm.value!
  const ir = impulseRhythm.value!
  result.value = null
  convError.value = ''

  // Use the carrier's mode (validated to match impulse)
  const mode = cr.base
  const denom = cr.denominator || 1

  try {
    result.value = convolveRhythms({
      carrier: cr.groupedDigitsString,
      impulse: ir.groupedDigitsString,
      mode,
      carrierScale: carrierScale.value,
      impulseScale: impulseScale.value,
      denominator: denom
    })
  } catch (err: any) {
    convError.value = err?.message ?? 'Convolution failed'
  }
}

function addToList() {
  if (!result.value || !carrierRhythm.value) return
  const cr = carrierRhythm.value
  const mode = cr.base
  const denom = cr.denominator || 1

  const grouped = result.value.result

  // Parse digits from the grouped string
  const compact = grouped.replace(/\s+/g, '')
  const digits: number[] = []
  for (const c of compact) {
    if (mode === 'hex') {
      digits.push(parseInt(c, 16))
    } else {
      digits.push(c.charCodeAt(0) - 48) // '0' -> 0
    }
  }

  const bits = digitsToBits(digits, mode)
  const onsetCount = countOnsets(bits)
  const totalBits = bits.length
  const totalDigits = digits.length
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
    base: mode,
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
