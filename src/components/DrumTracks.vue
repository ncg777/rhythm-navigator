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

        <!-- Mix controls -->
        <div class="mt-3 border-t border-white/5 pt-3 grid gap-3 sm:gap-4 text-sm" style="grid-template-columns: repeat(12, minmax(0, 1fr));">
          <div class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
            <span class="w-24 shrink-0 text-slate-400">Note Length</span>
            <div class="flex-1 flex items-center gap-2 min-w-0">
              <input class="flex-1 min-w-0" type="range" min="0.01" max="1" step="0.01" :value="t.noteLength" @input="onFieldInput(t.id, 'noteLength', $event)" />
              <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="0.01" max="1" step="0.01" :value="t.noteLength" @input="onFieldInput(t.id, 'noteLength', $event)" />
            </div>
          </div>
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
          <div class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
            <span class="w-24 shrink-0 text-slate-400">Timescale</span>
            <div class="flex-1 flex items-center gap-2 min-w-0">
              <input class="flex-1 min-w-0" type="range" min="0.0625" max="16" step="0.0625" :value="t.timeScale" @input="onTimeScaleInput(t.id, $event)" />
              <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="0.0625" max="16" step="0.0625" :value="t.timeScale" @input="onTimeScaleInput(t.id, $event)" />
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
          <label class="col-span-12 sm:col-span-6 lg:col-span-3 flex items-center gap-3">
            <span class="w-28 shrink-0 text-slate-400">Filter Resonance</span>
            <div class="flex-1 flex items-center gap-2 min-w-0">
              <input class="flex-1 min-w-0" type="range" min="0.1" max="10" step="0.1" :value="t.params.filterResonance as number" @input="onParamInput(t.id, 'filterResonance', $event)" />
              <input class="w-20 shrink-0 bg-slate-800 text-slate-100 border border-white/10 rounded px-2 h-9" type="number" min="0.1" max="10" step="0.1" :value="t.params.filterResonance as number" @input="onParamInput(t.id, 'filterResonance', $event)" />
            </div>
          </label>
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
const renderTracks = computed(() => tracks.value.map(t => t))

const rstore = useRhythmStore()

// Pitch note options for the pitch selector
const pitchNotes = ['C0','C#0','D0','D#0','E0','F0','F#0','G0','G#0','A0','A#0','B0','C1','C#1','D1','D#1','E1','F1','F#1','G1','G#1','A1','A#1','B1','C2','C#2','D2','D#2','E2','F2','F#2','G2','G#2','A2','A#2','B2','C3','C#3','D3','D#3','E3','F3','F#3','G3','G#3','A3','A#3','B3','C4','C#4','D4','D#4','E4','F4','F#4','G4','G#4','A4','A#4','B4','C5','C#5','D5','D#5','E5','F5','F#5','G5','G#5','A5','A#5','B5','C6']

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
    case 'hat': return 42;
    case 'perc': return 39;
    default: return 36;
  }
}
</script>

<style scoped></style>
