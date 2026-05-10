<template>
  <section class="relative">
    <header class="mb-3">
      <h2 class="text-lg font-semibold">Drum tracks</h2>
    </header>
    <div class="space-y-4 sm:space-y-6 pb-2">
      <div v-for="t in renderTracks" :key="t.id" class="rounded border border-white/10 p-3 sm:p-4">

        <!-- Track header: type selector, name, remove grouped together -->
        <div class="flex flex-wrap items-center gap-2">
          <select class="bg-slate-800 border border-white/10 rounded px-2 h-8 sm:h-9 text-sm" :value="t.type" @change="onTypeChange(t.id, ($event.target as HTMLSelectElement).value)">
            <option value="kick">Kick</option>
            <option value="snare">Snare</option>
            <option value="clap">Clap</option>
            <option value="hat">Hat</option>
            <option value="perc">Perc</option>
          </select>
          <input class="bg-slate-800 border border-white/10 rounded px-2 h-8 sm:h-9 min-w-0 flex-1 max-w-[200px] text-sm" :value="t.name" @input="onNameInput(t.id, $event)" />
          <button type="button" class="ml-auto px-2 sm:px-3 h-8 sm:h-9 text-xs rounded border border-red-500/30 hover:bg-red-500/10 shrink-0" @click.stop="removeTrack(t.id)">Remove</button>
        </div>

        <!-- Pattern chain -->
        <div class="mt-3 border-t border-white/5 pt-3">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-xs text-slate-400 font-medium uppercase tracking-wide">Patterns</span>
            <span class="text-[10px] text-slate-500">({{ t.patterns.length }} pattern{{ t.patterns.length !== 1 ? 's' : '' }})</span>
          </div>

          <div v-if="!t.patterns.length" class="text-sm text-slate-500 italic mb-2">No patterns — pick one to start</div>

          <div v-else class="space-y-1.5 mb-2">
            <div v-for="(entry, pi) in t.patterns" :key="pi" class="flex flex-wrap items-center gap-2 bg-slate-800/50 rounded px-2 py-1.5 text-xs sm:text-sm">
              <!-- Pattern info -->
              <span class="text-slate-300 truncate min-w-0 flex-1">
                <span class="text-slate-500 mr-1">{{ entry.pattern.mode }}</span>
                <span class="text-slate-400 mr-1">{{ entry.pattern.numerator }}/{{ entry.pattern.denominator }}</span>
                <span class="text-slate-300 font-mono">{{ entry.pattern.groupedDigitsString }}</span>
              </span>
              <!-- Repeat controls -->
              <div class="flex items-center gap-1 shrink-0">
                <span class="text-slate-500 text-[10px]">×</span>
                <button class="w-6 h-6 rounded border border-white/10 hover:bg-white/5 text-xs" @click="onRepeatDec(t.id, pi)">−</button>
                <input class="w-10 bg-slate-700 border border-white/10 rounded px-1 h-6 text-center text-xs"
                  type="number" min="1" max="99"
                  :value="entry.repeats"
                  @input="onRepeatInput(t.id, pi, $event)" />
                <button class="w-6 h-6 rounded border border-white/10 hover:bg-white/5 text-xs" @click="onRepeatInc(t.id, pi)">+</button>
              </div>
              <!-- Move / remove -->
              <div class="flex items-center gap-1 shrink-0">
                <button v-if="pi > 0" class="w-6 h-6 rounded border border-white/10 hover:bg-white/5 text-[10px]" @click="onMovePattern(t.id, pi, pi - 1)" title="Move up">↑</button>
                <button v-if="pi < t.patterns.length - 1" class="w-6 h-6 rounded border border-white/10 hover:bg-white/5 text-[10px]" @click="onMovePattern(t.id, pi, pi + 1)" title="Move down">↓</button>
                <button class="w-6 h-6 rounded border border-red-500/30 hover:bg-red-500/10 text-[10px]" @click="onRemovePattern(t.id, pi)" title="Remove pattern">×</button>
              </div>
            </div>
          </div>

          <!-- Chain info -->
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" class="px-3 h-8 text-xs rounded border border-white/10 hover:bg-white/5" @click.stop="openPicker(t.id)">+ Pick pattern…</button>
            <span v-if="t.patterns.length" class="text-[10px] text-slate-500">
              chain: {{ chainCycleQN(t).toFixed(2) }} qn
            </span>
          </div>
        </div>

        <!-- Mix controls (knobs) -->
        <div class="mt-3 border-t border-white/5 pt-3">
          <div class="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Mix</div>
          <div class="flex flex-wrap gap-3">
            <Knob :modelValue="t.noteLength" @update:modelValue="v => onFieldInput2(t.id, 'noteLength', v)"
              :min="0.01" :max="1" :step="0.01" label="Length" :defaultValue="0.5" :size="48" />
            <Knob :modelValue="t.volume" @update:modelValue="v => onFieldInput2(t.id, 'volume', v)"
              :min="0" :max="1" :step="0.01" label="Volume" :defaultValue="0.8" :size="48" />
            <Knob :modelValue="t.pan" @update:modelValue="v => onFieldInput2(t.id, 'pan', v)"
              :min="-1" :max="1" :step="0.01" label="Pan" :defaultValue="0" :size="48" color="#a78bfa" />
            <Knob :modelValue="t.velocity" @update:modelValue="v => onFieldInput2(t.id, 'velocity', v)"
              :min="0" :max="1" :step="0.01" label="Velocity" :defaultValue="0.8" :size="48" color="#fb923c" />
            <Knob :modelValue="t.velRandom" @update:modelValue="v => onFieldInput2(t.id, 'velRandom', v)"
              :min="0" :max="1" :step="0.01" label="Vel Rnd" :defaultValue="0" :size="48" color="#fb923c" />
            <Knob :modelValue="t.timeScale" @update:modelValue="v => onFieldInput2(t.id, 'timeScale', v)"
              :min="0.0625" :max="16" :step="0.0625" label="Time ×" :defaultValue="1" :size="48" color="#34d399" />
          </div>
        </div>

        <!-- Instrument parameters (knobs) -->
        <div class="mt-3 border-t border-white/5 pt-3">
          <div class="text-[10px] text-slate-500 uppercase tracking-wider mb-2">{{ t.type }} Synth</div>
          <div class="flex flex-wrap gap-3">
            <template v-if="t.type === 'kick'">
              <Knob :modelValue="(t.params.tune as number) ?? 55" @update:modelValue="v => onParam2(t.id, 'tune', v)"
                :min="30" :max="120" :step="1" label="Tune" :defaultValue="55" :size="48" color="#f472b6" />
              <Knob :modelValue="(t.params.click as number) ?? 0.5" @update:modelValue="v => onParam2(t.id, 'click', v)"
                :min="0" :max="1" :step="0.01" label="Click" :defaultValue="0.5" :size="48" color="#f472b6" />
              <Knob :modelValue="(t.params.sweep as number) ?? 4" @update:modelValue="v => onParam2(t.id, 'sweep', v)"
                :min="0.5" :max="8" :step="0.1" label="Sweep" :defaultValue="4" :size="48" color="#f472b6" />
              <Knob :modelValue="(t.params.sweepTime as number) ?? 0.04" @update:modelValue="v => onParam2(t.id, 'sweepTime', v)"
                :min="0.005" :max="0.2" :step="0.001" label="Swp Time" :defaultValue="0.04" :size="48" color="#f472b6" />
              <Knob :modelValue="(t.params.decay as number) ?? 0.4" @update:modelValue="v => onParam2(t.id, 'decay', v)"
                :min="0.05" :max="2" :step="0.01" label="Decay" :defaultValue="0.4" :size="48" color="#f472b6" />
              <Knob :modelValue="(t.params.sub as number) ?? 0.6" @update:modelValue="v => onParam2(t.id, 'sub', v)"
                :min="0" :max="1" :step="0.01" label="Sub" :defaultValue="0.6" :size="48" color="#f472b6" />
            </template>
            <template v-else-if="t.type === 'snare'">
              <Knob :modelValue="(t.params.tune as number) ?? 185" @update:modelValue="v => onParam2(t.id, 'tune', v)"
                :min="80" :max="500" :step="1" label="Tune" :defaultValue="185" :size="48" color="#fbbf24" />
              <Knob :modelValue="(t.params.toneDecay as number) ?? 0.12" @update:modelValue="v => onParam2(t.id, 'toneDecay', v)"
                :min="0.02" :max="0.5" :step="0.005" label="Tone Dec" :defaultValue="0.12" :size="48" color="#fbbf24" />
              <div class="inline-flex flex-col items-center" :style="{ width: '48px' }">
                <select class="bg-slate-800 border border-white/10 rounded px-1 h-7 text-[10px] w-full" :value="t.params.noiseType as string" @change="onParamSelect(t.id, 'noiseType', $event)">
                  <option value="white">white</option>
                  <option value="pink">pink</option>
                  <option value="brown">brown</option>
                </select>
                <div class="mt-0.5 text-[10px] text-slate-400 leading-tight">Noise</div>
              </div>
              <Knob :modelValue="(t.params.noiseDecay as number) ?? 0.2" @update:modelValue="v => onParam2(t.id, 'noiseDecay', v)"
                :min="0.02" :max="0.8" :step="0.005" label="Nse Dec" :defaultValue="0.2" :size="48" color="#fbbf24" />
              <Knob :modelValue="(t.params.snap as number) ?? 0.7" @update:modelValue="v => onParam2(t.id, 'snap', v)"
                :min="0" :max="1" :step="0.01" label="Snap" :defaultValue="0.7" :size="48" color="#fbbf24" />
              <Knob :modelValue="(t.params.mix as number) ?? 0.5" @update:modelValue="v => onParam2(t.id, 'mix', v)"
                :min="0" :max="1" :step="0.01" label="Mix" :defaultValue="0.5" :size="48" color="#fbbf24" />
            </template>
            <template v-else-if="t.type === 'clap'">
              <Knob :modelValue="(t.params.tune as number) ?? 220" @update:modelValue="v => onParam2(t.id, 'tune', v)"
                :min="100" :max="500" :step="1" label="Tune" :defaultValue="220" :size="48" color="#f97316" />
              <Knob :modelValue="(t.params.toneDecay as number) ?? 0.07" @update:modelValue="v => onParam2(t.id, 'toneDecay', v)"
                :min="0.02" :max="0.3" :step="0.005" label="Tone Dec" :defaultValue="0.07" :size="48" color="#f97316" />
              <div class="inline-flex flex-col items-center" :style="{ width: '48px' }">
                <select class="bg-slate-800 border border-white/10 rounded px-1 h-7 text-[10px] w-full" :value="t.params.noiseType as string" @change="onParamSelect(t.id, 'noiseType', $event)">
                  <option value="white">white</option>
                  <option value="pink">pink</option>
                  <option value="brown">brown</option>
                </select>
                <div class="mt-0.5 text-[10px] text-slate-400 leading-tight">Noise</div>
              </div>
              <Knob :modelValue="(t.params.noiseDecay as number) ?? 0.18" @update:modelValue="v => onParam2(t.id, 'noiseDecay', v)"
                :min="0.04" :max="0.5" :step="0.005" label="Nse Dec" :defaultValue="0.18" :size="48" color="#f97316" />
              <Knob :modelValue="(t.params.snap as number) ?? 0.85" @update:modelValue="v => onParam2(t.id, 'snap', v)"
                :min="0" :max="1" :step="0.01" label="Snap" :defaultValue="0.85" :size="48" color="#f97316" />
              <Knob :modelValue="(t.params.mix as number) ?? 0.82" @update:modelValue="v => onParam2(t.id, 'mix', v)"
                :min="0" :max="1" :step="0.01" label="Mix" :defaultValue="0.82" :size="48" color="#f97316" />
            </template>
            <template v-else-if="t.type === 'hat'">
              <Knob :modelValue="(t.params.tune as number) ?? 300" @update:modelValue="v => onParam2(t.id, 'tune', v)"
                :min="100" :max="1000" :step="1" label="Tune" :defaultValue="300" :size="48" color="#38bdf8" />
              <Knob :modelValue="(t.params.decay as number) ?? 0.08" @update:modelValue="v => onParam2(t.id, 'decay', v)"
                :min="0.01" :max="1" :step="0.005" label="Decay" :defaultValue="0.08" :size="48" color="#38bdf8" />
              <Knob :modelValue="(t.params.brightness as number) ?? 8000" @update:modelValue="v => onParam2(t.id, 'brightness', v)"
                :min="1000" :max="16000" :step="10" label="Bright" :defaultValue="8000" :size="48" color="#38bdf8" />
              <Knob :modelValue="(t.params.harmonicity as number) ?? 5.1" @update:modelValue="v => onParam2(t.id, 'harmonicity', v)"
                :min="1" :max="10" :step="0.1" label="Harmonic" :defaultValue="5.1" :size="48" color="#38bdf8" />
              <Knob :modelValue="(t.params.modIndex as number) ?? 32" @update:modelValue="v => onParam2(t.id, 'modIndex', v)"
                :min="5" :max="80" :step="1" label="Mod Idx" :defaultValue="32" :size="48" color="#38bdf8" />
            </template>
            <template v-else>
              <Knob :modelValue="(t.params.tune as number) ?? 200" @update:modelValue="v => onParam2(t.id, 'tune', v)"
                :min="60" :max="800" :step="1" label="Tune" :defaultValue="200" :size="48" color="#4ade80" />
              <Knob :modelValue="(t.params.decay as number) ?? 0.15" @update:modelValue="v => onParam2(t.id, 'decay', v)"
                :min="0.02" :max="1" :step="0.005" label="Decay" :defaultValue="0.15" :size="48" color="#4ade80" />
              <Knob :modelValue="(t.params.sweep as number) ?? 1" @update:modelValue="v => onParam2(t.id, 'sweep', v)"
                :min="0" :max="4" :step="0.1" label="Sweep" :defaultValue="1" :size="48" color="#4ade80" />
              <Knob :modelValue="(t.params.sweepTime as number) ?? 0.02" @update:modelValue="v => onParam2(t.id, 'sweepTime', v)"
                :min="0.005" :max="0.1" :step="0.001" label="Swp Time" :defaultValue="0.02" :size="48" color="#4ade80" />
              <Knob :modelValue="(t.params.snap as number) ?? 0.3" @update:modelValue="v => onParam2(t.id, 'snap', v)"
                :min="0" :max="1" :step="0.01" label="Snap" :defaultValue="0.3" :size="48" color="#4ade80" />
              <Knob :modelValue="(t.params.color as number) ?? 3000" @update:modelValue="v => onParam2(t.id, 'color', v)"
                :min="200" :max="8000" :step="10" label="Color" :defaultValue="3000" :size="48" color="#4ade80" />
            </template>
          </div>
        </div>

        <!-- Filter & Distortion -->
        <div class="mt-3 border-t border-white/5 pt-3">
          <div class="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Filter / Drive</div>
          <div class="flex flex-wrap gap-3 items-end">
            <Knob :modelValue="((t.params.distortionInputGain ?? 0) as number)" @update:modelValue="v => onParam2(t.id, 'distortionInputGain', v)"
              :min="-60" :max="120" :step="1" label="Drive dB" :defaultValue="0" :size="48" color="#ef4444" />

            <div class="inline-flex flex-col items-center" :style="{ width: '56px' }">
              <select class="bg-slate-800 border border-white/10 rounded px-1 h-7 text-[10px] w-full" :value="t.params.filterType as string" @change="onParamSelect(t.id, 'filterType', $event)">
                <option value="lowpass">LP</option>
                <option value="highpass">HP</option>
                <option value="bandpass">BP</option>
                <option value="notch">Notch</option>
                <option value="allpass">AP</option>
                <option value="peaking">Peak</option>
                <option value="lowshelf">LS</option>
                <option value="highshelf">HS</option>
              </select>
              <div class="mt-0.5 text-[10px] text-slate-400 leading-tight">Type</div>
            </div>
            <div class="inline-flex flex-col items-center" :style="{ width: '48px' }">
              <select class="bg-slate-800 border border-white/10 rounded px-1 h-7 text-[10px] w-full" :value="t.params.filterRolloff as number" @change="onParamSelect(t.id, 'filterRolloff', $event)">
                <option value="-12">6dB</option>
                <option value="-24">12dB</option>
                <option value="-48">24dB</option>
                <option value="-96">48dB</option>
              </select>
              <div class="mt-0.5 text-[10px] text-slate-400 leading-tight">Slope</div>
            </div>

            <Knob :modelValue="(t.params.filterFrequency as number) ?? 20000" @update:modelValue="v => onParam2(t.id, 'filterFrequency', v)"
              :min="20" :max="20000" :step="1" label="Freq" :defaultValue="20000" :size="48" color="#ef4444" />
            <Knob :modelValue="(t.params.filterResonance as number) ?? 1" @update:modelValue="v => onParam2(t.id, 'filterResonance', v)"
              :min="0.1" :max="10" :step="0.1" label="Reso" :defaultValue="1" :size="48" color="#ef4444" />
            <Knob :modelValue="((t.params.filterGain ?? 0) as number)" @update:modelValue="v => onParam2(t.id, 'filterGain', v)"
              :min="-24" :max="24" :step="0.5" label="Gain dB" :defaultValue="0" :size="48" color="#ef4444" />
            <Knob :modelValue="((t.params.velToFilter ?? 0) as number)" @update:modelValue="v => onParam2(t.id, 'velToFilter', v)"
              :min="-1" :max="1" :step="0.01" label="Vel→Flt" :defaultValue="0" :size="48" color="#ef4444" />
            <Knob :modelValue="((t.params.filterEnvTime ?? 0.15) as number)" @update:modelValue="v => onParam2(t.id, 'filterEnvTime', v)"
              :min="0" :max="1" :step="0.01" label="Env Time" :defaultValue="0.15" :size="48" color="#ef4444" />
          </div>
        </div>

        <!-- MIDI Key -->
        <div class="mt-3 border-t border-white/5 pt-3 flex items-center gap-3">
          <span class="text-[10px] text-slate-500 uppercase tracking-wider">MIDI Key</span>
          <input
            class="w-16 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-7 text-xs"
            type="number" min="0" max="127" step="1"
            :value="t.params.midiKey || defaultMidiKey(t.type)"
            @input="onParamInput(t.id, 'midiKey', $event)"
          />
        </div>
      </div>
    </div>
    <div class="pt-4 mt-4 border-t border-white/10">
      <button type="button" class="px-4 h-10 rounded border border-white/10 hover:bg-white/5" @click="addTrack()" title="Add a new percussion track">Add track</button>
    </div>

  <!-- Rhythm picker modal -->
  <RhythmPickerModal :open="pickerOpen" @close="pickerOpen = false" @pick="onPick" />
  </section>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useSequencerStore } from '@/stores/sequencerStore'
