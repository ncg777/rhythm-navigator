<template>
  <section class="relative">
    <header class="mb-3">
      <h2 class="text-lg font-semibold">Drum tracks</h2>
    </header>
    <div class="track-workspace">
      <nav class="track-master" aria-label="Drum tracks">
        <button
          v-for="track in orderedTracks"
          :key="track.id"
          type="button"
          class="track-master-row"
          :class="{ 'track-master-row--selected': selectedTrack?.id === track.id }"
          :aria-current="selectedTrack?.id === track.id ? 'true' : undefined"
          @click="selectedTrackId = track.id"
        >
          <span class="truncate text-left">{{ trackLabels.get(track.id) }}</span>
          <span class="shrink-0 text-[10px] text-slate-500">{{ track.patterns.length }}p</span>
        </button>
      </nav>

      <div class="track-detail">
        <div v-if="selectedTrack" v-for="t in [selectedTrack]" :key="t.id" class="rounded border border-white/10 p-3 sm:p-4">

        <!-- Track header -->
        <div class="flex flex-wrap items-center gap-2">
          <span class="min-w-0 flex-1 truncate text-sm font-semibold text-slate-200">{{ trackLabels.get(t.id) }}</span>
          <select class="bg-slate-800 border border-white/10 rounded px-2 h-8 sm:h-9 text-sm" :value="t.type" @change="onTypeChange(t.id, ($event.target as HTMLSelectElement).value)">
            <option v-for="type in TRACK_TYPES" :key="type" :value="type">
              {{ trackTypeLabel(type) }} · GM {{ defaultMidiKeyForTrackType(type) }}
            </option>
          </select>
          <button type="button" class="ml-auto px-2 sm:px-3 h-8 sm:h-9 text-xs rounded border border-red-500/30 hover:bg-red-500/10 shrink-0" @click.stop="removeTrack(t.id)">Remove</button>
        </div>

        <!-- Pattern chain -->
        <details open class="mt-3 border-t border-white/5 pt-3">
          <summary class="flex cursor-pointer list-none items-center gap-2 mb-2">
            <span class="text-xs text-slate-400 font-medium uppercase tracking-wide">Patterns</span>
            <span class="text-[10px] text-slate-500">({{ t.patterns.length }} pattern{{ t.patterns.length !== 1 ? 's' : '' }})</span>
          </summary>

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
        </details>

        <!-- Mix controls (knobs) -->
        <details open class="mt-3 border-t border-white/5 pt-3">
          <summary class="cursor-pointer list-none text-[10px] text-slate-500 uppercase tracking-wider mb-2">Mix</summary>
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
        </details>

        <!-- Instrument parameters (knobs) -->
        <details open class="mt-3 border-t border-white/5 pt-3">
          <summary class="cursor-pointer list-none text-[10px] text-slate-500 uppercase tracking-wider mb-2">Sound</summary>
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
              <Knob :modelValue="(t.params.tune as number) ?? 1600" @update:modelValue="v => onParam2(t.id, 'tune', v)"
                :min="400" :max="4000" :step="10" label="Color" :defaultValue="1600" :size="48" color="#f97316" />
              <Knob :modelValue="(t.params.toneDecay as number) ?? 0.03" @update:modelValue="v => onParam2(t.id, 'toneDecay', v)"
                :min="0.005" :max="0.08" :step="0.001" label="Burst" :defaultValue="0.03" :size="48" color="#f97316" />
              <div class="inline-flex flex-col items-center" :style="{ width: '48px' }">
                <select class="bg-slate-800 border border-white/10 rounded px-1 h-7 text-[10px] w-full" :value="t.params.noiseType as string" @change="onParamSelect(t.id, 'noiseType', $event)">
                  <option value="white">white</option>
                  <option value="pink">pink</option>
                  <option value="brown">brown</option>
                </select>
                <div class="mt-0.5 text-[10px] text-slate-400 leading-tight">Noise</div>
              </div>
              <Knob :modelValue="(t.params.noiseDecay as number) ?? 0.24" @update:modelValue="v => onParam2(t.id, 'noiseDecay', v)"
                :min="0.04" :max="0.6" :step="0.005" label="Tail" :defaultValue="0.24" :size="48" color="#f97316" />
              <Knob :modelValue="(t.params.snap as number) ?? 0.85" @update:modelValue="v => onParam2(t.id, 'snap', v)"
                :min="0" :max="1" :step="0.01" label="Snap" :defaultValue="0.85" :size="48" color="#f97316" />
              <Knob :modelValue="(t.params.mix as number) ?? 0.55" @update:modelValue="v => onParam2(t.id, 'mix', v)"
                :min="0" :max="1" :step="0.01" label="Tail Mix" :defaultValue="0.55" :size="48" color="#f97316" />
            </template>
            <template v-else-if="isHatType(t.type)">
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
            <template v-else-if="isCrashType(t.type)">
              <Knob :modelValue="(t.params.tune as number) ?? 220" @update:modelValue="v => onParam2(t.id, 'tune', v)"
                :min="100" :max="500" :step="1" label="Tune" :defaultValue="220" :size="48" color="#60a5fa" />
              <Knob :modelValue="(t.params.decay as number) ?? 1.4" @update:modelValue="v => onParam2(t.id, 'decay', v)"
                :min="0.2" :max="3" :step="0.01" label="Decay" :defaultValue="1.4" :size="48" color="#60a5fa" />
              <Knob :modelValue="(t.params.brightness as number) ?? 12000" @update:modelValue="v => onParam2(t.id, 'brightness', v)"
                :min="2000" :max="20000" :step="10" label="Bright" :defaultValue="12000" :size="48" color="#60a5fa" />
              <Knob :modelValue="(t.params.harmonicity as number) ?? 2.2" @update:modelValue="v => onParam2(t.id, 'harmonicity', v)"
                :min="0.5" :max="8" :step="0.1" label="Harmonic" :defaultValue="2.2" :size="48" color="#60a5fa" />
              <Knob :modelValue="(t.params.modIndex as number) ?? 55" @update:modelValue="v => onParam2(t.id, 'modIndex', v)"
                :min="5" :max="120" :step="1" label="Mod Idx" :defaultValue="55" :size="48" color="#60a5fa" />
              <Knob :modelValue="(t.params.wash as number) ?? 0.65" @update:modelValue="v => onParam2(t.id, 'wash', v)"
                :min="0" :max="1" :step="0.01" label="Wash" :defaultValue="0.65" :size="48" color="#60a5fa" />
            </template>
            <template v-else-if="t.type === 'cowbell'">
              <Knob :modelValue="(t.params.tune as number) ?? 560" @update:modelValue="v => onParam2(t.id, 'tune', v)"
                :min="220" :max="1200" :step="1" label="Tune" :defaultValue="560" :size="48" color="#f59e0b" />
              <Knob :modelValue="(t.params.decay as number) ?? 0.22" @update:modelValue="v => onParam2(t.id, 'decay', v)"
                :min="0.04" :max="1.2" :step="0.005" label="Decay" :defaultValue="0.22" :size="48" color="#f59e0b" />
              <Knob :modelValue="(t.params.brightness as number) ?? 7000" @update:modelValue="v => onParam2(t.id, 'brightness', v)"
                :min="2500" :max="12000" :step="10" label="Color" :defaultValue="7000" :size="48" color="#f59e0b" />
            </template>
            <template v-else-if="t.type === 'chimes'">
              <Knob :modelValue="(t.params.tune as number) ?? 1047" @update:modelValue="v => onParam2(t.id, 'tune', v)"
                :min="220" :max="2400" :step="1" label="Fund." :defaultValue="1047" :size="48" color="#facc15" />
              <Knob :modelValue="(t.params.decay as number) ?? 2.6" @update:modelValue="v => onParam2(t.id, 'decay', v)"
                :min="0.3" :max="6" :step="0.02" label="Ring" :defaultValue="2.6" :size="48" color="#facc15" />
            </template>
            <template v-else-if="isTriangleType(t.type)">
              <Knob :modelValue="(t.params.tune as number) ?? 880" @update:modelValue="v => onParam2(t.id, 'tune', v)"
                :min="330" :max="2400" :step="1" label="Tune" :defaultValue="880" :size="48" color="#fde047" />
              <Knob :modelValue="(t.params.decay as number) ?? 1.1" @update:modelValue="v => onParam2(t.id, 'decay', v)"
                :min="0.15" :max="5" :step="0.01" label="Ring" :defaultValue="1.1" :size="48" color="#fde047" />
            </template>
            <template v-else-if="isRideType(t.type)">
              <Knob :modelValue="(t.params.tune as number) ?? 320" @update:modelValue="v => onParam2(t.id, 'tune', v)"
                :min="120" :max="700" :step="1" label="Bow" :defaultValue="320" :size="48" color="#93c5fd" />
              <Knob :modelValue="(t.params.decay as number) ?? 1.8" @update:modelValue="v => onParam2(t.id, 'decay', v)"
                :min="0.3" :max="5" :step="0.02" label="Decay" :defaultValue="1.8" :size="48" color="#93c5fd" />
              <Knob :modelValue="(t.params.brightness as number) ?? 11000" @update:modelValue="v => onParam2(t.id, 'brightness', v)"
                :min="3000" :max="18000" :step="10" label="Bright" :defaultValue="11000" :size="48" color="#93c5fd" />
              <Knob :modelValue="(t.params.harmonicity as number) ?? 2.8" @update:modelValue="v => onParam2(t.id, 'harmonicity', v)"
                :min="0.5" :max="8" :step="0.1" label="Metal" :defaultValue="2.8" :size="48" color="#93c5fd" />
              <Knob :modelValue="(t.params.modIndex as number) ?? 42" @update:modelValue="v => onParam2(t.id, 'modIndex', v)"
                :min="5" :max="100" :step="1" label="Complex" :defaultValue="42" :size="48" color="#93c5fd" />
              <Knob :modelValue="(t.params.wash as number) ?? 0.38" @update:modelValue="v => onParam2(t.id, 'wash', v)"
                :min="0.12" :max="0.75" :step="0.01" label="Wash" :defaultValue="0.38" :size="48" color="#93c5fd" />
            </template>
            <template v-else-if="t.type === 'shaker'">
              <Knob :modelValue="(t.params.decay as number) ?? 0.12" @update:modelValue="v => onParam2(t.id, 'decay', v)"
                :min="0.04" :max="0.5" :step="0.005" label="Grain" :defaultValue="0.12" :size="48" color="#2dd4bf" />
              <Knob :modelValue="(t.params.snap as number) ?? 0.85" @update:modelValue="v => onParam2(t.id, 'snap', v)"
                :min="0" :max="1" :step="0.01" label="Seeds" :defaultValue="0.85" :size="48" color="#2dd4bf" />
              <Knob :modelValue="(t.params.color as number) ?? 7500" @update:modelValue="v => onParam2(t.id, 'color', v)"
                :min="2500" :max="14000" :step="10" label="Color" :defaultValue="7500" :size="48" color="#2dd4bf" />
            </template>
            <template v-else>
              <Knob :modelValue="(t.params.tune as number) ?? drumDefault(t.type, 'tune')" @update:modelValue="v => onParam2(t.id, 'tune', v)"
                :min="60" :max="800" :step="1" label="Tune" :defaultValue="drumDefault(t.type, 'tune')" :size="48" color="#4ade80" />
              <Knob :modelValue="(t.params.decay as number) ?? drumDefault(t.type, 'decay')" @update:modelValue="v => onParam2(t.id, 'decay', v)"
                :min="0.02" :max="1" :step="0.005" label="Decay" :defaultValue="drumDefault(t.type, 'decay')" :size="48" color="#4ade80" />
              <Knob :modelValue="(t.params.sweep as number) ?? drumDefault(t.type, 'sweep')" @update:modelValue="v => onParam2(t.id, 'sweep', v)"
                :min="0" :max="4" :step="0.05" label="Sweep" :defaultValue="drumDefault(t.type, 'sweep')" :size="48" color="#4ade80" />
              <Knob :modelValue="(t.params.sweepTime as number) ?? drumDefault(t.type, 'sweepTime')" @update:modelValue="v => onParam2(t.id, 'sweepTime', v)"
                :min="0.005" :max="0.1" :step="0.001" label="Swp Time" :defaultValue="drumDefault(t.type, 'sweepTime')" :size="48" color="#4ade80" />
              <Knob :modelValue="(t.params.snap as number) ?? drumDefault(t.type, 'snap')" @update:modelValue="v => onParam2(t.id, 'snap', v)"
                :min="0" :max="1" :step="0.01" label="Attack" :defaultValue="drumDefault(t.type, 'snap')" :size="48" color="#4ade80" />
              <Knob :modelValue="(t.params.color as number) ?? drumDefault(t.type, 'color')" @update:modelValue="v => onParam2(t.id, 'color', v)"
                :min="200" :max="8000" :step="10" label="Shell" :defaultValue="drumDefault(t.type, 'color')" :size="48" color="#4ade80" />
            </template>
          </div>
        </details>

        <!-- Filter & Distortion -->
        <details open class="mt-3 border-t border-white/5 pt-3">
          <summary class="cursor-pointer list-none text-[10px] text-slate-500 uppercase tracking-wider mb-2">Filter / Drive</summary>
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
        </details>
        </div>
        <div v-else class="rounded border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
          Add a percussion track to begin editing.
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
import {
  TRACK_TYPES,
  defaultMidiKeyForTrackType,
  automaticTrackLabels,
  isTrackType,
  sortTracksByMidiKey,
  trackTypeLabel,
  type TrackType
} from '@/utils/drumSounds'
import { useRhythmStore } from '@/stores/rhythmStore'
import RhythmPickerModal from '@/components/RhythmPickerModal.vue'
import Knob from '@/components/Knob.vue'

