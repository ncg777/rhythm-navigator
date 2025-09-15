<template>
  <section class="relative">
    <header class="mb-3">
      <h2 class="text-lg font-semibold">Drum tracks</h2>
    </header>
    <div class="space-y-6 pb-2">
      <div v-for="t in renderTracks" :key="t.id" class="rounded border border-white/10 p-4">
        <div class="flex flex-wrap items-center gap-3">
          <select class="bg-slate-800 border border-white/10 rounded px-2 h-9" :value="t.type" @change="onTypeChange(t.id, ($event.target as HTMLSelectElement).value)">
            <option value="kick">Kick</option>
            <option value="snare">Snare</option>
            <option value="hat">Hat</option>
            <option value="perc">Perc</option>
          </select>
          <input class="bg-slate-800 border border-white/10 rounded px-2 h-9 w-40" :value="t.name" @input="onNameInput(t.id, $event)" />
          <div class="text-xs sm:text-sm text-slate-400 min-w-0 flex-1 truncate">
            <template v-if="t.pattern">
              <span class="mr-2">{{ t.pattern.mode }} {{ t.pattern.numerator }}/{{ t.pattern.denominator }}</span>
              <span>{{ t.pattern.groupedDigitsString }}</span>
            </template>
            <template v-else>No pattern assigned</template>
          </div>
          <button type="button" class="px-3 h-9 text-xs rounded border border-white/10 hover:bg-white/5" :disabled="!selected" @click.stop="assignToTrack(t.id)">Assign selected</button>
          <button type="button" class="px-3 h-9 text-xs rounded border border-red-500/30 hover:bg-red-500/10" @click.stop="removeTrack(t.id)">Remove</button>
        </div>
        <div class="mt-2 text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1" v-if="t.pattern">
          <span>{{ t.pattern.mode }}</span>
          <span>{{ t.pattern.numerator }}/{{ t.pattern.denominator }}</span>
          <span>bits: {{ t.pattern.totalBits }}</span>
          <span>cycle: {{ t.pattern.cycleQN.toFixed(3) }} qn</span>
        </div>
        <div class="grid gap-4 mt-4 text-sm" style="grid-template-columns: repeat(12, minmax(0, 1fr));">
          <div class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
            <span class="w-24 shrink-0 text-slate-400">Volume</span>
            <input class="flex-1" type="range" min="0" max="1" step="0.01" :value="t.volume" @input="onFieldInput(t.id, 'volume', $event)" />
          </div>
          <div class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
            <span class="w-24 shrink-0 text-slate-400">Pan</span>
            <input class="flex-1" type="range" min="-1" max="1" step="0.01" :value="t.pan" @input="onFieldInput(t.id, 'pan', $event)" />
          </div>
          <div class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
            <span class="w-24 shrink-0 text-slate-400">Velocity</span>
            <input class="flex-1" type="range" min="0" max="1" step="0.01" :value="t.velocity" @input="onFieldInput(t.id, 'velocity', $event)" />
          </div>
          <div class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
            <span class="w-24 shrink-0 text-slate-400">Vel random</span>
            <input class="flex-1" type="range" min="0" max="1" step="0.01" :value="t.velRandom" @input="onFieldInput(t.id, 'velRandom', $event)" />
          </div>
          <div class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
            <label class="flex items-center gap-2">
              <input type="checkbox" :checked="t.lfoEnabled" @change="onFieldCheckbox(t.id, 'lfoEnabled', $event)" />
              <span class="text-slate-400">LFO enabled</span>
            </label>
          </div>
          <div class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
            <span class="w-24 shrink-0 text-slate-400">LFO freq</span>
            <input class="w-28 bg-slate-800 border border-white/10 rounded px-2 py-1" type="number" min="0" step="0.01" :value="t.lfoFreq" @input="onFieldInput(t.id, 'lfoFreq', $event)" />
          </div>
          <div class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
            <span class="w-24 shrink-0 text-slate-400">LFO depth</span>
            <input class="flex-1" type="range" min="0" max="1" step="0.01" :value="t.lfoDepth" @input="onFieldInput(t.id, 'lfoDepth', $event)" />
          </div>
          <div class="col-span-12 lg:col-span-3 text-xs text-slate-400 flex items-center">Cycle: <span class="ml-1" v-if="t.pattern">{{ t.pattern.cycleQN.toFixed(3) }} qn</span><span v-else>—</span></div>
        </div>

        <!-- Instrument parameters -->
        <div class="mt-4 grid gap-4" style="grid-template-columns: repeat(12, minmax(0, 1fr));">
          <template v-if="t.type === 'kick'">
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Octaves</span>
              <input class="flex-1" type="range" min="0.5" max="6" step="0.1" :value="t.params.octaves as number" @input="onParamInput(t.id, 'octaves', $event)" />
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Pitch Decay</span>
              <input class="flex-1" type="range" min="0.001" max="1" step="0.001" :value="t.params.pitchDecay as number" @input="onParamInput(t.id, 'pitchDecay', $event)" />
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Attack</span>
              <input class="flex-1" type="range" min="0" max="1" step="0.001" :value="t.params.envA as number" @input="onParamInput(t.id, 'envA', $event)" />
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Decay</span>
              <input class="flex-1" type="range" min="0" max="2" step="0.001" :value="t.params.envD as number" @input="onParamInput(t.id, 'envD', $event)" />
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Sustain</span>
              <input class="flex-1" type="range" min="0" max="1" step="0.001" :value="t.params.envS as number" @input="onParamInput(t.id, 'envS', $event)" />
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Release</span>
              <input class="flex-1" type="range" min="0" max="2" step="0.001" :value="t.params.envR as number" @input="onParamInput(t.id, 'envR', $event)" />
            </label>
          </template>
          <template v-else-if="t.type === 'snare'">
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Noise</span>
              <select class="bg-slate-800 border border-white/10 rounded px-2 h-9" :value="t.params.noiseType as string" @change="onParamSelect(t.id, 'noiseType', $event)">
                <option value="white">white</option>
                <option value="pink">pink</option>
                <option value="brown">brown</option>
              </select>
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Attack</span>
              <input class="flex-1" type="range" min="0" max="1" step="0.001" :value="t.params.envA as number" @input="onParamInput(t.id, 'envA', $event)" />
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Decay</span>
              <input class="flex-1" type="range" min="0" max="2" step="0.001" :value="t.params.envD as number" @input="onParamInput(t.id, 'envD', $event)" />
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Release</span>
              <input class="flex-1" type="range" min="0" max="2" step="0.001" :value="t.params.envR as number" @input="onParamInput(t.id, 'envR', $event)" />
            </label>
          </template>
          <template v-else-if="t.type === 'hat'">
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Frequency</span>
              <input class="flex-1" type="range" min="50" max="8000" step="1" :value="t.params.frequency as number" @input="onParamInput(t.id, 'frequency', $event)" />
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Harmonicity</span>
              <input class="flex-1" type="range" min="0.1" max="20" step="0.1" :value="t.params.harmonicity as number" @input="onParamInput(t.id, 'harmonicity', $event)" />
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Mod Index</span>
              <input class="flex-1" type="range" min="1" max="100" step="1" :value="t.params.modulationIndex as number" @input="onParamInput(t.id, 'modulationIndex', $event)" />
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Resonance</span>
              <input class="flex-1" type="range" min="10" max="12000" step="1" :value="t.params.resonance as number" @input="onParamInput(t.id, 'resonance', $event)" />
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Octaves</span>
              <input class="flex-1" type="range" min="0.1" max="8" step="0.1" :value="t.params.octaves as number" @input="onParamInput(t.id, 'octaves', $event)" />
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Attack</span>
              <input class="flex-1" type="range" min="0" max="1" step="0.001" :value="t.params.envA as number" @input="onParamInput(t.id, 'envA', $event)" />
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Decay</span>
              <input class="flex-1" type="range" min="0" max="2" step="0.001" :value="t.params.envD as number" @input="onParamInput(t.id, 'envD', $event)" />
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Release</span>
              <input class="flex-1" type="range" min="0" max="2" step="0.001" :value="t.params.envR as number" @input="onParamInput(t.id, 'envR', $event)" />
            </label>
          </template>
          <template v-else>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Dampening</span>
              <input class="flex-1" type="range" min="100" max="12000" step="1" :value="t.params.dampening as number" @input="onParamInput(t.id, 'dampening', $event)" />
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Resonance</span>
              <input class="flex-1" type="range" min="0" max="1" step="0.01" :value="t.params.resonance as number" @input="onParamInput(t.id, 'resonance', $event)" />
            </label>
          </template>
        </div>
      </div>
    </div>
    <div class="pt-4 mt-4 border-t border-white/10">
      <button type="button" class="px-4 h-10 rounded border border-white/10 hover:bg-white/5" @click="addTrack()" title="Add a new percussion track">Add track</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useSequencerStore } from '@/stores/sequencerStore'