import { useRhythmStore } from '@/stores/rhythmStore'
import RhythmPickerModal from '@/components/RhythmPickerModal.vue'
import Knob from '@/components/Knob.vue'

const seq = useSequencerStore()
const { tracks, version } = storeToRefs(seq)
const renderTracks = computed(() => tracks.value.map(t => t))

const rstore = useRhythmStore()

function chainCycleQN(t: any): number {
  const ts = t.timeScale || 1
  return t.patterns.reduce((sum: number, e: any) => sum + e.pattern.cycleQN * e.repeats * ts, 0)
}

function onTypeChange(id: string, type: any) {
  seq.setTrackType(id, type)
}

function onNameInput(id: string, e: Event) {
  const v = (e.target as HTMLInputElement).value
  seq.updateTrackFields(id, { name: v })
}

function onFieldInput(id: string, key: 'volume'|'pan'|'velocity'|'velRandom'|'noteLength', e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  seq.updateTrackFields(id, { [key]: v } as any)
}

// Direct value update from Knob component (no Event needed)
function onFieldInput2(id: string, key: 'volume'|'pan'|'velocity'|'velRandom'|'noteLength'|'timeScale', v: number) {
  if (key === 'timeScale') {
    if (!Number.isFinite(v) || v <= 0) return
  }
  seq.updateTrackFields(id, { [key]: v } as any)
}