const seq = useSequencerStore()
const { tracks, version } = storeToRefs(seq)

const drumDefaults: Record<string, Record<string, number>> = {
  rimshot: { tune: 260, decay: 0.09, sweep: 0.2, sweepTime: 0.008, snap: 0.9, color: 4800 },
  tomLowFloor: { tune: 73, decay: 0.52, sweep: 1.55, sweepTime: 0.052, snap: 0.05, color: 1500 },
  tomHighFloor: { tune: 87, decay: 0.45, sweep: 1.48, sweepTime: 0.046, snap: 0.06, color: 1800 },
  tom: { tune: 110, decay: 0.34, sweep: 1.3, sweepTime: 0.035, snap: 0.08, color: 2300 },
  tomLowMid: { tune: 131, decay: 0.3, sweep: 1.18, sweepTime: 0.03, snap: 0.09, color: 2700 },
  tomHighMid: { tune: 147, decay: 0.27, sweep: 1.08, sweepTime: 0.026, snap: 0.1, color: 3100 },
  tomHigh: { tune: 165, decay: 0.24, sweep: 0.96, sweepTime: 0.022, snap: 0.12, color: 3500 },
  congaMuted: { tune: 262, decay: 0.105, sweep: 0.18, sweepTime: 0.01, snap: 0.72, color: 4600 },
  congaOpen: { tune: 233, decay: 0.31, sweep: 0.28, sweepTime: 0.016, snap: 0.24, color: 3700 },
  conga: { tune: 196, decay: 0.26, sweep: 0.35, sweepTime: 0.018, snap: 0.16, color: 3200 },
  timbale: { tune: 260, decay: 0.22, sweep: 0.15, sweepTime: 0.01, snap: 0.3, color: 4400 },
  timbaleLow: { tune: 196, decay: 0.28, sweep: 0.19, sweepTime: 0.014, snap: 0.26, color: 3600 }
}

