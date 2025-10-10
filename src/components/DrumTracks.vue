<template>
  <section class="relative">
    <header class="mb-3">
      <h2 class="text-lg font-semibold">Drum tracks</h2>
    </header>
    <div class="space-y-4 sm:space-y-6 pb-2">
      <div v-for="t in renderTracks" :key="t.id" class="rounded border border-white/10 p-3 sm:p-4">
        <div class="flex flex-wrap items-center gap-3">
          <select class="bg-slate-800 border border-white/10 rounded px-2 h-8 sm:h-9" :value="t.type" @change="onTypeChange(t.id, ($event.target as HTMLSelectElement).value)">
            <option value="kick">Kick</option>
            <option value="snare">Snare</option>
            <option value="hat">Hat</option>
            <option value="perc">Perc</option>
          </select>
          <input class="bg-slate-800 border border-white/10 rounded px-2 h-8 sm:h-9 w-32 sm:w-40" :value="t.name" @input="onNameInput(t.id, $event)" />
          <div class="w-full sm:flex-1 order-3 sm:order-none text-xs sm:text-sm text-slate-400 whitespace-normal break-words">
            <template v-if="t.pattern">
              <span class="mr-2">{{ t.pattern.mode }} {{ t.pattern.numerator }}/{{ t.pattern.denominator }}</span>
              <span>{{ t.pattern.groupedDigitsString }}</span>
            </template>
            <template v-else>
              <div class="pattern-placeholder">No pattern selected</div>
            </template>
          </div>
          <button type="button" class="px-2 sm:px-3 h-8 sm:h-9 text-xs rounded border border-white/10 hover:bg-white/5" @click.stop="openPicker(t.id)">Pick…</button>
          <button type="button" class="px-2 sm:px-3 h-8 sm:h-9 text-xs rounded border border-red-500/30 hover:bg-red-500/10" @click.stop="removeTrack(t.id)">Remove</button>
        </div>
        <!-- Updated layout for better readability on mobile -->
        <div class="mt-2 text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1" v-if="t.pattern">
          <span class="block w-full sm:w-auto">bits: {{ t.pattern.totalBits }}</span>
          <span class="block w-full sm:w-auto">cycle: {{ t.pattern.cycleQN.toFixed(3) }} qn</span>
        </div>
        <div class="grid gap-3 sm:gap-4 mt-3 sm:mt-4 text-sm" style="grid-template-columns: repeat(12, minmax(0, 1fr));">
          <div class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
            <span class="w-24 shrink-0 text-slate-400">Volume</span>
            <div class="flex-1 flex items-center gap-2 min-w-0">
              <input class="flex-1 min-w-0" type="range" min="0" max="1" step="0.01" :value="t.volume" @input="onFieldInput(t.id, 'volume', $event)" />
              <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="0" max="1" step="0.01" :value="t.volume" @input="onFieldInput(t.id, 'volume', $event)" />
            </div>
          </div>
          <div class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
            <span class="w-24 shrink-0 text-slate-400">Pan</span>
            <div class="flex-1 flex items-center gap-2 min-w-0">
              <input class="flex-1 min-w-0" type="range" min="-1" max="1" step="0.01" :value="t.pan" @input="onFieldInput(t.id, 'pan', $event)" />
              <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="-1" max="1" step="0.01" :value="t.pan" @input="onFieldInput(t.id, 'pan', $event)" />
            </div>
          </div>
          <div class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
            <span class="w-24 shrink-0 text-slate-400">Velocity</span>
            <div class="flex-1 flex items-center gap-2 min-w-0">
              <input class="flex-1 min-w-0" type="range" min="0" max="1" step="0.01" :value="t.velocity" @input="onFieldInput(t.id, 'velocity', $event)" />
              <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="0" max="1" step="0.01" :value="t.velocity" @input="onFieldInput(t.id, 'velocity', $event)" />
            </div>
          </div>
          <div class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
            <span class="w-24 shrink-0 text-slate-400">Vel random</span>
            <div class="flex-1 flex items-center gap-2 min-w-0">
              <input class="flex-1 min-w-0" type="range" min="0" max="1" step="0.01" :value="t.velRandom" @input="onFieldInput(t.id, 'velRandom', $event)" />
              <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="0" max="1" step="0.01" :value="t.velRandom" @input="onFieldInput(t.id, 'velRandom', $event)" />
            </div>
          </div>
        </div>

        <!-- Instrument parameters -->
        <div class="mt-4 grid gap-4" style="grid-template-columns: repeat(12, minmax(0, 1fr));">
          <template v-if="t.type === 'kick'">
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Octaves</span>
              <div class="flex-1 flex items-center gap-2 min-w-0">
                <input class="flex-1 min-w-0" type="range" min="0.5" max="6" step="0.1" :value="t.params.octaves as number" @input="onParamInput(t.id, 'octaves', $event)" />
                <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="0.5" max="6" step="0.1" :value="t.params.octaves as number" @input="onParamInput(t.id, 'octaves', $event)" />
              </div>
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Pitch Decay</span>
              <div class="flex-1 flex items-center gap-2 min-w-0">
                <input class="flex-1 min-w-0" type="range" min="0.001" max="1" step="0.001" :value="t.params.pitchDecay as number" @input="onParamInput(t.id, 'pitchDecay', $event)" />
                <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="0.001" max="1" step="0.001" :value="t.params.pitchDecay as number" @input="onParamInput(t.id, 'pitchDecay', $event)" />
              </div>
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Attack</span>
              <div class="flex-1 flex items-center gap-2 min-w-0">
                <input class="flex-1 min-w-0" type="range" min="0" max="1" step="0.001" :value="t.params.envA as number" @input="onParamInput(t.id, 'envA', $event)" />
                <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="0" max="1" step="0.001" :value="t.params.envA as number" @input="onParamInput(t.id, 'envA', $event)" />
              </div>
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Decay</span>
              <div class="flex-1 flex items-center gap-2 min-w-0">
                <input class="flex-1 min-w-0" type="range" min="0" max="2" step="0.001" :value="t.params.envD as number" @input="onParamInput(t.id, 'envD', $event)" />
                <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="0" max="2" step="0.001" :value="t.params.envD as number" @input="onParamInput(t.id, 'envD', $event)" />
              </div>
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Sustain</span>
              <div class="flex-1 flex items-center gap-2 min-w-0">
                <input class="flex-1 min-w-0" type="range" min="0" max="1" step="0.001" :value="t.params.envS as number" @input="onParamInput(t.id, 'envS', $event)" />
                <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="0" max="1" step="0.001" :value="t.params.envS as number" @input="onParamInput(t.id, 'envS', $event)" />
              </div>
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Release</span>
              <div class="flex-1 flex items-center gap-2 min-w-0">
                <input class="flex-1 min-w-0" type="range" min="0" max="2" step="0.001" :value="t.params.envR as number" @input="onParamInput(t.id, 'envR', $event)" />
                <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="0" max="2" step="0.001" :value="t.params.envR as number" @input="onParamInput(t.id, 'envR', $event)" />
              </div>
            </label>
          </template>
          <template v-else-if="t.type === 'snare'">
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Noise</span>
              <select class="bg-slate-800 border border-white/10 rounded px-2 h-9" :value="t.params.noiseType as string" @change="onParamSelect(t.id, 'noiseType', $event)">
                <option value="white">white</option>
                <option value="pink">pink</option>
                <option value="brown">brown</option>
                <option value="blue">blue</option>
                <option value="violet">violet</option>
                <option value="grey">grey</option>
                <option value="band">band</option>
              </select>
            </label>
            <!-- Clap-like amplitude modulation on the noise -->
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Amp Mod</span>
              <div class="flex-1 flex items-center gap-2 min-w-0">
                <input class="flex-1 min-w-0" type="range" min="0" max="1" step="1" :value="(t.params.noiseAmpModOn ?? 0) as number" @input="onParamInput(t.id, 'noiseAmpModOn', $event)" />
                <input class="w-16 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="0" max="1" step="1" :value="(t.params.noiseAmpModOn ?? 0) as number" @input="onParamInput(t.id, 'noiseAmpModOn', $event)" />
              </div>
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Mod Freq</span>
              <div class="flex-1 flex items-center gap-2 min-w-0">
                <input class="flex-1 min-w-0" type="range" min="1" max="100" step="0.5" :value="(t.params.noiseAmpModFreq ?? 20) as number" @input="onParamInput(t.id, 'noiseAmpModFreq', $event)" />
                <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="1" max="50" step="0.5" :value="(t.params.noiseAmpModFreq ?? 20) as number" @input="onParamInput(t.id, 'noiseAmpModFreq', $event)" />
              </div>
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Mod Depth</span>
              <div class="flex-1 flex items-center gap-2 min-w-0">
                <input class="flex-1 min-w-0" type="range" min="0" max="1" step="0.01" :value="(t.params.noiseAmpModDepth ?? 1) as number" @input="onParamInput(t.id, 'noiseAmpModDepth', $event)" />
                <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="0" max="1" step="0.01" :value="(t.params.noiseAmpModDepth ?? 1) as number" @input="onParamInput(t.id, 'noiseAmpModDepth', $event)" />
              </div>
            </label>
            <!-- Band-limited noise controls -->
            <template v-if="(t.params.noiseType as string) === 'band'">
              <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
                <span class="w-28 shrink-0 text-slate-400">Band Freq</span>
                <div class="flex-1 flex items-center gap-2 min-w-0">
                  <input class="flex-1 min-w-0" type="range" min="50" max="12000" step="1" :value="(t.params.noiseBandFreq ?? 1500) as number" @input="onParamInput(t.id, 'noiseBandFreq', $event)" />
                  <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="50" max="12000" step="1" :value="(t.params.noiseBandFreq ?? 1500) as number" @input="onParamInput(t.id, 'noiseBandFreq', $event)" />
                </div>
              </label>
              <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
                <span class="w-28 shrink-0 text-slate-400">Band Q</span>
                <div class="flex-1 flex items-center gap-2 min-w-0">
                  <input class="flex-1 min-w-0" type="range" min="0.1" max="12" step="0.1" :value="(t.params.noiseBandQ ?? 3) as number" @input="onParamInput(t.id, 'noiseBandQ', $event)" />
                  <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="0.1" max="12" step="0.1" :value="(t.params.noiseBandQ ?? 3) as number" @input="onParamInput(t.id, 'noiseBandQ', $event)" />
                </div>
              </label>
            </template>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Attack</span>
              <div class="flex-1 flex items-center gap-2 min-w-0">
                <input class="flex-1 min-w-0" type="range" min="0" max="1" step="0.001" :value="t.params.envA as number" @input="onParamInput(t.id, 'envA', $event)" />
                <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="0" max="1" step="0.001" :value="t.params.envA as number" @input="onParamInput(t.id, 'envA', $event)" />
              </div>
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Decay</span>
              <div class="flex-1 flex items-center gap-2 min-w-0">
                <input class="flex-1 min-w-0" type="range" min="0" max="2" step="0.001" :value="t.params.envD as number" @input="onParamInput(t.id, 'envD', $event)" />
                <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="0" max="2" step="0.001" :value="t.params.envD as number" @input="onParamInput(t.id, 'envD', $event)" />
              </div>
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Release</span>
              <div class="flex-1 flex items-center gap-2 min-w-0">
                <input class="flex-1 min-w-0" type="range" min="0" max="2" step="0.001" :value="t.params.envR as number" @input="onParamInput(t.id, 'envR', $event)" />
                <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="0" max="2" step="0.001" :value="t.params.envR as number" @input="onParamInput(t.id, 'envR', $event)" />
              </div>
            </label>
          </template>
          <template v-else-if="t.type === 'hat'">
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Frequency</span>
              <div class="flex-1 flex items-center gap-2 min-w-0">
                <input class="flex-1 min-w-0" type="range" min="50" max="8000" step="1" :value="t.params.frequency as number" @input="onParamInput(t.id, 'frequency', $event)" />
                <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="50" max="8000" step="1" :value="t.params.frequency as number" @input="onParamInput(t.id, 'frequency', $event)" />
              </div>
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Harmonicity</span>
              <div class="flex-1 flex items-center gap-2 min-w-0">
                <input class="flex-1 min-w-0" type="range" min="0.1" max="20" step="0.1" :value="t.params.harmonicity as number" @input="onParamInput(t.id, 'harmonicity', $event)" />
                <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="0.1" max="20" step="0.1" :value="t.params.harmonicity as number" @input="onParamInput(t.id, 'harmonicity', $event)" />
              </div>
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Mod Index</span>
              <div class="flex-1 flex items-center gap-2 min-w-0">
                <input class="flex-1 min-w-0" type="range" min="1" max="100" step="1" :value="t.params.modulationIndex as number" @input="onParamInput(t.id, 'modulationIndex', $event)" />
                <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="1" max="100" step="1" :value="t.params.modulationIndex as number" @input="onParamInput(t.id, 'modulationIndex', $event)" />
              </div>
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Resonance</span>
              <div class="flex-1 flex items-center gap-2 min-w-0">
                <input class="flex-1 min-w-0" type="range" min="10" max="12000" step="1" :value="t.params.resonance as number" @input="onParamInput(t.id, 'resonance', $event)" />
                <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="10" max="12000" step="1" :value="t.params.resonance as number" @input="onParamInput(t.id, 'resonance', $event)" />
              </div>
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Octaves</span>
              <div class="flex-1 flex items-center gap-2 min-w-0">
                <input class="flex-1 min-w-0" type="range" min="0.1" max="8" step="0.1" :value="t.params.octaves as number" @input="onParamInput(t.id, 'octaves', $event)" />
                <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="0.1" max="8" step="0.1" :value="t.params.octaves as number" @input="onParamInput(t.id, 'octaves', $event)" />
              </div>
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Attack</span>
              <div class="flex-1 flex items-center gap-2 min-w-0">
                <input class="flex-1 min-w-0" type="range" min="0" max="1" step="0.001" :value="t.params.envA as number" @input="onParamInput(t.id, 'envA', $event)" />
                <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="0" max="1" step="0.001" :value="t.params.envA as number" @input="onParamInput(t.id, 'envA', $event)" />
              </div>
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Decay</span>
              <div class="flex-1 flex items-center gap-2 min-w-0">
                <input class="flex-1 min-w-0" type="range" min="0" max="2" step="0.001" :value="t.params.envD as number" @input="onParamInput(t.id, 'envD', $event)" />
                <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="0" max="2" step="0.001" :value="t.params.envD as number" @input="onParamInput(t.id, 'envD', $event)" />
              </div>
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Release</span>
              <div class="flex-1 flex items-center gap-2 min-w-0">
                <input class="flex-1 min-w-0" type="range" min="0" max="2" step="0.001" :value="t.params.envR as number" @input="onParamInput(t.id, 'envR', $event)" />
                <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="0" max="2" step="0.001" :value="t.params.envR as number" @input="onParamInput(t.id, 'envR', $event)" />
              </div>
            </label>
          </template>
          <template v-else>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Dampening</span>
              <div class="flex-1 flex items-center gap-2 min-w-0">
                <input class="flex-1 min-w-0" type="range" min="100" max="12000" step="1" :value="t.params.dampening as number" @input="onParamInput(t.id, 'dampening', $event)" />
                <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="100" max="12000" step="1" :value="t.params.dampening as number" @input="onParamInput(t.id, 'dampening', $event)" />
              </div>
            </label>
            <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
              <span class="w-28 shrink-0 text-slate-400">Resonance</span>
              <div class="flex-1 flex items-center gap-2 min-w-0">
                <input class="flex-1 min-w-0" type="range" min="0" max="1" step="0.01" :value="t.params.resonance as number" @input="onParamInput(t.id, 'resonance', $event)" />
                <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="0" max="1" step="0.01" :value="t.params.resonance as number" @input="onParamInput(t.id, 'resonance', $event)" />
              </div>
            </label>
          </template>
        </div>

        <!-- Tanh Distortion and Filter Controls -->
        <div class="mt-4 grid gap-4" style="grid-template-columns: repeat(12, minmax(0, 1fr));">
          <!-- Distortion Input Gain (pre-distortion level in dB) -->
          <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
            <span class="w-28 shrink-0 text-slate-400">Dist In Gain (dB)</span>
            <div class="flex-1 flex items-center gap-2 min-w-0">
              <input class="flex-1 min-w-0" type="range" min="-60" max="120" step="1" :value="(t.params.distortionInputGain ?? 0) as number" @input="onParamInput(t.id, 'distortionInputGain', $event)" />
              <input class="w-24 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="-60" max="120" step="1" :value="(t.params.distortionInputGain ?? 0) as number" @input="onParamInput(t.id, 'distortionInputGain', $event)" />
            </div>
          </label>
          <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
            <span class="w-28 shrink-0 text-slate-400">Filter Type</span>
            <select class="bg-slate-800 border border-white/10 rounded px-2 h-9" :value="t.params.filterType as string" @change="onParamSelect(t.id, 'filterType', $event)">
              <option value="lowpass">Low-pass</option>
              <option value="highpass">High-pass</option>
              <option value="bandpass">Band-pass</option>
              <option value="notch">Notch</option>
              <option value="allpass">All-pass</option>
              <option value="peaking">Peaking</option>
              <option value="lowshelf">Low-shelf</option>
              <option value="highshelf">High-shelf</option>
            </select>
          </label>
          <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
            <span class="w-28 shrink-0 text-slate-400">Filter Slope</span>
            <select class="bg-slate-800 border border-white/10 rounded px-2 h-9" :value="t.params.filterRolloff as number" @change="onParamSelect(t.id, 'filterRolloff', $event)">
              <option value="-12">6 dB/oct</option>
              <option value="-24">12 dB/oct</option>
              <option value="-48">24 dB/oct</option>
              <option value="-96">48 dB/oct</option>
            </select>
          </label>
          <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
            <span class="w-28 shrink-0 text-slate-400">Filter Frequency</span>
            <div class="flex-1 flex items-center gap-2 min-w-0">
              <input class="flex-1 min-w-0" type="range" min="20" max="20000" step="1" :value="t.params.filterFrequency as number" @input="onParamInput(t.id, 'filterFrequency', $event)" />
              <input class="w-24 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="20" max="20000" step="1" :value="t.params.filterFrequency as number" @input="onParamInput(t.id, 'filterFrequency', $event)" />
            </div>
          </label>

          <!-- Resonance Parameter -->
          <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
            <span class="w-28 shrink-0 text-slate-400">Filter Resonance</span>
            <div class="flex-1 flex items-center gap-2 min-w-0">
              <input class="flex-1 min-w-0" type="range" min="0.1" max="10" step="0.1" :value="t.params.filterResonance as number" @input="onParamInput(t.id, 'filterResonance', $event)" />
              <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="0.1" max="10" step="0.1" :value="t.params.filterResonance as number" @input="onParamInput(t.id, 'filterResonance', $event)" />
            </div>
          </label>

          <!-- Velocity -> Filter envelope modulation -->
          <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
            <span class="w-28 shrink-0 text-slate-400">Vel → Filter</span>
            <div class="flex-1 flex items-center gap-2 min-w-0">
              <input class="flex-1 min-w-0" type="range" min="-1" max="1" step="0.01" :value="(t.params.velToFilter ?? 0) as number" @input="onParamInput(t.id, 'velToFilter', $event)" />
              <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="-1" max="1" step="0.01" :value="(t.params.velToFilter ?? 0) as number" @input="onParamInput(t.id, 'velToFilter', $event)" />
            </div>
          </label>
          <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
            <span class="w-28 shrink-0 text-slate-400">Filter Env Time</span>
            <div class="flex-1 flex items-center gap-2 min-w-0">
              <input class="flex-1 min-w-0" type="range" min="0" max="1" step="0.01" :value="(t.params.filterEnvTime ?? 0.15) as number" @input="onParamInput(t.id, 'filterEnvTime', $event)" />
              <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="0" max="1" step="0.01" :value="(t.params.filterEnvTime ?? 0.15) as number" @input="onParamInput(t.id, 'filterEnvTime', $event)" />
            </div>
          </label>
        </div>

        <!-- MIDI Key Specification -->
        <div class="mt-4 grid gap-4" style="grid-template-columns: repeat(12, minmax(0, 1fr));">
          <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
            <span class="w-28 shrink-0 text-slate-400">MIDI Key</span>
            <input
              class="flex-1 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9"
              type="number"
              min="0"
              max="127"
              step="1"
              :value="t.params.midiKey || defaultMidiKey(t.type)"
              @input="onParamInput(t.id, 'midiKey', $event)"
            />
          </label>
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