function onParam2(id: string, key: string, v: number) {
  seq.updateTrackParam(id, key, v)
}

function onTimeScaleInput(id: string, e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  if (!Number.isFinite(v) || v <= 0) return
  seq.updateTrackFields(id, { timeScale: v })
}

function onParamInput(id: string, key: string, e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  seq.updateTrackParam(id, key, v)
}

function onParamSelect(id: string, key: string, e: Event) {
  const v = (e.target as HTMLSelectElement).value
  seq.updateTrackParam(id, key, v)
}

// Pattern chain management
function onRemovePattern(trackId: string, index: number) {
  seq.removePatternFromTrack(trackId, index)
}

function onRepeatInput(trackId: string, index: number, e: Event) {
  const v = Math.max(1, Math.floor(Number((e.target as HTMLInputElement).value) || 1))
  seq.setPatternRepeats(trackId, index, v)
}

function onRepeatInc(trackId: string, index: number) {
  const t = tracks.value.find(x => x.id === trackId)
  if (!t || !t.patterns[index]) return
  seq.setPatternRepeats(trackId, index, t.patterns[index].repeats + 1)
}

function onRepeatDec(trackId: string, index: number) {
  const t = tracks.value.find(x => x.id === trackId)
  if (!t || !t.patterns[index]) return
  seq.setPatternRepeats(trackId, index, Math.max(1, t.patterns[index].repeats - 1))
}

function onMovePattern(trackId: string, from: number, to: number) {
  seq.movePatternInTrack(trackId, from, to)
}

function addTrack() { seq.addTrack('perc') }
function removeTrack(id: string) { seq.removeTrack(id) }

// Rhythm picker modal logic
const pickerOpen = ref(false)
const pickerTrackId = ref<string | null>(null)
function openPicker(trackId: string) {
  pickerTrackId.value = trackId
  pickerOpen.value = true
}
function onPick(id: string) {
  const item = rstore.items.find(r => r.id === id)
  if (!item || !pickerTrackId.value) return
  seq.assignRhythmToTrack(pickerTrackId.value, item, rstore.numerator, rstore.denominator)
}

function defaultMidiKey(type: string): number {
  switch (type) {
    case 'kick': return 36;
    case 'snare': return 38;
    case 'clap': return 39;
    case 'hat': return 42;
    case 'perc': return 40;
    default: return 36;
  }
}
</script>

<style scoped></style>