function drumDefault(type: string, param: string): number {
  return drumDefaults[type]?.[param] ?? 0
}

function isHatType(type: TrackType): boolean {
  return type === 'hat' || type === 'hatPedal' || type === 'hatOpen'
}

function isCrashType(type: TrackType): boolean {
  return type === 'crash' || type === 'chineseCymbal' || type === 'splash' || type === 'crash2'
}

function isTriangleType(type: TrackType): boolean {
  return type === 'triangle' || type === 'triangleMuted'
}

function isRideType(type: TrackType): boolean {
  return type === 'ride' || type === 'rideBell' || type === 'ride2'
}
const selectedTrackId = ref<string | null>(null)
const orderedTracks = computed(() => sortTracksByMidiKey(tracks.value))
const trackLabels = computed(() => automaticTrackLabels(orderedTracks.value))
const selectedTrack = computed(() => {
  return orderedTracks.value.find((track) => track.id === selectedTrackId.value) ?? orderedTracks.value[0] ?? null
})

const rstore = useRhythmStore()

function chainCycleQN(t: any): number {
  const ts = t.timeScale || 1
  return t.patterns.reduce((sum: number, e: any) => sum + e.pattern.cycleQN * e.repeats * ts, 0)
}

function onTypeChange(id: string, type: string) {
  if (isTrackType(type)) seq.setTrackType(id, type)
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

function addTrack() {
  seq.addTrack('cowbell')
  selectedTrackId.value = tracks.value.at(-1)?.id ?? null
}

function removeTrack(id: string) {
  seq.removeTrack(id)
  if (selectedTrackId.value === id) selectedTrackId.value = null
}

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
  return defaultMidiKeyForTrackType(type as Parameters<typeof defaultMidiKeyForTrackType>[0])
}
</script>