const seq = useSequencerStore()
const { tracks, version } = storeToRefs(seq)
// Explicitly depend on tracks length and ids for v-for
const renderTracks = computed(() => tracks.value.map(t => t))

const rstore = useRhythmStore()

function onTypeChange(id: string, type: any) {
  seq.setTrackType(id, type)
}

function onNameInput(id: string, e: Event) {
  const v = (e.target as HTMLInputElement).value
  seq.updateTrackFields(id, { name: v })
}

function onFieldInput(id: string, key: 'volume'|'pan'|'velocity'|'velRandom', e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
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

function onMeterInput(id: string, which: 'num' | 'den', e: Event) {
  const v = Math.max(1, Math.floor(Number((e.target as HTMLInputElement).value)))
  const t = tracks.value.find(x => x.id === id)
  if (!t || !t.pattern) return
  const num = which === 'num' ? v : t.pattern.numerator
  const den = which === 'den' ? v : t.pattern.denominator
  seq.updateTrackPatternMeter(id, num, den)
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
  // Pass current global meter as fallback; store will prefer item's own meter if present
  seq.assignRhythmToTrack(pickerTrackId.value, item, rstore.numerator, rstore.denominator)
}

function defaultMidiKey(type: string): number {
  switch (type) {
    case 'kick': return 36;
    case 'snare': return 38;
    case 'hat': return 42;
    case 'perc': return 39;
    default: return 36;
  }
}
</script>

<style scoped>
.pattern-placeholder {
  display: block;
  width: 100%;
  text-align: center;
  font-size: 0.95rem;
  line-height: 1.4rem;
  margin-top: 0.25rem;
  color: #94a3b8;
}

/* Remove previous overrides on .text-slate-400 to avoid layout issues */
</style>