import { useRhythmStore } from '@/stores/rhythmStore'

const seq = useSequencerStore()
const { tracks, version } = storeToRefs(seq)
// Explicitly depend on tracks length and ids for v-for
const renderTracks = computed(() => tracks.value.map(t => t))

const rstore = useRhythmStore()
const { selected } = storeToRefs(rstore)

function assignToTrack(id: string) {
  if (!selected.value) return
  // Use current rhythm settings (numerator/denominator) with the selected pattern
  seq.assignRhythmToTrack(id, selected.value, rstore.numerator, rstore.denominator)
}

function onTypeChange(id: string, type: any) {
  seq.setTrackType(id, type)
}

function onNameInput(id: string, e: Event) {
  const v = (e.target as HTMLInputElement).value
  seq.updateTrackFields(id, { name: v })
}

function onFieldInput(id: string, key: 'volume'|'pan'|'velocity'|'velRandom'|'lfoFreq'|'lfoDepth', e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  seq.updateTrackFields(id, { [key]: v } as any)
}

function onFieldCheckbox(id: string, key: 'lfoEnabled', e: Event) {
  const v = (e.target as HTMLInputElement).checked
  seq.updateTrackFields(id, { [key]: v } as any)
}

function onParamInput(id: string, key: string, e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  seq.updateTrackParam(id, key, v)
}

function onParamSelect(id: string, key: string, e: Event) {
  const v = (e.target as HTMLSelectElement).value
  seq.updateTrackParam(id, key, v)
}

function addTrack() { seq.addTrack('perc') }
function removeTrack(id: string) { seq.removeTrack(id) }
</script>

<style scoped></style>