<style scoped>
.track-workspace {
  display: grid;
  gap: 0.75rem;
}

.track-master {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.track-master-row {
  display: flex;
  min-width: 8.5rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.25rem;
  padding: 0.5rem 0.625rem;
  color: #cbd5e1;
  font-size: 0.875rem;
}

.track-master-row:hover,
.track-master-row--selected {
  border-color: rgba(103, 232, 249, 0.6);
  background: rgba(8, 145, 178, 0.14);
  color: #ecfeff;
}

.track-detail {
  min-width: 0;
}

details > summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

details > summary::after {
  content: '+';
  color: #94a3b8;
  font-size: 0.875rem;
}

details[open] > summary::after {
  content: '−';
}

:deep(.knob-wrap) {
  width: 44px !important;
}

:deep(.knob-svg) {
  width: 40px;
  height: 40px;
}

@media (min-width: 1024px) {
  .track-workspace {
    grid-template-columns: minmax(11rem, 15rem) minmax(0, 1fr);
    height: calc(100% - 2.25rem);
    min-height: 0;
  }

  .track-master {
    flex-direction: column;
    overflow-x: hidden;
    overflow-y: auto;
    padding-right: 0.25rem;
    padding-bottom: 0;
  }

  .track-master-row {
    min-width: 0;
  }

  .track-detail {
    min-height: 0;
    overflow-y: auto;
    padding-right: 0.25rem;
  }
}
</style>
