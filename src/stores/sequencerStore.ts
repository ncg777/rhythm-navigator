import { defineStore } from 'pinia'
import { computed, ref, watch, markRaw, shallowRef } from 'vue'
import * as Tone from 'tone'
import type { Mode, RhythmItem } from '@/utils/rhythm'
import { bitsPerDigitForMode } from '@/utils/rhythm'
import { parseDigitsFromGroupedString } from '@/utils/relations'
import { defaultMidiKeyForTrackType, trackTypeLabel, type TrackType } from '@/utils/drumSounds'

export type { TrackType } from '@/utils/drumSounds'
export { defaultMidiKeyForTrackType } from '@/utils/drumSounds'
export type SwingGrid = 'eighth' | 'sixteenth'

type Pattern = {
  mode: Mode
  groupedDigitsString: string
  digits: number[]
  numerator: number
  denominator: number
  digitsPerBeat: number
  totalBits: number
  spb: number // bits per beat
  onsets: number[]
  cycleQN: number // length in quarter notes
}

export type PatternEntry = {
  pattern: Pattern
  repeats: number // >= 1
}

type Track = {
  id: string
  name: string
  type: TrackType
  rev: number
  volume: number // 0..1
  pan: number // -1..1
  velocity: number // 0..1 default velocity
  velRandom: number // 0..1 randomization extent
  timeScale: number // >0; multiplier on pattern duration (2 = half speed, 0.5 = double speed)
  noteLength: number // 0.01..1.0, fraction of legato (1 = full legato)
  patterns: PatternEntry[]
  // synth parameters per type (simple flat bag to avoid complex unions)
  params: Record<string, number | string>
}

export type SavedPatternEntry = {
  mode: Mode
  groupedDigitsString: string
  digits: number[]
  numerator: number
  denominator: number
  repeats: number
}

export type SavedTrack = {
  id: string
  name: string
  type: TrackType
  volume: number
  pan: number
  velocity: number
  velRandom: number
  timeScale: number
  noteLength: number
  params: Record<string, number | string>
  patterns: SavedPatternEntry[]
  pattern?: null | {
    mode: Mode
    groupedDigitsString: string
    digits: number[]
    numerator: number
    denominator: number
  }
}

export type SequencerSessionSnapshot = {
  bpm: number
  loopBars: number
  swingPercent: number
  swingGrid: SwingGrid
  midiEnabled: boolean
  midiOutputId: string | null
  midiChannel: number
  tracks: SavedTrack[]
}

function defaultTrackName(type: TrackType): string {
  return trackTypeLabel(type)
}

function defaultTrackParams(type: TrackType, current?: Record<string, number | string>) {
  const shared = {
    filterType: current?.filterType ?? 'lowpass',
    filterFrequency: current?.filterFrequency ?? 20000,
    filterResonance: current?.filterResonance ?? 1,
    filterRolloff: current?.filterRolloff ?? -12,
    filterGain: current?.filterGain ?? 0,
    velToFilter: current?.velToFilter ?? 0,
    filterEnvTime: current?.filterEnvTime ?? 0.15,
    distortionInputGain: current?.distortionInputGain ?? 0,
    midiKey: defaultMidiKeyForTrackType(type)
  }
  switch (type) {
    case 'kick':
      return { ...shared, tune: 55, click: 0.5, sweep: 4, sweepTime: 0.04, decay: 0.4, sub: 0.6 }
    case 'snare':
      return { ...shared, tune: 185, toneDecay: 0.12, noiseType: 'white', noiseDecay: 0.2, snap: 0.7, mix: 0.5 }
    case 'clap':
      return { ...shared, tune: 1600, toneDecay: 0.03, noiseType: 'pink', noiseDecay: 0.24, snap: 0.85, mix: 0.55 }
    case 'hat':
      return { ...shared, tune: 300, decay: 0.08, brightness: 8000, harmonicity: 5.1, modIndex: 32 }
    case 'hatPedal':
      return { ...shared, tune: 285, decay: 0.055, brightness: 7200, harmonicity: 5.4, modIndex: 28 }
    case 'hatOpen':
      return { ...shared, tune: 275, decay: 0.48, brightness: 9200, harmonicity: 4.9, modIndex: 38 }
    case 'crash':
      return { ...shared, tune: 220, decay: 1.4, brightness: 12000, harmonicity: 2.2, modIndex: 55, wash: 0.65 }
    case 'chineseCymbal':
      return { ...shared, tune: 175, decay: 1.75, brightness: 8800, harmonicity: 1.45, modIndex: 72, wash: 0.52 }
    case 'splash':
      return { ...shared, tune: 410, decay: 0.62, brightness: 14500, harmonicity: 3.1, modIndex: 48, wash: 0.58 }
    case 'crash2':
      return { ...shared, tune: 245, decay: 1.7, brightness: 13200, harmonicity: 2.55, modIndex: 62, wash: 0.7 }
    case 'rimshot':
      return { ...shared, tune: 260, decay: 0.09, sweep: 0.2, sweepTime: 0.008, snap: 0.9, color: 4800 }
    case 'cowbell':
      return { ...shared, tune: 560, decay: 0.22, brightness: 7000, harmonicity: 5.1, modIndex: 18 }
    case 'chimes':
      return { ...shared, tune: 1047, decay: 2.6, brightness: 9000, harmonicity: 2.1, modIndex: 10 }
    case 'shaker':
      return { ...shared, tune: 4200, decay: 0.12, snap: 0.85, color: 7500 }
    case 'tom':
      return { ...shared, tune: 110, decay: 0.34, sweep: 1.3, sweepTime: 0.035, snap: 0.08, color: 2300 }
    case 'tomLowFloor':
      return { ...shared, tune: 73, decay: 0.52, sweep: 1.55, sweepTime: 0.052, snap: 0.05, color: 1500 }
    case 'tomHighFloor':
      return { ...shared, tune: 87, decay: 0.45, sweep: 1.48, sweepTime: 0.046, snap: 0.06, color: 1800 }
    case 'tomLowMid':
      return { ...shared, tune: 131, decay: 0.3, sweep: 1.18, sweepTime: 0.03, snap: 0.09, color: 2700 }
    case 'tomHighMid':
      return { ...shared, tune: 147, decay: 0.27, sweep: 1.08, sweepTime: 0.026, snap: 0.1, color: 3100 }
    case 'tomHigh':
      return { ...shared, tune: 165, decay: 0.24, sweep: 0.96, sweepTime: 0.022, snap: 0.12, color: 3500 }
    case 'congaMuted':
      return { ...shared, tune: 262, decay: 0.105, sweep: 0.18, sweepTime: 0.01, snap: 0.72, color: 4600 }
    case 'congaOpen':
      return { ...shared, tune: 233, decay: 0.31, sweep: 0.28, sweepTime: 0.016, snap: 0.24, color: 3700 }
    case 'conga':
      return { ...shared, tune: 196, decay: 0.26, sweep: 0.35, sweepTime: 0.018, snap: 0.16, color: 3200 }
    case 'timbale':
      return { ...shared, tune: 260, decay: 0.22, sweep: 0.15, sweepTime: 0.01, snap: 0.3, color: 4400 }
    case 'timbaleLow':
      return { ...shared, tune: 196, decay: 0.28, sweep: 0.19, sweepTime: 0.014, snap: 0.26, color: 3600 }
    case 'triangleMuted':
      return { ...shared, tune: 990, decay: 0.14, brightness: 9800, harmonicity: 3.8, modIndex: 8 }
    case 'triangle':
      return { ...shared, tune: 880, decay: 1.1, brightness: 10500, harmonicity: 3.8, modIndex: 8 }
    case 'ride':
      return { ...shared, tune: 320, decay: 1.8, brightness: 11000, harmonicity: 2.8, modIndex: 42, wash: 0.38 }
    case 'rideBell':
      return { ...shared, tune: 720, decay: 0.72, brightness: 13800, harmonicity: 4.2, modIndex: 34, wash: 0.12 }
    case 'ride2':
      return { ...shared, tune: 350, decay: 2.15, brightness: 10200, harmonicity: 2.35, modIndex: 49, wash: 0.46 }
  }
}

function makeTrackId() {
  return `t${Math.random().toString(36).slice(2, 8)}`
}

function createDefaultSavedTrack(type: TrackType, name?: string): SavedTrack {
  return {
    id: makeTrackId(),
    name: name || defaultTrackName(type),
    type,
    volume: 0.8,
    pan: 0,
    velocity: 0.8,
    velRandom: 0,
    timeScale: 1,
    noteLength: 0.5,
    params: defaultTrackParams(type),
    patterns: []
  }
}

function createDefaultSequencerSessionSnapshot(): SequencerSessionSnapshot {
  return {
    bpm: 120,
    loopBars: 8,
    swingPercent: 0,
    swingGrid: 'eighth',
    midiEnabled: false,
    midiOutputId: null,
    midiChannel: 10,
    tracks: [
      createDefaultSavedTrack('kick', 'Kick'),
      createDefaultSavedTrack('snare', 'Snare'),
      createDefaultSavedTrack('hat', 'Hat'),
      createDefaultSavedTrack('cowbell', 'Cowbell')
    ]
  }
}

function digitsToOnsets(digits: number[], mode: Mode): { onsets: number[]; totalBits: number } {
  const bpd = bitsPerDigitForMode(mode)
  const totalBits = digits.length * bpd
  const onsets: number[] = []
  const max = (1 << bpd) - 1
  for (let j = 0; j < digits.length; j++) {
    const v = Math.max(0, Math.min(digits[j], max))
    const base = j * bpd
    for (let i = 0; i < bpd; i++) {
      const bit = (v >> (bpd - 1 - i)) & 1
      if (bit) onsets.push(base + i)
    }
  }
  return { onsets, totalBits }
}

function firstGroupLength(grouped: string): number {
  const first = grouped.trim().split(/\s+/)[0] || ''
  return first.length || 1
}

function makeInstrument(type: TrackType, params: Record<string, number | string> = {}) {
  // Shared signal chain: voice(s) → inputGain → distortion → filter → postVca
  const preDb = Math.max(-60, Math.min(120, Number(params.distortionInputGain ?? 0)))
  const inputGain = markRaw(new Tone.Gain(Tone.dbToGain(preDb)));
  const distortion = markRaw(new Tone.Distortion(1));
  const filter = markRaw(new Tone.Filter({
    frequency: Number(params.filterFrequency ?? 20000),
    type: String(params.filterType ?? 'lowpass') as BiquadFilterType,
    Q: Number(params.filterResonance ?? 1),
    rolloff: Number(params.filterRolloff ?? -12) as any,
    gain: Number(params.filterGain ?? 0),
  }));
  try { filter.frequency.rampTo(Number(params.filterFrequency ?? 20000), 0.1) } catch {}
  try { filter.Q.rampTo(Number(params.filterResonance ?? 1), 0.1) } catch {}
  try { filter.gain.rampTo(Number(params.filterGain ?? 0), 0.1) } catch {}

  inputGain.connect(distortion);
  distortion.connect(filter);
  const postVca = markRaw(new Tone.Gain(1));
  ;(filter as any).connect(postVca)

  // Helper: schedule post-VCA velocity envelope
  function schedVelEnv(time: number, vel: number, envDur: number) {
    try {
      const g: any = (postVca as any).gain
      g.cancelScheduledValues?.(time)
      g.setValueAtTime?.(Math.max(0, Math.min(1, vel)), time)
      g.linearRampToValueAtTime?.(1, time + Math.max(0.03, envDur))
    } catch {}
  }

  function scheduleGainEnvelope(param: any, start: number, peak: number, attack: number, decay: number) {
    try {
      const att = Math.max(0.0005, attack)
      const end = start + att + Math.max(0.004, decay)
      param.cancelScheduledValues?.(start)
      param.setValueAtTime?.(0, start)
      param.linearRampToValueAtTime?.(peak, start + att)
      param.linearRampToValueAtTime?.(0, end)
    } catch {}
  }

  switch (type) {
    // ===================== KICK (808/909 hybrid) =====================
    case 'kick': {
      const tune = Number(params.tune ?? 55)
      const clickLevel = Math.max(0, Math.min(1, Number(params.click ?? 0.5)))
      const sweepOct = Number(params.sweep ?? 4)
      const sweepTime = Number(params.sweepTime ?? 0.04)
      const bodyDecay = Number(params.decay ?? 0.4)
      const subLevel = Math.max(0, Math.min(1, Number(params.sub ?? 0.6)))

      // Body: MembraneSynth — pitched sweep + sub
      const body = markRaw(new Tone.MembraneSynth({
        octaves: sweepOct,
        pitchDecay: sweepTime,
        envelope: {
          attack: 0.003,
          decay: bodyDecay,
          sustain: subLevel,
          release: Math.min(bodyDecay * 0.4, 0.15)
        }
      }))
      // Click transient: short sine burst at higher pitch
      const click = markRaw(new Tone.Synth({
        oscillator: { type: 'sine' } as any,
        envelope: { attack: 0.001, decay: 0.025, sustain: 0, release: 0.01 }
      }))
      const clickGain = markRaw(new Tone.Gain(clickLevel))
      body.connect(inputGain)
      click.connect(clickGain)
      clickGain.connect(inputGain)

      const live = { tune, clickLevel }
      return {
        node: postVca, filter, voice: body, voice2: click, clickGain,
        preGain: inputGain, hitVca: postVca, live,
        trigger: (time: number, vel: number, duration?: number) => {
          const naturalDur = sweepTime + bodyDecay + 0.15
          const dur = Math.max(naturalDur, duration ?? 0.4)
          schedVelEnv(time, vel, naturalDur + 0.02)
          body.triggerAttackRelease(live.tune, dur, time, vel)
          if (live.clickLevel > 0.01) {
            click.triggerAttackRelease(live.tune * 4, 0.03, time, vel * live.clickLevel)
          }
        }
      }
    }
    // ===================== SNARE (dual-layer: tone + noise) =====================
    case 'snare': {
      const tune = Number(params.tune ?? 185)
      const toneDecay = Number(params.toneDecay ?? 0.12)
      const nt = String(params.noiseType ?? 'white')
      const baseNoiseType = (['white', 'pink', 'brown'].includes(nt) ? nt : 'white') as any
      const noiseDecay = Number(params.noiseDecay ?? 0.2)
      const snapLevel = Math.max(0, Math.min(1, Number(params.snap ?? 0.7)))
      const mix = Math.max(0, Math.min(1, Number(params.mix ?? 0.5)))

      // Tone layer: short pitched body
      const tone = markRaw(new Tone.Synth({
        oscillator: { type: 'triangle' } as any,
        envelope: { attack: 0.001, decay: toneDecay, sustain: 0, release: toneDecay * 0.3 }
      }))
      // Noise layer
      const noise = markRaw(new Tone.NoiseSynth({
        noise: { type: baseNoiseType },
        envelope: { attack: 0.002, decay: noiseDecay, sustain: 0, release: noiseDecay * 0.25 }
      }))
      // Snap transient: very short noise burst for click
      const snapGain = markRaw(new Tone.Gain(snapLevel))
      const snapSynth = markRaw(new Tone.NoiseSynth({
        noise: { type: 'white' as any },
        envelope: { attack: 0.0005, decay: 0.015, sustain: 0, release: 0.005 }
      }))

      // Mix: tone at (1-mix), noise at mix
      const toneGain = markRaw(new Tone.Gain(1 - mix))
      const noiseGain = markRaw(new Tone.Gain(mix))

      tone.connect(toneGain)
      noise.connect(noiseGain)
      snapSynth.connect(snapGain)
      toneGain.connect(inputGain)
      noiseGain.connect(inputGain)
      snapGain.connect(inputGain)

      const live = { tune, snapLevel }
      return {
        node: postVca, filter,
        voice: tone, voice2: noise, voice3: snapSynth,
        toneGain, noiseGain, snapGain,
        preGain: inputGain, hitVca: postVca, live,
        trigger: (time: number, vel: number, duration?: number) => {
          const naturalDur = Math.max(toneDecay, noiseDecay) + 0.05
          const dur = Math.max(naturalDur, duration ?? 0.2)
          schedVelEnv(time, vel, naturalDur)
          tone.triggerAttackRelease(live.tune, toneDecay + toneDecay * 0.3, time, vel)
          noise.triggerAttackRelease(dur, time, vel)
          if (live.snapLevel > 0.01) {
            snapSynth.triggerAttackRelease(0.02, time, vel * live.snapLevel)
          }
        }
      }
    }
    // ===================== CLAP (multi-burst filtered noise) =====================
    case 'clap': {
      const color = Math.max(700, Number(params.tune ?? 1600))
      const burstDecay = Number(params.toneDecay ?? 0.03)
      const nt = String(params.noiseType ?? 'pink')
      const baseNoiseType = (['white', 'pink', 'brown'].includes(nt) ? nt : 'pink') as any
      const tailDecay = Number(params.noiseDecay ?? 0.24)
      const snapLevel = Math.max(0, Math.min(1, Number(params.snap ?? 0.85)))
      const mix = Math.max(0, Math.min(1, Number(params.mix ?? 0.55)))

      const noise = markRaw(new Tone.Noise({ type: baseNoiseType }))
      const toneFilter = markRaw(new Tone.Filter({ type: 'bandpass', frequency: color, Q: 1.35 }))
      const noiseFilter = markRaw(new Tone.Filter({ type: 'highpass', frequency: Math.max(1400, color * 1.5), Q: 0.8 }))
      const snapFilter = markRaw(new Tone.Filter({ type: 'highpass', frequency: Math.max(3200, color * 2.3), Q: 0.7 }))
      const toneGain = markRaw(new Tone.Gain(0))
      const noiseGain = markRaw(new Tone.Gain(0))
      const snapGain = markRaw(new Tone.Gain(0))

      noise.connect(toneFilter)
      noise.connect(noiseFilter)
      noise.connect(snapFilter)
      toneFilter.connect(toneGain)
      noiseFilter.connect(noiseGain)
      snapFilter.connect(snapGain)
      toneGain.connect(inputGain)
      noiseGain.connect(inputGain)
      snapGain.connect(inputGain)
      noise.start()

      const live = { color, burstDecay, tailDecay, snapLevel, mix }
      return {
        node: postVca, filter,
        voice: noise,
        toneFilter, noiseFilter, snapFilter,
        toneGain, noiseGain, snapGain,
        preGain: inputGain, hitVca: postVca, live,
        trigger: (time: number, vel: number, duration?: number) => {
          const burstOffsets = [0, 0.012, 0.024, 0.041]
          const naturalDur = burstOffsets[burstOffsets.length - 1] + live.tailDecay + 0.04
          const bodyLevel = vel * (0.35 + (1 - live.mix) * 0.55)
          const tailLevel = vel * (0.18 + live.mix * 0.85)
          const transientLevel = vel * live.snapLevel
          const dur = Math.max(naturalDur, duration ?? 0.18)
          schedVelEnv(time, vel, dur)
          burstOffsets.forEach((offset, index) => {
            const bodyPeak = bodyLevel * (1 - index * 0.16)
            const transientPeak = transientLevel * (1 - index * 0.14)
            scheduleGainEnvelope((toneGain as any).gain, time + offset, bodyPeak, 0.0006, live.burstDecay * (1 + index * 0.22))
            scheduleGainEnvelope((snapGain as any).gain, time + offset, transientPeak, 0.0002, 0.005 + index * 0.0015)
          })
          scheduleGainEnvelope((noiseGain as any).gain, time + 0.016, tailLevel, 0.0025, live.tailDecay)
        }
      }
    }
    // ===================== HAT (metallic FM) =====================
    case 'hat':
    case 'hatPedal':
    case 'hatOpen': {
      const tune = Number(params.tune ?? 300)
      const decay = Number(params.decay ?? 0.08)
      const brightness = Number(params.brightness ?? 8000)
      const harmonicity = Number(params.harmonicity ?? 5.1)
      const modIndex = Number(params.modIndex ?? 32)

      const metal = markRaw(new Tone.MetalSynth({
        frequency: tune,
        envelope: { attack: 0.001, decay: decay, release: decay * 0.3 },
        harmonicity: harmonicity,
        modulationIndex: modIndex,
        resonance: brightness,
        octaves: 1.5
      }))
      metal.connect(inputGain)

      const live = { tune }
      return {
        node: postVca, filter, voice: metal,
        preGain: inputGain, hitVca: postVca, live,
        trigger: (time: number, vel: number, duration?: number) => {
          const dur = Math.max(decay + decay * 0.3, duration ?? 0.08)
          schedVelEnv(time, vel, decay + 0.02)
          metal.triggerAttackRelease(live.tune, dur, time, vel)
        }
      }
    }
    // ===================== CRASH (metallic body + noise wash) =====================
    case 'crash':
    case 'chineseCymbal':
    case 'splash':
    case 'crash2': {
      const tune = Number(params.tune ?? 220)
      const decay = Number(params.decay ?? 1.4)
      const brightness = Number(params.brightness ?? 12000)
      const harmonicity = Number(params.harmonicity ?? 2.2)
      const modIndex = Number(params.modIndex ?? 55)
      const wash = Math.max(0, Math.min(1, Number(params.wash ?? 0.65)))

      const metal = markRaw(new Tone.MetalSynth({
        frequency: tune,
        envelope: { attack: 0.001, decay, release: decay * 0.7 },
        harmonicity,
        modulationIndex: modIndex,
        resonance: brightness,
        octaves: 2
      }))
      const washNoise = markRaw(new Tone.NoiseSynth({
        noise: { type: 'white' as any },
        envelope: { attack: 0.002, decay: Math.max(0.3, decay * 1.15), sustain: 0, release: Math.max(0.12, decay * 0.45) }
      }))
      const noiseFilter = markRaw(new Tone.Filter({ type: 'highpass', frequency: Math.max(2200, brightness * 0.35), Q: 0.8 }))
      const noiseGain = markRaw(new Tone.Gain(wash))

      metal.connect(inputGain)
      washNoise.connect(noiseFilter)
      noiseFilter.connect(noiseGain)
      noiseGain.connect(inputGain)

      const live = { tune, wash }
      return {
        node: postVca, filter, voice: metal, voice2: washNoise,
        noiseFilter, noiseGain,
        preGain: inputGain, hitVca: postVca, live,
        trigger: (time: number, vel: number, duration?: number) => {
          const naturalDur = decay + decay * 0.7
          const dur = Math.max(naturalDur, duration ?? decay * 1.15)
          schedVelEnv(time, vel, naturalDur + 0.05)
          metal.triggerAttackRelease(live.tune, dur, time, vel)
          if (live.wash > 0.01) {
            washNoise.triggerAttackRelease(Math.max(0.4, decay * 1.1), time, vel * live.wash)
          }
        }
      }
    }
    // ===================== RIMSHOT (stick click + two shell resonances) =====================
    case 'rimshot': {
      const tune = Number(params.tune ?? 260)
      const decay = Number(params.decay ?? 0.09)
      const snapLevel = Math.max(0, Math.min(1, Number(params.snap ?? 0.9)))
      const color = Number(params.color ?? 4800)
      const low = markRaw(new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.0005, decay, sustain: 0, release: 0.015 } }))
      const high = markRaw(new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.0005, decay: decay * 0.52, sustain: 0, release: 0.008 } }))
      const stick = markRaw(new Tone.NoiseSynth({ noise: { type: 'white' as any }, envelope: { attack: 0.0002, decay: 0.008, sustain: 0, release: 0.003 } }))
      const toneGain = markRaw(new Tone.Gain(0.68))
      const noiseGain = markRaw(new Tone.Gain(snapLevel))
      const snapFilter = markRaw(new Tone.Filter({ type: 'bandpass', frequency: color, Q: 2.8 }))
      low.connect(toneGain)
      high.connect(toneGain)
      toneGain.connect(inputGain)
      stick.connect(snapFilter)
      snapFilter.connect(noiseGain)
      noiseGain.connect(inputGain)
      const live = { tune, snapLevel }
      return {
        node: postVca, filter, voice: low, voice2: high, voice3: stick,
        toneGain, noiseGain, snapFilter, preGain: inputGain, hitVca: postVca, live,
        trigger: (time: number, vel: number) => {
          schedVelEnv(time, vel, decay + 0.03)
          low.triggerAttackRelease(live.tune, decay + 0.02, time, vel * 0.78)
          high.triggerAttackRelease(live.tune * 2.72, decay * 0.62, time, vel * 0.55)
          stick.triggerAttackRelease(0.012, time, vel * live.snapLevel)
        }
      }
    }
    // ===================== TOM (deep membrane + woody shell resonance) =====================
    case 'tomLowFloor':
    case 'tomHighFloor':
    case 'tom':
    case 'tomLowMid':
    case 'tomHighMid':
    case 'tomHigh': {
      const tune = Number(params.tune ?? 110)
      const decay = Number(params.decay ?? 0.34)
      const sweep = Number(params.sweep ?? 1.3)
      const sweepTime = Number(params.sweepTime ?? 0.035)
      const body = markRaw(new Tone.MembraneSynth({
        octaves: sweep,
        pitchDecay: sweepTime,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay, sustain: 0.025, release: decay * 0.45 }
      }))
      const shell = markRaw(new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.001, decay: decay * 0.48, sustain: 0, release: 0.035 } }))
      const toneGain = markRaw(new Tone.Gain(0.22))
      body.connect(inputGain)
      shell.connect(toneGain)
      toneGain.connect(inputGain)
      const live = { tune }
      return {
        node: postVca, filter, voice: body, voice2: shell, toneGain,
        preGain: inputGain, hitVca: postVca, live,
        trigger: (time: number, vel: number, duration?: number) => {
          const naturalDur = decay * 1.45 + sweepTime
          schedVelEnv(time, vel, naturalDur)
          body.triggerAttackRelease(live.tune, Math.max(naturalDur, duration ?? decay), time, vel)
          shell.triggerAttackRelease(live.tune * 2.08, decay * 0.58, time, vel * 0.42)
        }
      }
    }
    // ===================== CONGA (tight hand drum + skin slap) =====================
    case 'congaMuted':
    case 'congaOpen':
    case 'conga': {
      const tune = Number(params.tune ?? 196)
      const decay = Number(params.decay ?? 0.26)
      const snapLevel = Math.max(0, Math.min(1, Number(params.snap ?? 0.16)))
      const body = markRaw(new Tone.MembraneSynth({
        octaves: Number(params.sweep ?? 0.35),
        pitchDecay: Number(params.sweepTime ?? 0.018),
        oscillator: { type: 'sine' },
        envelope: { attack: 0.0008, decay, sustain: 0, release: decay * 0.18 }
      }))
      const slap = markRaw(new Tone.NoiseSynth({ noise: { type: 'pink' as any }, envelope: { attack: 0.0005, decay: 0.018, sustain: 0, release: 0.006 } }))
      const snapFilter = markRaw(new Tone.Filter({ type: 'bandpass', frequency: Number(params.color ?? 3200), Q: 1.6 }))
      const snapGain = markRaw(new Tone.Gain(snapLevel))
      body.connect(inputGain)
      slap.connect(snapFilter)
      snapFilter.connect(snapGain)
      snapGain.connect(inputGain)
      const live = { tune, snapLevel }
      return {
        node: postVca, filter, voice: body, voice2: slap, snapFilter, snapGain,
        preGain: inputGain, hitVca: postVca, live,
        trigger: (time: number, vel: number, duration?: number) => {
          schedVelEnv(time, vel, decay + 0.08)
          body.triggerAttackRelease(live.tune, Math.max(decay * 1.2, duration ?? decay), time, vel)
          slap.triggerAttackRelease(0.025, time, vel * live.snapLevel)
        }
      }
    }
    // ===================== TIMBALE (shallow head + bright metal shell) =====================
    case 'timbale':
    case 'timbaleLow': {
      const tune = Number(params.tune ?? 260)
      const decay = Number(params.decay ?? 0.22)
      const body = markRaw(new Tone.MembraneSynth({
        octaves: Number(params.sweep ?? 0.15),
        pitchDecay: Number(params.sweepTime ?? 0.01),
        envelope: { attack: 0.0005, decay, sustain: 0, release: decay * 0.16 }
      }))
      const shell = markRaw(new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.0004, decay: decay * 0.32, sustain: 0, release: 0.012 } }))
      const toneFilter = markRaw(new Tone.Filter({ type: 'bandpass', frequency: Number(params.color ?? 4400), Q: 1.2 }))
      const toneGain = markRaw(new Tone.Gain(Math.max(0, Math.min(0.55, Number(params.snap ?? 0.3)))))
      body.connect(inputGain)
      shell.connect(toneFilter)
      toneFilter.connect(toneGain)
      toneGain.connect(inputGain)
      const live = { tune }
      return {
        node: postVca, filter, voice: body, voice2: shell, toneFilter, toneGain,
        preGain: inputGain, hitVca: postVca, live,
        trigger: (time: number, vel: number, duration?: number) => {
          schedVelEnv(time, vel, decay + 0.05)
          body.triggerAttackRelease(live.tune, Math.max(decay, duration ?? decay), time, vel)
          shell.triggerAttackRelease(live.tune * 4.13, decay * 0.4, time, vel * 0.46)
        }
      }
    }
    // ===================== COWBELL (two detuned square resonators) =====================
    case 'cowbell': {
      const tune = Number(params.tune ?? 560)
      const decay = Number(params.decay ?? 0.22)
      const low = markRaw(new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.0005, decay, sustain: 0, release: decay * 0.22 } }))
      const high = markRaw(new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.0005, decay: decay * 0.72, sustain: 0, release: decay * 0.16 } }))
      const toneFilter = markRaw(new Tone.Filter({ type: 'bandpass', frequency: Number(params.brightness ?? 7000) * 0.24, Q: 0.65 }))
      const toneGain = markRaw(new Tone.Gain(0.48))
      low.connect(toneFilter)
      high.connect(toneFilter)
      toneFilter.connect(toneGain)
      toneGain.connect(inputGain)
      const live = { tune }
      return {
        node: postVca, filter, voice: low, voice2: high, toneFilter, toneGain,
        preGain: inputGain, hitVca: postVca, live,
        trigger: (time: number, vel: number) => {
          schedVelEnv(time, vel, decay + 0.05)
          low.triggerAttackRelease(live.tune, decay * 1.2, time, vel)
          high.triggerAttackRelease(live.tune * 1.481, decay, time, vel * 0.82)
        }
      }
    }
    // ===================== CHIMES (inharmonic struck bars) =====================
    case 'chimes': {
      const tune = Number(params.tune ?? 1047)
      const decay = Number(params.decay ?? 2.6)
      const fundamental = markRaw(new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay, sustain: 0, release: decay * 0.55 } }))
      const partialA = markRaw(new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: decay * 0.72, sustain: 0, release: decay * 0.38 } }))
      const partialB = markRaw(new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: decay * 0.48, sustain: 0, release: decay * 0.25 } }))
      const toneGain = markRaw(new Tone.Gain(0.62))
      fundamental.connect(toneGain)
      partialA.connect(toneGain)
      partialB.connect(toneGain)
      toneGain.connect(inputGain)
      const live = { tune }
      return {
        node: postVca, filter, voice: fundamental, voice2: partialA, voice3: partialB, toneGain,
        preGain: inputGain, hitVca: postVca, live,
        trigger: (time: number, vel: number, duration?: number) => {
          const dur = Math.max(decay * 1.55, duration ?? decay)
          schedVelEnv(time, vel, dur)
          fundamental.triggerAttackRelease(live.tune, dur, time, vel * 0.76)
          partialA.triggerAttackRelease(live.tune * 2.756, decay * 1.1, time, vel * 0.34)
          partialB.triggerAttackRelease(live.tune * 5.404, decay * 0.72, time, vel * 0.18)
        }
      }
    }
    // ===================== TRIANGLE (pure ring + subtle beater overtone) =====================
    case 'triangleMuted':
    case 'triangle': {
      const tune = Number(params.tune ?? 880)
      const decay = Number(params.decay ?? 1.1)
      const ring = markRaw(new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.0005, decay, sustain: 0, release: decay * 0.9 } }))
      const overtone = markRaw(new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.0003, decay: decay * 0.62, sustain: 0, release: decay * 0.42 } }))
      const toneGain = markRaw(new Tone.Gain(0.56))
      ring.connect(toneGain)
      overtone.connect(toneGain)
      toneGain.connect(inputGain)
      const live = { tune }
      return {
        node: postVca, filter, voice: ring, voice2: overtone, toneGain,
        preGain: inputGain, hitVca: postVca, live,
        trigger: (time: number, vel: number, duration?: number) => {
          const dur = Math.max(decay * 1.9, duration ?? decay)
          schedVelEnv(time, vel, dur)
          ring.triggerAttackRelease(live.tune, dur, time, vel * 0.78)
          overtone.triggerAttackRelease(live.tune * 3.92, decay * 1.05, time, vel * 0.24)
        }
      }
    }
    // ===================== RIDE (metal bow + noisy cymbal wash) =====================
    case 'ride':
    case 'rideBell':
    case 'ride2': {
      const tune = Number(params.tune ?? 320)
      const decay = Number(params.decay ?? 1.8)
      const wash = Math.max(0.12, Math.min(0.75, Number(params.wash ?? 0.38)))
      const bow = markRaw(new Tone.MetalSynth({
        frequency: tune,
        envelope: { attack: 0.0007, decay, release: decay * 0.72 },
        harmonicity: Number(params.harmonicity ?? 2.8),
        modulationIndex: Number(params.modIndex ?? 42),
        resonance: Number(params.brightness ?? 11000),
        octaves: 1.35
      }))
      const washNoise = markRaw(new Tone.NoiseSynth({ noise: { type: 'white' as any }, envelope: { attack: 0.001, decay: decay * 0.95, sustain: 0, release: decay * 0.5 } }))
      const noiseFilter = markRaw(new Tone.Filter({ type: 'bandpass', frequency: 7200, Q: 0.38 }))
      const noiseGain = markRaw(new Tone.Gain(wash))
      bow.connect(inputGain)
      washNoise.connect(noiseFilter)
      noiseFilter.connect(noiseGain)
      noiseGain.connect(inputGain)
      const live = { tune, wash }
      return {
        node: postVca, filter, voice: bow, voice2: washNoise, noiseFilter, noiseGain,
        preGain: inputGain, hitVca: postVca, live,
        trigger: (time: number, vel: number, duration?: number) => {
          const dur = Math.max(decay * 1.72, duration ?? decay)
          schedVelEnv(time, vel, dur)
          bow.triggerAttackRelease(live.tune, dur, time, vel * 0.82)
          washNoise.triggerAttackRelease(decay * 1.45, time, vel * live.wash)
        }
      }
    }
    // ===================== SHAKER (irregular granular seed bursts) =====================
    case 'shaker': {
      const decay = Number(params.decay ?? 0.12)
      const color = Number(params.color ?? 7500)
      const snapLevel = Math.max(0, Math.min(1, Number(params.snap ?? 0.85)))
      const noise = markRaw(new Tone.Noise({ type: 'white' }))
      const noiseFilter = markRaw(new Tone.Filter({ type: 'bandpass', frequency: color, Q: 1.25 }))
      const noiseGain = markRaw(new Tone.Gain(0))
      noise.connect(noiseFilter)
      noiseFilter.connect(noiseGain)
      noiseGain.connect(inputGain)
      noise.start()

      return {
        node: postVca, filter, voice: noise, noiseFilter, noiseGain,
        preGain: inputGain, hitVca: postVca, live: { snapLevel },
        trigger: (time: number, vel: number) => {
          schedVelEnv(time, vel, decay + 0.04)
          const grains = [0, 0.011, 0.026, 0.044, 0.067]
          grains.forEach((offset, index) => {
            const peak = vel * snapLevel * (0.62 + index * 0.07)
            scheduleGainEnvelope((noiseGain as any).gain, time + offset, peak, 0.0003, Math.max(0.009, decay * (0.14 + index * 0.035)))
          })
        }
      }
    }
  }
}

// Define the master limiter at the top level
const masterLimiter = markRaw(new Tone.Limiter(-1));
masterLimiter.connect(Tone.getDestination());

export const useSequencerStore = defineStore('sequencer', () => {
  const bpm = ref(120)
  const loopBars = ref(8)
  const swingPercent = ref(0)
  const swingGrid = ref<SwingGrid>('eighth')
  const isPlaying = ref(false)
  // bump this whenever track structure/pattern associations change
  const version = ref(0)

  const tracks = ref<Track[]>([])

  // --- Web MIDI output state
  const midiEnabled = ref(false)
  const midiOutputId = ref<string | null>(null)
  const midiAccess = shallowRef<any | null>(null)
  const midiOutputs = shallowRef<{ id: string; name: string }[]>([])
  const midiChannel = ref(10) // 1..16 (default to 10 for drums)
  const effectiveLoopBars = computed(() => resolveLoopBars())

  type NodeBundle = { inst: ReturnType<typeof makeInstrument>; gain: any; pan: any }
  // Keep audio nodes out of deep reactivity to avoid glitches
  const nodes = shallowRef<Record<string, NodeBundle>>({})

  // Debounced audio sync to coalesce rapid UI param changes
  let syncTimer: number | null = null
  let isStarting = false
  function enqueueAudioSync() {
    if (Tone.getContext().state !== 'running') return
    if (syncTimer != null) return
    syncTimer = (setTimeout(() => {
      syncTimer = null
      try {
        syncNodes()
        rebuildGraph()
      } catch (e) {
        console.error('[sequencer] enqueueAudioSync error', e)
      }
    }, 16) as unknown) as number
  }

  // Initialize Web MIDI and populate outputs
  async function initMidi() {
    if (midiAccess.value) return
    try {
      const access = await (navigator as any).requestMIDIAccess?.({ sysex: false })
      if (!access) return
      midiAccess.value = access
      const update = () => updateMidiOutputs()
      try { access.onstatechange = update } catch {}
      updateMidiOutputs()
    } catch (e) {
      console.warn('[sequencer] Web MIDI not available', e)
    }
  }

  function updateMidiOutputs() {
    try {
      if (!midiAccess.value) { midiOutputs.value = []; return }
      const outs: { id: string; name: string }[] = []
      const it = midiAccess.value.outputs?.values?.()
      if (it && typeof it.next === 'function') {
        for (let r = it.next(); !r.done; r = it.next()) {
          const o = r.value
          outs.push({ id: String(o.id), name: String(o.name || o.manufacturer || 'Output') })
        }
      }
      midiOutputs.value = outs
      if (midiOutputId.value && !outs.find(o => o.id === midiOutputId.value)) midiOutputId.value = null
    } catch {}
  }

  function enableMidiOutput(on: boolean) {
    midiEnabled.value = !!on
    if (midiEnabled.value) initMidi()
    // No need to rebuild schedule; we branch at callback time
    saveToStorage()
  }

  function selectMidiOutput(id: string | null) {
    midiOutputId.value = id
    saveToStorage()
  }

  function getSelectedMidiOutput(): any | null {
    try {
      if (!midiAccess.value || !midiOutputId.value) return null
      const it = midiAccess.value.outputs?.values?.()
      if (!it) return null
      for (let r = it.next(); !r.done; r = it.next()) {
        const o = r.value
        if (String(o.id) === midiOutputId.value) return o
      }
    } catch {}
    return null
  }



  function addTrack(type: TrackType = 'kick', name?: string) {
    const saved = createDefaultSavedTrack(type, name)
    const t: Track = {
      id: saved.id,
      name: saved.name,
      type: saved.type,
      rev: 0,
      volume: saved.volume,
      pan: saved.pan,
      velocity: saved.velocity,
      velRandom: saved.velRandom,
      timeScale: saved.timeScale,
      noteLength: saved.noteLength,
      patterns: [],
      params: { ...(saved.params || {}) }
    }
    tracks.value = tracks.value.concat(t)
    // create nodes only when context is running; otherwise defer to syncNodes on start
    if (Tone.getContext().state === 'running') {
      const inst = markRaw(makeInstrument(t.type, t.params))
      const v = Math.max(0, Math.min(1, t.volume))
      const gain = markRaw(new (Tone as any).Gain(v <= 0 ? 0 : Math.pow(v, 3)))
      const pan = markRaw(new (Tone as any).PanVol(Math.max(-1, Math.min(1, t.pan)), 0))
      ;(inst.node as any).connect(gain)
      gain.connect(pan)
      pan.connect(masterLimiter)
      const bundle: NodeBundle = { inst, gain, pan }
      // shallowRef prevents deep tracking; still markRaw the bundle
      nodes.value[t.id] = markRaw(bundle)
    }
    version.value++
  }

  function removeTrack(id: string) {
  console.log('[sequencer] removeTrack', id)
    const idx = tracks.value.findIndex((x) => x.id === id)
    if (idx < 0) return
  // immutable remove
  tracks.value = tracks.value.filter(t => t.id !== id)
    const n = nodes.value[id]
    if (n) {
      n.pan.dispose()
      n.gain.dispose()
      disposeInstrument(n.inst)
      delete nodes.value[id]
    }
  // clean up signature cache if present
  if (nodeSig.has(id)) nodeSig.delete(id)
  version.value++
  rebuildSchedule()
  }

  // initialize with 4 defaults
  addTrack('kick', 'Kick')
  addTrack('snare', 'Snare')
  addTrack('hat', 'Hat')
  addTrack('cowbell', 'Cowbell')

  // scheduled event IDs for clearing on rebuild
  let scheduledIds: number[] = []

  function qnToSeconds(qn: number): number {
    return (60 / bpm.value) * qn
  }

  function gcdInt(a: number, b: number): number {
    let x = Math.abs(Math.round(a))
    let y = Math.abs(Math.round(b))
    while (y) {
      const t = y
      y = x % y
      x = t
    }
    return x || 1
  }

  function lcmInt(a: number, b: number): number {
    if (!a || !b) return 0
    return Math.abs(Math.round(a / gcdInt(a, b) * b))
  }

  function trackChainQN(track: Track): number {
    const ts = track.timeScale || 1
    return track.patterns.reduce((sum, e) => sum + e.pattern.cycleQN * e.repeats * ts, 0)
  }

  function resolveLoopQN() {
    const TICKS_PER_QN = 960
    const MAX_BARS = 256
    const maxLoopTicks = MAX_BARS * 4 * TICKS_PER_QN
    const chainTicks = tracks.value
      .map((track) => Math.round(trackChainQN(track) * TICKS_PER_QN))
      .filter((ticks) => ticks > 0)
    if (!chainTicks.length) return Math.max(1, Math.floor(loopBars.value) * 4)
    let lcmTicks = chainTicks[0]
    for (let i = 1; i < chainTicks.length; i++) {
      const next = lcmInt(lcmTicks, chainTicks[i])
      if (!Number.isFinite(next) || next <= 0 || next > maxLoopTicks) {
        lcmTicks = Math.max(...chainTicks)
        break
      }
      lcmTicks = next
    }
    return Math.max(1, lcmTicks / TICKS_PER_QN)
  }

  function resolveLoopBars() {
    return Math.max(1, Math.ceil(resolveLoopQN() / 4))
  }

  function clampSwingPercent(value: number): number {
    if (!Number.isFinite(value)) return 0
    return Math.max(0, Math.min(100, Math.round(value)))
  }

  function normalizeSwingGrid(value: unknown): SwingGrid {
    return value === 'sixteenth' ? 'sixteenth' : 'eighth'
  }

  function swingSubdivisionQN(): number {
    return swingGrid.value === 'sixteenth' ? 0.25 : 0.5
  }

  function applySwingToQN(qn: number): number {
    const amount = swingPercent.value / 100
    if (amount <= 0 || !Number.isFinite(qn)) return qn

    const unit = swingSubdivisionQN()
    const pairLen = unit * 2
    const pairIndex = Math.floor(qn / pairLen)
    const pairStart = pairIndex * pairLen
    const local = qn - pairStart
    const midpoint = unit
    const swungMidpoint = midpoint + (unit / 3) * amount

    if (local <= midpoint) {
      return pairStart + (local * swungMidpoint) / midpoint
    }

    const tail = local - midpoint
    const remaining = pairLen - swungMidpoint
    return pairStart + swungMidpoint + (tail * remaining) / midpoint
  }

  function computeVelocity(t: Track, absoluteSeconds: number): number {
    let v = t.velocity
    if (t.velRandom > 0) {
      const r = (Math.random() * 2 - 1) * t.velRandom
      v = v * (1 + r)
    }
    return Math.max(0, Math.min(1, v))
  }

  function disposeInstrument(inst: any) {
    try { inst?.voice?.dispose?.() } catch {}
    try { inst?.voice2?.dispose?.() } catch {}
    try { inst?.voice3?.dispose?.() } catch {}
    try { inst?.clickGain?.dispose?.() } catch {}
    try { inst?.toneFilter?.dispose?.() } catch {}
    try { inst?.toneGain?.dispose?.() } catch {}
    try { inst?.noiseFilter?.dispose?.() } catch {}
    try { inst?.noiseGain?.dispose?.() } catch {}
    try { inst?.snapGain?.dispose?.() } catch {}
    try { inst?.snapFilter?.dispose?.() } catch {}
    try { inst?.node?.dispose?.() } catch {}
  }

  function rebuildGraph() {
    const running = (Tone.getContext().state === 'running')
    if (!running) return
    tracks.value.forEach((t) => {
      const nb = nodes.value[t.id]
      if (!nb) return
      // clamp values defensively
      const vol = Math.max(0, Math.min(1, t.volume))
      const pan = Math.max(-1, Math.min(1, t.pan))
      // exponential mapping so 0 is truly silent and rise feels natural
      const mapped = vol <= 0 ? 0 : Math.pow(vol, 3)
      smoothSetParam(nb.gain.gain, mapped)
      smoothSetParam(nb.pan.pan, pan)
      // Apply pre-distortion input gain (in dB)
  const preDbNow = Math.max(-60, Math.min(120, Number((t.params as any)?.distortionInputGain ?? (t.params as any)?.distortionGain ?? 0)))
      try { if ((nb.inst as any)?.preGain?.gain) smoothSetParam((nb.inst as any).preGain.gain, Tone.dbToGain(preDbNow)) } catch {}

      // Smooth filter updates
  const filter = ((nb.inst as any).filter ?? (nb.inst.node as any))
      try { if (filter?.frequency) smoothSetParam(filter.frequency, Number((t.params as any)?.filterFrequency ?? 20000)) } catch {}
      try { if (filter?.Q) smoothSetParam(filter.Q, Number((t.params as any)?.filterResonance ?? 1)) } catch {}
      try { if (filter?.gain) smoothSetParam(filter.gain, Number((t.params as any)?.filterGain ?? 0)) } catch {}
      try { if ('type' in filter) filter.type = String((t.params as any)?.filterType ?? 'lowpass') } catch {}
      try { if ('rolloff' in filter) filter.rolloff = Number((t.params as any)?.filterRolloff ?? -12) } catch {}

      // Live instrument-specific param updates
      const voice: any = (nb.inst as any)?.voice
      try {
        switch (t.type) {
          case 'kick':
            if (voice && typeof voice.set === 'function') {
              voice.set({
                octaves: Number((t.params as any)?.sweep ?? 4),
                pitchDecay: Number((t.params as any)?.sweepTime ?? 0.04),
                envelope: {
                  attack: 0.003,
                  decay: Number((t.params as any)?.decay ?? 0.4),
                  sustain: Math.max(0, Math.min(1, Number((t.params as any)?.sub ?? 0.6))),
                  release: Math.min(Number((t.params as any)?.decay ?? 0.4) * 0.4, 0.15)
                }
              })
            }
            // Update click transient level
            try {
              const cg: any = (nb.inst as any)?.clickGain?.gain
              if (cg) smoothSetParam(cg, Math.max(0, Math.min(1, Number((t.params as any)?.click ?? 0.5))))
            } catch {}
            // Update live params used by trigger closure
            try { const li = (nb.inst as any)?.live; if (li) { li.tune = Number((t.params as any)?.tune ?? 55); li.clickLevel = Math.max(0, Math.min(1, Number((t.params as any)?.click ?? 0.5))) } } catch {}
            break
          case 'snare': {
            const nt = String((t.params as any)?.noiseType ?? 'white')
            const baseNt = (['white', 'pink', 'brown'].includes(nt) ? nt : 'white')
            const tDec = Number((t.params as any)?.toneDecay ?? 0.12)
            const nDec = Number((t.params as any)?.noiseDecay ?? 0.2)
            const mix = Math.max(0, Math.min(1, Number((t.params as any)?.mix ?? 0.5)))
            if (voice && typeof voice.set === 'function') {
              voice.set({
                oscillator: { type: 'triangle' },
                envelope: { attack: 0.001, decay: tDec, sustain: 0, release: tDec * 0.3 }
              })
            }
            // Update noise voice
            const v2: any = (nb.inst as any)?.voice2
            if (v2 && typeof v2.set === 'function') {
              v2.set({ noise: { type: baseNt }, envelope: { attack: 0.002, decay: nDec, sustain: 0, release: nDec * 0.25 } })
            }
            // Update mix gains
            try { const tg: any = (nb.inst as any)?.toneGain?.gain; if (tg) smoothSetParam(tg, 1 - mix) } catch {}
            try { const ng: any = (nb.inst as any)?.noiseGain?.gain; if (ng) smoothSetParam(ng, mix) } catch {}
            // Update snap level
            try { const sg: any = (nb.inst as any)?.snapGain?.gain; if (sg) smoothSetParam(sg, Math.max(0, Math.min(1, Number((t.params as any)?.snap ?? 0.7)))) } catch {}
            // Update live params used by trigger closure
            try { const li = (nb.inst as any)?.live; if (li) { li.tune = Number((t.params as any)?.tune ?? 185); li.snapLevel = Math.max(0, Math.min(1, Number((t.params as any)?.snap ?? 0.7))) } } catch {}
            break
          }
          case 'clap': {
            const nt = String((t.params as any)?.noiseType ?? 'pink')
            const baseNt = (['white', 'pink', 'brown'].includes(nt) ? nt : 'pink')
            const color = Math.max(700, Number((t.params as any)?.tune ?? 1600))
            const burstDecay = Number((t.params as any)?.toneDecay ?? 0.03)
            const tailDecay = Number((t.params as any)?.noiseDecay ?? 0.24)
            const snapLevel = Math.max(0, Math.min(1, Number((t.params as any)?.snap ?? 0.85)))
            const mix = Math.max(0, Math.min(1, Number((t.params as any)?.mix ?? 0.55)))
            try {
              if (voice?.set) voice.set({ type: baseNt })
              else if ('type' in (voice ?? {})) voice.type = baseNt
            } catch {}
            try { const tf: any = (nb.inst as any)?.toneFilter?.frequency; if (tf) smoothSetParam(tf, color) } catch {}
            try { const nf: any = (nb.inst as any)?.noiseFilter?.frequency; if (nf) smoothSetParam(nf, Math.max(1400, color * 1.5)) } catch {}
            try { const sf: any = (nb.inst as any)?.snapFilter?.frequency; if (sf) smoothSetParam(sf, Math.max(3200, color * 2.3)) } catch {}
            try {
              const li = (nb.inst as any)?.live
              if (li) {
                li.color = color
                li.burstDecay = burstDecay
                li.tailDecay = tailDecay
                li.snapLevel = snapLevel
                li.mix = mix
              }
            } catch {}
            break
          }
          case 'hat':
          case 'hatPedal':
          case 'hatOpen':
            if (voice && typeof voice.set === 'function') {
              voice.set({
                frequency: Number((t.params as any)?.tune ?? 300),
                harmonicity: Number((t.params as any)?.harmonicity ?? 5.1),
                modulationIndex: Number((t.params as any)?.modIndex ?? 32),
                resonance: Number((t.params as any)?.brightness ?? 8000),
                octaves: 1.5,
                envelope: {
                  attack: 0.001,
                  decay: Number((t.params as any)?.decay ?? 0.08),
                  release: Number((t.params as any)?.decay ?? 0.08) * 0.3
                }
              })
            }
            // Update live params used by trigger closure
            try { const li = (nb.inst as any)?.live; if (li) li.tune = Number((t.params as any)?.tune ?? 300) } catch {}
            break
          case 'crash':
          case 'chineseCymbal':
          case 'splash':
          case 'crash2': {
            const decay = Number((t.params as any)?.decay ?? 1.4)
            if (voice && typeof voice.set === 'function') {
              voice.set({
                frequency: Number((t.params as any)?.tune ?? 220),
                harmonicity: Number((t.params as any)?.harmonicity ?? 2.2),
                modulationIndex: Number((t.params as any)?.modIndex ?? 55),
                resonance: Number((t.params as any)?.brightness ?? 12000),
                octaves: 2,
                envelope: {
                  attack: 0.001,
                  decay,
                  release: decay * 0.7
                }
              })
            }
            const v2: any = (nb.inst as any)?.voice2
            if (v2 && typeof v2.set === 'function') {
              v2.set({
                noise: { type: 'white' },
                envelope: { attack: 0.002, decay: Math.max(0.3, decay * 1.15), sustain: 0, release: Math.max(0.12, decay * 0.45) }
              })
            }
            try { const ng: any = (nb.inst as any)?.noiseGain?.gain; if (ng) smoothSetParam(ng, Math.max(0, Math.min(1, Number((t.params as any)?.wash ?? 0.65)))) } catch {}
            try { const nf: any = (nb.inst as any)?.noiseFilter?.frequency; if (nf) smoothSetParam(nf, Math.max(2200, Number((t.params as any)?.brightness ?? 12000) * 0.35)) } catch {}
            try {
              const li = (nb.inst as any)?.live
              if (li) {
                li.tune = Number((t.params as any)?.tune ?? 220)
                li.wash = Math.max(0, Math.min(1, Number((t.params as any)?.wash ?? 0.65)))
              }
            } catch {}
            break
          }
          case 'rimshot': {
            const decay = Number((t.params as any)?.decay ?? 0.09)
            if (voice && typeof voice.set === 'function') {
              voice.set({ envelope: { attack: 0.0005, decay, sustain: 0, release: 0.015 } })
            }
            try { const v2: any = (nb.inst as any)?.voice2; v2?.set?.({ envelope: { attack: 0.0005, decay: decay * 0.52, sustain: 0, release: 0.008 } }) } catch {}
            try { const ng: any = (nb.inst as any)?.noiseGain?.gain; if (ng) smoothSetParam(ng, Math.max(0, Math.min(1, Number((t.params as any)?.snap ?? 0.9)))) } catch {}
            try { const sf: any = (nb.inst as any)?.snapFilter?.frequency; if (sf) smoothSetParam(sf, Number((t.params as any)?.color ?? 4800)) } catch {}
            try { const li = (nb.inst as any)?.live; if (li) { li.tune = Number((t.params as any)?.tune ?? 260); li.snapLevel = Math.max(0, Math.min(1, Number((t.params as any)?.snap ?? 0.9))) } } catch {}
            break
          }
          case 'tomLowFloor':
          case 'tomHighFloor':
          case 'tom':
          case 'tomLowMid':
          case 'tomHighMid':
          case 'tomHigh': {
            const decay = Number((t.params as any)?.decay ?? 0.34)
            voice?.set?.({
              octaves: Number((t.params as any)?.sweep ?? 1.3),
              pitchDecay: Number((t.params as any)?.sweepTime ?? 0.035),
              envelope: { attack: 0.001, decay, sustain: 0.025, release: decay * 0.45 }
            })
            try { const v2: any = (nb.inst as any)?.voice2; v2?.set?.({ envelope: { attack: 0.001, decay: decay * 0.48, sustain: 0, release: 0.035 } }) } catch {}
            try { const li = (nb.inst as any)?.live; if (li) li.tune = Number((t.params as any)?.tune ?? 110) } catch {}
            break
          }
          case 'congaMuted':
          case 'congaOpen':
          case 'conga': {
            const decay = Number((t.params as any)?.decay ?? 0.26)
            voice?.set?.({
              octaves: Number((t.params as any)?.sweep ?? 0.35),
              pitchDecay: Number((t.params as any)?.sweepTime ?? 0.018),
              envelope: { attack: 0.0008, decay, sustain: 0, release: decay * 0.18 }
            })
            try { const sg: any = (nb.inst as any)?.snapGain?.gain; if (sg) smoothSetParam(sg, Math.max(0, Math.min(1, Number((t.params as any)?.snap ?? 0.16)))) } catch {}
            try { const sf: any = (nb.inst as any)?.snapFilter?.frequency; if (sf) smoothSetParam(sf, Number((t.params as any)?.color ?? 3200)) } catch {}
            try { const li = (nb.inst as any)?.live; if (li) { li.tune = Number((t.params as any)?.tune ?? 196); li.snapLevel = Math.max(0, Math.min(1, Number((t.params as any)?.snap ?? 0.16))) } } catch {}
            break
          }
          case 'timbale':
          case 'timbaleLow': {
            const decay = Number((t.params as any)?.decay ?? 0.22)
            voice?.set?.({
              octaves: Number((t.params as any)?.sweep ?? 0.15),
              pitchDecay: Number((t.params as any)?.sweepTime ?? 0.01),
              envelope: { attack: 0.0005, decay, sustain: 0, release: decay * 0.16 }
            })
            try { const v2: any = (nb.inst as any)?.voice2; v2?.set?.({ envelope: { attack: 0.0004, decay: decay * 0.32, sustain: 0, release: 0.012 } }) } catch {}
            try { const tf: any = (nb.inst as any)?.toneFilter?.frequency; if (tf) smoothSetParam(tf, Number((t.params as any)?.color ?? 4400)) } catch {}
            try { const tg: any = (nb.inst as any)?.toneGain?.gain; if (tg) smoothSetParam(tg, Math.max(0, Math.min(0.55, Number((t.params as any)?.snap ?? 0.3)))) } catch {}
            try { const li = (nb.inst as any)?.live; if (li) li.tune = Number((t.params as any)?.tune ?? 260) } catch {}
            break
          }
          case 'cowbell': {
            const decay = Number((t.params as any)?.decay ?? 0.22)
            voice?.set?.({ envelope: { attack: 0.0005, decay, sustain: 0, release: decay * 0.22 } })
            try { const v2: any = (nb.inst as any)?.voice2; v2?.set?.({ envelope: { attack: 0.0005, decay: decay * 0.72, sustain: 0, release: decay * 0.16 } }) } catch {}
            try { const tf: any = (nb.inst as any)?.toneFilter?.frequency; if (tf) smoothSetParam(tf, Number((t.params as any)?.brightness ?? 7000) * 0.24) } catch {}
            try { const li = (nb.inst as any)?.live; if (li) li.tune = Number((t.params as any)?.tune ?? 560) } catch {}
            break
          }
          case 'chimes': {
            const decay = Number((t.params as any)?.decay ?? 2.6)
            voice?.set?.({ envelope: { attack: 0.001, decay, sustain: 0, release: decay * 0.55 } })
            try { const v2: any = (nb.inst as any)?.voice2; v2?.set?.({ envelope: { attack: 0.001, decay: decay * 0.72, sustain: 0, release: decay * 0.38 } }) } catch {}
            try { const v3: any = (nb.inst as any)?.voice3; v3?.set?.({ envelope: { attack: 0.001, decay: decay * 0.48, sustain: 0, release: decay * 0.25 } }) } catch {}
            try { const li = (nb.inst as any)?.live; if (li) li.tune = Number((t.params as any)?.tune ?? 1047) } catch {}
            break
          }
          case 'triangleMuted':
          case 'triangle': {
            const decay = Number((t.params as any)?.decay ?? 1.1)
            voice?.set?.({ envelope: { attack: 0.0005, decay, sustain: 0, release: decay * 0.9 } })
            try { const v2: any = (nb.inst as any)?.voice2; v2?.set?.({ envelope: { attack: 0.0003, decay: decay * 0.62, sustain: 0, release: decay * 0.42 } }) } catch {}
            try { const li = (nb.inst as any)?.live; if (li) li.tune = Number((t.params as any)?.tune ?? 880) } catch {}
            break
          }
          case 'ride':
          case 'rideBell':
          case 'ride2': {
            const decay = Number((t.params as any)?.decay ?? 1.8)
            voice?.set?.({
              frequency: Number((t.params as any)?.tune ?? 320),
              harmonicity: Number((t.params as any)?.harmonicity ?? 2.8),
              modulationIndex: Number((t.params as any)?.modIndex ?? 42),
              resonance: Number((t.params as any)?.brightness ?? 11000),
              octaves: 1.35,
              envelope: { attack: 0.0007, decay, release: decay * 0.72 }
            })
            try { const ng: any = (nb.inst as any)?.noiseGain?.gain; if (ng) smoothSetParam(ng, Math.max(0.12, Math.min(0.75, Number((t.params as any)?.wash ?? 0.38)))) } catch {}
            try { const li = (nb.inst as any)?.live; if (li) { li.tune = Number((t.params as any)?.tune ?? 320); li.wash = Math.max(0.12, Math.min(0.75, Number((t.params as any)?.wash ?? 0.38))) } } catch {}
            break
          }
          case 'shaker':
            try { const sf: any = (nb.inst as any)?.snapFilter?.frequency; if (sf) smoothSetParam(sf, Number((t.params as any)?.color ?? 3000)) } catch {}
            try { const nf: any = (nb.inst as any)?.noiseFilter?.frequency; if (nf) smoothSetParam(nf, Number((t.params as any)?.color ?? 7500)) } catch {}
            try { const li = (nb.inst as any)?.live; if (li) li.snapLevel = Math.max(0, Math.min(1, Number((t.params as any)?.snap ?? 0.85))) } catch {}
            break
        }
      } catch {}
    })
  }

  const nodeSig = new Map<string, string>()
  function signatureFor(t: Track): string {
    // Only include type; apply other param changes live to avoid clicks
    return `${t.type}`
  }

  function smoothSetParam(param: any, target: number, time = 0.02) {
    try {
      const now = Tone.now()
      if (param?.rampTo) {
        param.rampTo(target, time)
      } else if (param?.linearRampToValueAtTime) {
        param.cancelScheduledValues?.(now)
        param.linearRampToValueAtTime(target, now + time)
      } else if (typeof param?.setValueAtTime === 'function') {
        param.setValueAtTime(target, now)
      } else if ('value' in (param ?? {})) {
        param.value = target
      }
    } catch {
      try { if ('value' in (param ?? {})) (param as any).value = target } catch {}
    }
  }

  function syncNodes() {
    // Ensure node exists for each track, recreate if signature changed
    if (Tone.getContext().state !== 'running') return
    const presentIds = new Set(tracks.value.map(t => t.id))
    tracks.value.forEach((t) => {
      const id = t.id
      const sig = signatureFor(t)
      const currentSig = nodeSig.get(id)
      if (!nodes.value[id]) {
        // create new node bundle
  const inst = markRaw(makeInstrument(t.type, t.params))
  const v0 = Math.max(0, Math.min(1, t.volume))
  const gain = markRaw(new (Tone as any).Gain(v0 <= 0 ? 0 : Math.pow(v0, 3)))
        const pan = markRaw(new (Tone as any).PanVol(Math.max(-1, Math.min(1, t.pan)), 0))
        ;(inst.node as any).connect(gain)
        gain.connect(pan)
        pan.connect(masterLimiter)
        const bundle: NodeBundle = { inst, gain, pan }
        nodes.value[id] = markRaw(bundle)
        nodeSig.set(id, sig)
        return
      }
      if (currentSig !== sig) {
        // replace instrument (keep gain/pan so automation stays stable)
        try { (nodes.value[id].inst.node as any).disconnect?.() } catch {}
        disposeInstrument(nodes.value[id].inst)
        const inst = markRaw(makeInstrument(t.type, t.params))
  ;(inst.node as any).connect(nodes.value[id].gain)
        nodes.value[id].inst = inst as any
        nodeSig.set(id, sig)
      }
    })
    // Dispose any stray nodes not in tracks
    Object.keys(nodes.value).forEach(id => {
      if (presentIds.has(id)) return
      const nb = nodes.value[id]
      try { nb.pan.dispose() } catch {}
      try { nb.gain.dispose() } catch {}
      disposeInstrument(nb.inst)
      delete nodes.value[id]
      nodeSig.delete(id)
    })
  }

  function clearSchedule() {
    scheduledIds.forEach((id) => Tone.Transport.clear(id))
    scheduledIds = []
  }

  function rebuildSchedule() {
    clearSchedule()
    const running = (Tone.getContext().state === 'running')
    // If transport/audio context not running or we're not in play state, don't schedule
    if (!running || !isPlaying.value) {
      Tone.Transport.bpm.value = bpm.value
      return
    }
    // Context running and playing: set BPM and schedule
    Tone.Transport.bpm.value = bpm.value
    const loopQN = resolveLoopQN()
    Tone.Transport.loop = true
    Tone.Transport.loopStart = 0
    Tone.Transport.loopEnd = qnToSeconds(loopQN)

  tracks.value.forEach((t) => {
      if (!t.patterns.length) return
      const ts = t.timeScale || 1
      const nl = t.noteLength || 0.5
      // Compute the total chain length = sum of all pattern entries' cycleQN * repeats * timeScale
      const chainQN = t.patterns.reduce((sum, e) => sum + e.pattern.cycleQN * e.repeats * ts, 0)
      if (chainQN <= 0) return
      // Loop the chain within the global loop
      for (let chainBase = 0; chainBase < loopQN - 1e-9; chainBase += chainQN) {
        let offsetQN = chainBase
        for (const entry of t.patterns) {
          const pat = entry.pattern
          const patCycleQN = pat.cycleQN * ts
          for (let rep = 0; rep < entry.repeats; rep++) {
            // For each onset, compute the inter-onset interval (IOI) with circular lookahead
            for (let onsetIdx = 0; onsetIdx < pat.onsets.length; onsetIdx++) {
              const onset = pat.onsets[onsetIdx]
              const onsetQN = (onset / pat.spb) * ts
              const atQN = offsetQN + onsetQN
              if (atQN > loopQN + 1e-9) break
              
              // Calculate inter-onset interval: time from this onset to the next (wrapping circularly)
              const nextOnsetIdx = (onsetIdx + 1) % pat.onsets.length
              const nextOnset = pat.onsets[nextOnsetIdx]
              let ioiQN: number
              if (nextOnsetIdx > onsetIdx) {
                // Next onset is later in the same pattern cycle
                ioiQN = ((nextOnset - onset) / pat.spb) * ts
              } else {
                // Next onset wraps to the beginning of the next pattern cycle
                ioiQN = ((pat.totalBits - onset + nextOnset) / pat.spb) * ts
              }
              
              const swungAtQN = applySwingToQN(atQN)
              const swungOffQN = applySwingToQN(atQN + (ioiQN * nl))
              const atSec = qnToSeconds(swungAtQN)
              const noteDurQN = Math.max(1 / 960, swungOffQN - swungAtQN)
              const noteDurSec = qnToSeconds(noteDurQN)
              const trackId = t.id
              const capturedNoteDur = noteDurSec
              const id = Tone.Transport.schedule((time: number) => {
                // Resolve latest track state at callback time so velocity/velRandom changes are live
                const tLatest = tracks.value.find(x => x.id === trackId) || t
                const vel = computeVelocity(tLatest, atSec)
                // Branch: send Web MIDI if enabled and output selected
                const out = midiEnabled.value ? getSelectedMidiOutput() : null
                if (out) {
                  try {
                    const note = Number((tLatest.params as any)?.midiKey ?? defaultMidiKeyForTrackType(tLatest.type))
                    const velocity = Math.max(1, Math.min(127, Math.round(vel * 127)))
                    const nowSec = Tone.now()
                    const tsMs = performance.now() + Math.max(0, (time - nowSec) * 1000)
                    const ch = Math.max(0, Math.min(15, (Number(midiChannel.value) || 1) - 1))
                    out.send([0x90 | ch, note, velocity], tsMs)
                    const offMs = capturedNoteDur * 1000
                    out.send([0x80 | ch, note, 0], tsMs + offMs)
                  } catch (e) {
                    console.warn('[sequencer] MIDI send failed', e)
                  }
                  return
                }
                // Otherwise, trigger audio
                const nb = nodes.value[trackId]
                nb?.inst.trigger(time, vel, capturedNoteDur)
                // Apply velocity-scaled filter envelope modulation per hit
                try {
                  const filterNode: any = (nb?.inst as any)?.filter ?? nb?.inst?.node
                  const params: any = (tLatest as any)?.params || {}
                  const baseHz = Number(params.filterFrequency ?? 20000)
                  const amtCtl = Number(params.velToFilter ?? 0) // -1..1
                  let envTime = Number(params.filterEnvTime ?? 0.15)
                  envTime = Math.max(0.005, Math.min(2.0, envTime))
                  const amount = amtCtl * Math.max(0, Math.min(1, vel))
                  scheduleFilterEnv(filterNode, baseHz, amount, envTime, time)
                } catch {}
              }, atSec)
              scheduledIds.push(id)
            }
            offsetQN += patCycleQN
            if (offsetQN > loopQN + 1e-9) break
          }
          if (offsetQN > loopQN + 1e-9) break
        }
      }
    })
  }

  // Schedule a simple one-shot filter frequency envelope at an absolute time.
  // amount: [-1..1] after velocity scaling; positive opens the filter, negative closes it.
  function scheduleFilterEnv(filterNode: any, baseHz: number, amount: number, envTime: number, atTime: number) {
    try {
      const freq: any = filterNode?.frequency
      if (!freq || !isFinite(baseHz)) return
      const minHz = 20
      const maxHz = 20000
      // Map amount [-1..1] to ratio within ±2 octaves
      const ratio = Math.pow(2, amount * 2) // amount=1 => x4, amount=-1 => x0.25
      const target = Math.max(minHz, Math.min(maxHz, baseHz * ratio))
      // Attack is a small portion of the env time, capped small to avoid clicks
      let atk = Math.min(Math.max(envTime * 0.2, 0.002), 0.02)
      // Ensure atk < envTime
      if (atk >= envTime) atk = Math.max(0.002, envTime * 0.5)
      // Schedule ramps
      freq.cancelScheduledValues?.(atTime)
      freq.setValueAtTime?.(baseHz, atTime)
      freq.linearRampToValueAtTime?.(target, atTime + atk)
      freq.linearRampToValueAtTime?.(baseHz, atTime + envTime)
    } catch {}
  }

  async function start() {
    if (Tone.getContext().state !== 'running') {
      await Tone.start()
    }
    // Lower-latency, smoother scheduling
    try {
      (Tone.getContext() as any).latencyHint = 'interactive'
      ;(Tone.getContext() as any).lookAhead = 0.1
    } catch {}
    // Defer node sync slightly after context start to avoid race conditions
    isStarting = true
    setTimeout(() => {
      try { enqueueAudioSync() } catch (e) { /* ignore */ }
      isStarting = false
    }, 32)
    // Mark playing first so rebuildSchedule actually schedules events
    isPlaying.value = true
    rebuildSchedule()
    Tone.Transport.start()
  }

  function stop() {
    if (Tone.getContext().state === 'running') {
      // Stop transport and clear all scheduled events to avoid stray triggers later
      Tone.Transport.stop()
      try { Tone.Transport.cancel() } catch {}
      clearSchedule()
    }
    isPlaying.value = false
  }

  function setBpm(v: number) {
    bpm.value = Math.max(30, Math.min(300, Math.round(v)))
    if (isPlaying.value) {
      // seconds-based schedule needs rebuild when BPM changes
      rebuildSchedule()
    }
  }

  function setSwingPercent(value: number) {
    swingPercent.value = clampSwingPercent(value)
    if (isPlaying.value) rebuildSchedule()
  }

  function setSwingGrid(value: SwingGrid) {
    const next = normalizeSwingGrid(value)
    if (swingGrid.value === next) return
    swingGrid.value = next
    if (isPlaying.value) rebuildSchedule()
  }

  function setLoopBars(v: number) {
    loopBars.value = Math.max(1, Math.round(v))
    if (isPlaying.value) rebuildSchedule()
  }

  function setTrackType(id: string, type: TrackType) {
    let changed = false
    tracks.value = tracks.value.map(t => {
      if (t.id !== id) return t
      changed = true
      return { ...t, type, params: defaultTrackParams(type, t.params), rev: t.rev + 1 }
    })
    if (!changed) return
  // will be recreated on next syncNodes (signature change)
  enqueueAudioSync()
  version.value++
  }

  // Immutable updates for mix fields to avoid deep in-place mutations
  function updateTrackFields(id: string, patch: Partial<Pick<Track, 'name' | 'volume' | 'pan' | 'velocity' | 'velRandom' | 'timeScale' | 'noteLength'>>) {
    let changed = false
    tracks.value = tracks.value.map(t => {
      if (t.id !== id) return t
      const next: Track = { ...t, ...patch }
      // clamp where necessary
      next.volume = Math.max(0, Math.min(1, Number(next.volume)))
      next.pan = Math.max(-1, Math.min(1, Number(next.pan)))
      next.velocity = Math.max(0, Math.min(1, Number(next.velocity)))
      next.velRandom = Math.max(0, Math.min(1, Number(next.velRandom)))
      next.timeScale = Math.max(0.0625, Math.min(16, Number(next.timeScale) || 1))
      next.noteLength = Math.max(0.01, Math.min(1, Number(next.noteLength) || 0.5))
      changed = true
      return next
    })
    if (changed) {
      version.value++
      enqueueAudioSync()
      // timeScale or noteLength changes event timing which is baked into the Transport schedule
      if (('timeScale' in patch || 'noteLength' in patch) && isPlaying.value) rebuildSchedule()
    }
  }

  // Immutable update for a synth parameter; triggers node rebuild via signature change
  function updateTrackParam(id: string, key: string, value: number | string) {
    let changed = false
    tracks.value = tracks.value.map(t => {
      if (t.id !== id) return t
      const params = { ...(t.params || {}) }
      params[key] = value as any
      changed = true
      return { ...t, params, rev: t.rev + 1 }
    })
    if (changed) {
      version.value++
      enqueueAudioSync()
    }
  }

  function assignRhythmToTrack(id: string, item: RhythmItem, numerator: number, denominator: number) {
  const idx = tracks.value.findIndex((x) => x.id === id)
  if (idx < 0) return
  const mode = item.base
    const digits = item.digits ?? parseDigitsFromGroupedString(item.groupedDigitsString, mode)
    // Prefer rhythm item's own meter if present; otherwise infer from grouped string, then fall back to provided values
    const groups = item.groupedDigitsString.trim().length
      ? item.groupedDigitsString.trim().split(/\s+/).filter(Boolean)
      : []
    const inferredNum = groups.length > 0 ? groups.length : undefined
    const inferredDen = groups.length > 0 ? firstGroupLength(item.groupedDigitsString) : undefined
    const numEff = Math.max(1, Math.floor((item.numerator as number) || inferredNum || numerator))
    const denEff = Math.max(1, Math.floor((item.denominator as number) || inferredDen || denominator))
  // Use effective denominator (digits per beat)
  const dpb = Math.max(1, Math.floor(denEff))
    const bpd = bitsPerDigitForMode(mode)
    const spb = dpb * bpd
    const { onsets, totalBits } = digitsToOnsets(digits, mode)
    const cycleQN = totalBits / spb
    const pattern: Pattern = {
      mode,
      groupedDigitsString: item.groupedDigitsString,
      digits,
  numerator: numEff,
  denominator: denEff,
      digitsPerBeat: dpb,
      totalBits,
      spb,
      onsets,
      cycleQN
    }
  // Append pattern to the patterns list
  const entry: PatternEntry = { pattern, repeats: 1 }
  tracks.value = tracks.value.map((t, i) => i === idx ? { ...t, patterns: [...t.patterns, entry], rev: t.rev + 1 } : t)
  version.value++
    if (isPlaying.value) rebuildSchedule()
  }

  // Remove a pattern at the given index from a track's pattern list
  function removePatternFromTrack(trackId: string, patternIndex: number) {
    tracks.value = tracks.value.map(t => {
      if (t.id !== trackId) return t
      const patterns = t.patterns.filter((_, i) => i !== patternIndex)
      return { ...t, patterns, rev: t.rev + 1 }
    })
    version.value++
    if (isPlaying.value) rebuildSchedule()
  }

  // Set the repeat count for a pattern entry
  function setPatternRepeats(trackId: string, patternIndex: number, repeats: number) {
    const r = Math.max(1, Math.floor(repeats))
    tracks.value = tracks.value.map(t => {
      if (t.id !== trackId) return t
      const patterns = t.patterns.map((e, i) => i === patternIndex ? { ...e, repeats: r } : e)
      return { ...t, patterns, rev: t.rev + 1 }
    })
    version.value++
    if (isPlaying.value) rebuildSchedule()
  }

  // Move a pattern entry up or down in the list
  function movePatternInTrack(trackId: string, fromIndex: number, toIndex: number) {
    tracks.value = tracks.value.map(t => {
      if (t.id !== trackId) return t
      const patterns = [...t.patterns]
      if (fromIndex < 0 || fromIndex >= patterns.length || toIndex < 0 || toIndex >= patterns.length) return t
      const [entry] = patterns.splice(fromIndex, 1)
      patterns.splice(toIndex, 0, entry)
      return { ...t, patterns, rev: t.rev + 1 }
    })
    version.value++
    if (isPlaying.value) rebuildSchedule()
  }

  // Update the assigned pattern's meter (numerator/denominator) per track, at a specific pattern index
  function updateTrackPatternMeter(id: string, numerator: number, denominator: number, patternIndex = 0) {
    const idx = tracks.value.findIndex((x) => x.id === id)
    if (idx < 0) return
    const t = tracks.value[idx]
    if (!t.patterns[patternIndex]) return
    const pat = t.patterns[patternIndex].pattern
    const num = Math.max(1, Math.floor(Number(numerator)))
    const den = Math.max(1, Math.floor(Number(denominator)))
    const mode = pat.mode
    const bpd = bitsPerDigitForMode(mode)
    const dpb = den
    const spb = dpb * bpd
    const totalBits = pat.digits.length * bpd
    const cycleQN = totalBits / spb
    const nextPattern: Pattern = {
      ...pat,
      numerator: num,
      denominator: den,
      digitsPerBeat: dpb,
      spb,
      totalBits, // redundant but keep consistent
      cycleQN
    }
    tracks.value = tracks.value.map((tr) => {
      if (tr.id !== id) return tr
      const patterns = tr.patterns.map((e, i) => i === patternIndex ? { ...e, pattern: nextPattern } : e)
      return { ...tr, patterns, rev: tr.rev + 1 }
    })
    version.value++
    if (isPlaying.value) rebuildSchedule()
  }

  // reactive rebuild when track params change materially
  watch(
    tracks,
    () => {
      try {
        // Only touch audio graph when context is running to avoid InvalidStateError
  enqueueAudioSync()
      } catch (err) {
        console.error('[sequencer] watch(tracks) error', err)
      }
    },
    { deep: true }
  )

  // --- Export helpers
  function snapshotEvents(loopQN: number): { timeQN: number; timeSec: number; trackIndex: number; velocity: number; noteDurSec: number }[] {
    const events: { timeQN: number; timeSec: number; trackIndex: number; velocity: number; noteDurSec: number }[] = []
    tracks.value.forEach((t, i) => {
      if (!t.patterns.length) return
      const ts = t.timeScale || 1
      const nl = t.noteLength || 0.5
      const chainQN = t.patterns.reduce((sum, e) => sum + e.pattern.cycleQN * e.repeats * ts, 0)
      if (chainQN <= 0) return
      for (let chainBase = 0; chainBase < loopQN - 1e-9; chainBase += chainQN) {
        let offsetQN = chainBase
        for (const entry of t.patterns) {
          const pat = entry.pattern
          const patCycleQN = pat.cycleQN * ts
          for (let rep = 0; rep < entry.repeats; rep++) {
            for (let onsetIdx = 0; onsetIdx < pat.onsets.length; onsetIdx++) {
              const onset = pat.onsets[onsetIdx]
              const onsetQN = (onset / pat.spb) * ts
              const atQN = offsetQN + onsetQN
              if (atQN > loopQN + 1e-9) break

              const nextOnsetIdx = (onsetIdx + 1) % pat.onsets.length
              const nextOnset = pat.onsets[nextOnsetIdx]
              let ioiQN: number
              if (nextOnsetIdx > onsetIdx) {
                ioiQN = ((nextOnset - onset) / pat.spb) * ts
              } else {
                ioiQN = ((pat.totalBits - onset + nextOnset) / pat.spb) * ts
              }

              const swungAtQN = applySwingToQN(atQN)
              const swungOffQN = applySwingToQN(atQN + (ioiQN * nl))
              const atSec = qnToSeconds(swungAtQN)
              const noteDurQN = Math.max(1 / 960, swungOffQN - swungAtQN)
              const noteDurSec = qnToSeconds(noteDurQN)
              const vel = computeVelocity(t, atSec)
              events.push({ timeQN: swungAtQN, timeSec: atSec, trackIndex: i, velocity: vel, noteDurSec })
            }
            offsetQN += patCycleQN
            if (offsetQN > loopQN + 1e-9) break
          }
          if (offsetQN > loopQN + 1e-9) break
        }
      }
    })
    events.sort((a, b) => a.timeQN - b.timeQN || a.trackIndex - b.trackIndex)
    return events
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function formatTimestamp(d = new Date()) {
    const pad = (n: number) => String(n).padStart(2, '0')
    const yyyy = d.getFullYear()
    const MM = pad(d.getMonth() + 1)
    const dd = pad(d.getDate())
    const hh = pad(d.getHours())
    const mm = pad(d.getMinutes())
    const ss = pad(d.getSeconds())
    return `${yyyy}${MM}${dd}-${hh}${mm}${ss}`
  }

  function encodeWavFromBuffer(buf: AudioBuffer): Blob {
    const numChannels = buf.numberOfChannels
    const length = buf.length
    const sampleRate = buf.sampleRate
    const bytesPerSample = 2
    const blockAlign = numChannels * bytesPerSample
    const dataSize = length * blockAlign
    const buffer = new ArrayBuffer(44 + dataSize)
    const view = new DataView(buffer)

    function writeString(offset: number, s: string) {
      for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
    }

    let offset = 0
    writeString(offset, 'RIFF'); offset += 4
    view.setUint32(offset, 36 + dataSize, true); offset += 4
    writeString(offset, 'WAVE'); offset += 4
    writeString(offset, 'fmt '); offset += 4
    view.setUint32(offset, 16, true); offset += 4 // PCM
    view.setUint16(offset, 1, true); offset += 2 // PCM format
    view.setUint16(offset, numChannels, true); offset += 2
    view.setUint32(offset, sampleRate, true); offset += 4
    view.setUint32(offset, sampleRate * blockAlign, true); offset += 4
    view.setUint16(offset, blockAlign, true); offset += 2
    view.setUint16(offset, bytesPerSample * 8, true); offset += 2
    writeString(offset, 'data'); offset += 4
    view.setUint32(offset, dataSize, true); offset += 4

    const channels: Float32Array[] = []
    for (let c = 0; c < numChannels; c++) channels.push(buf.getChannelData(c))

    let idx = 0
    for (let i = 0; i < length; i++) {
      for (let c = 0; c < numChannels; c++) {
        let sample = channels[c][i]
        sample = Math.max(-1, Math.min(1, sample))
        const s = sample < 0 ? sample * 0x8000 : sample * 0x7fff
        view.setInt16(44 + idx, s, true)
        idx += 2
      }
    }
    return new Blob([buffer], { type: 'audio/wav' })
  }

  function isSilentBuffer(buf: AudioBuffer, threshold = 1e-5): boolean {
    const len = buf.length
    const ch = buf.numberOfChannels
    let max = 0
    for (let c = 0; c < ch; c++) {
      const data = buf.getChannelData(c)
      for (let i = 0; i < len; i++) {
        const v = Math.abs(data[i])
        if (v > max) max = v
        if (max > threshold) return false
      }
    }
    return true
  }

  function writeVarLen(n: number): number[] {
    // MIDI variable-length quantity
    let buffer = n & 0x7f
    const out: number[] = []
    while ((n >>= 7)) {
      buffer <<= 8
      buffer |= ((n & 0x7f) | 0x80)
    }
    while (true) {
      out.push(buffer & 0xff)
      if (buffer & 0x80) buffer >>= 8
      else break
    }
    return out
  }

  function buildMidiBlob(): Blob {
    const loopQN = resolveLoopQN()
    const PPQ = 960
    const tempoUsPerQN = Math.round(60000000 / bpm.value)

    type Ev = { tick: number; bytes: number[] }
    const perTrack: Ev[][] = tracks.value.map(() => [])

    // Collect events per track using multi-pattern and noteLength
    tracks.value.forEach((t, i) => {
      if (!t.patterns.length) return
      const ts = t.timeScale || 1
      const nl = t.noteLength || 0.5
      const chainQN = t.patterns.reduce((sum, e) => sum + e.pattern.cycleQN * e.repeats * ts, 0)
      if (chainQN <= 0) return
      for (let chainBase = 0; chainBase < loopQN - 1e-9; chainBase += chainQN) {
        let offsetQN = chainBase
        for (const entry of t.patterns) {
          const pat = entry.pattern
          const patCycleQN = pat.cycleQN * ts
          for (let rep = 0; rep < entry.repeats; rep++) {
            for (let onsetIdx = 0; onsetIdx < pat.onsets.length; onsetIdx++) {
              const onset = pat.onsets[onsetIdx]
              const onsetQN = (onset / pat.spb) * ts
              const atQN = offsetQN + onsetQN
              if (atQN > loopQN + 1e-9) break

              const nextOnsetIdx = (onsetIdx + 1) % pat.onsets.length
              const nextOnset = pat.onsets[nextOnsetIdx]
              let ioiQN: number
              if (nextOnsetIdx > onsetIdx) {
                ioiQN = ((nextOnset - onset) / pat.spb) * ts
              } else {
                ioiQN = ((pat.totalBits - onset + nextOnset) / pat.spb) * ts
              }

              const swungAtQN = applySwingToQN(atQN)
              const swungOffQN = applySwingToQN(atQN + (ioiQN * nl))
              const tick = Math.max(0, Math.round(swungAtQN * PPQ))
              const offTick = Math.max(tick + 1, Math.round(swungOffQN * PPQ))
              const note = Number((t.params as any)?.midiKey ?? defaultMidiKeyForTrackType(t.type))
              const vel = Math.max(1, Math.min(127, Math.round(computeVelocity(t, qnToSeconds(swungAtQN)) * 127)))
              const ch = Math.max(0, Math.min(15, (Number(midiChannel.value) || 1) - 1))
              perTrack[i].push({ tick, bytes: [0x90 | ch, note, vel] })
              perTrack[i].push({ tick: offTick, bytes: [0x80 | ch, note, 0] })
            }
            offsetQN += patCycleQN
            if (offsetQN > loopQN + 1e-9) break
          }
          if (offsetQN > loopQN + 1e-9) break
        }
      }
    })

  // Tempo/meta track (track 0)
  const tempoTrack: number[] = []
  // Track name (correct length)
  const tempoNameBytes = Array.from(new TextEncoder().encode('Tempo'))
  tempoTrack.push(...writeVarLen(0), 0xFF, 0x03, tempoNameBytes.length, ...tempoNameBytes)
  // Tempo (at time 0)
  tempoTrack.push(...writeVarLen(0), 0xFF, 0x51, 0x03, (tempoUsPerQN >> 16) & 0xFF, (tempoUsPerQN >> 8) & 0xFF, tempoUsPerQN & 0xFF)
  // Time signature hint 4/4 (at time 0)
  tempoTrack.push(...writeVarLen(0), 0xFF, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08)
  // End-of-track after loop length
  const loopTicks = Math.max(0, Math.round(loopQN * PPQ))
  tempoTrack.push(...writeVarLen(loopTicks), 0xFF, 0x2F, 0x00)

    function buildTrackChunk(name: string, evs: Ev[]): Uint8Array {
      evs.sort((a, b) => a.tick - b.tick)
      const bytes: number[] = []
      // Track name meta (UTF-8)
      const nameBytes = Array.from(new TextEncoder().encode(name))
      bytes.push(...writeVarLen(0), 0xFF, 0x03, nameBytes.length, ...nameBytes)
      let prev = 0
      for (const e of evs) {
        const dt = e.tick - prev
        prev = e.tick
        bytes.push(...writeVarLen(dt), ...e.bytes)
      }
      bytes.push(...writeVarLen(0), 0xFF, 0x2F, 0x00)
      const header = [
        0x4D, 0x54, 0x72, 0x6B,
        (bytes.length >> 24) & 0xFF,
        (bytes.length >> 16) & 0xFF,
        (bytes.length >> 8) & 0xFF,
        bytes.length & 0xFF
      ]
      return new Uint8Array([...header, ...bytes])
    }

    const header = [
      0x4D, 0x54, 0x68, 0x64,
      0x00, 0x00, 0x00, 0x06,
      0x00, 0x01, // format 1
      0x00, (tracks.value.length + 1), // ntrks = tempo + per-track
      (PPQ >> 8) & 0xFF, PPQ & 0xFF
    ]
    const chunks: Uint8Array[] = []
    // tempo chunk
    const tempoChunkHeader = [
      0x4D, 0x54, 0x72, 0x6B,
      (tempoTrack.length >> 24) & 0xFF,
      (tempoTrack.length >> 16) & 0xFF,
      (tempoTrack.length >> 8) & 0xFF,
      tempoTrack.length & 0xFF
    ]
    chunks.push(new Uint8Array([...tempoChunkHeader, ...tempoTrack]))
    // per sequencer track
    tracks.value.forEach((t, i) => {
      const name = t.name || t.type.toUpperCase()
      chunks.push(buildTrackChunk(name, perTrack[i]))
    })

    const bytes = new Uint8Array([...header, ...chunks.flatMap(c => Array.from(c))])
    return new Blob([bytes], { type: 'audio/midi' })
  }

  async function exportWav() {
    const loopQN = resolveLoopQN()
    const durationSec = qnToSeconds(loopQN)
  const eventsPre = snapshotEvents(loopQN)
  try { console.info('[exportWav] events', eventsPre.length, 'durationSec', durationSec) } catch {}
    const tracksSnapshot = tracks.value.map(t => ({ ...t }))
  const audioBuffer = await Tone.Offline(() => {
      // Absolute-time scheduling without Transport/Parts
      const secondsPerQN = 60 / bpm.value
      const locals = tracksSnapshot.map((t) => {
        const inst = makeInstrument(t.type as TrackType, t.params)
        const vol = Math.max(0, Math.min(1, t.volume))
        const pn = Math.max(-1, Math.min(1, t.pan))
        const gain = new (Tone as any).Gain(vol)
        const pan = new (Tone as any).PanVol(pn, 0)
        // Simple chain inst -> gain -> pan
        ;(inst.node as any).connect(gain)
        gain.connect(pan)
        pan.connect(Tone.getDestination())
        return { inst, type: t.type as TrackType, params: t.params }
      })

      const eps = 1e-4
      for (const ev of eventsPre) {
        const at = Math.min(durationSec, Math.max(0, ev.timeSec + eps))
        const trk = locals[ev.trackIndex]
        if (!trk) continue
        const vel = ev.velocity
        const noteDur = ev.noteDurSec
        // All types now use the unified trigger with duration
        trk.inst.trigger(at, vel, noteDur)
        // Apply velocity-scaled filter envelope for offline too
        try {
          const filterNode: any = (trk.inst as any)?.filter ?? trk.inst.node
          const params: any = trk.params || {}
          const baseHz = Number(params.filterFrequency ?? 20000)
          const amtCtl = Number(params.velToFilter ?? 0) // -1..1
          let envTime = Number(params.filterEnvTime ?? 0.15)
          envTime = Math.max(0.005, Math.min(2.0, envTime))
          const amount = amtCtl * Math.max(0, Math.min(1, vel))
          scheduleFilterEnv(filterNode, baseHz, amount, envTime, at)
        } catch {}
      }
    }, durationSec)
    if (isSilentBuffer(audioBuffer)) {
      // Fallback: record live output using Tone.Recorder for one loop
      try {
        await exportWavLiveFallback(durationSec)
        return
      } catch (e) {
        console.error('Live recording fallback failed', e)
      }
    }
    const wav = encodeWavFromBuffer(audioBuffer)
    const name = `rhythm-navigator_bpm${bpm.value}_bars${resolveLoopBars()}_${formatTimestamp()}.wav`
    downloadBlob(wav, name)
  }

  async function exportWavLiveOnly() {
    const loopQN = resolveLoopQN()
    const durationSec = qnToSeconds(loopQN)
    await exportWavLiveFallback(durationSec)
  }

  async function exportWavLiveFallback(durationSec: number) {
    if (Tone.getContext().state !== 'running') {
      await Tone.start()
    }
  const recorder = new (Tone as any).Recorder()
  // Tap the master chain (not the destination)
  try { (masterLimiter as any).connect(recorder) } catch {}
    await recorder.start()
    const wasPlaying = isPlaying.value
    if (!wasPlaying) {
      // Start normal playback (uses existing schedule)
      await start()
    }
  await new Promise((res) => setTimeout(res, Math.ceil((durationSec + 0.3) * 1000)))
  const recording: Blob = await recorder.stop()
  try { (masterLimiter as any).disconnect(recorder) } catch {}
    if (!wasPlaying) {
      stop()
    }
  // Ensure we output a real WAV
  const arr = await recording.arrayBuffer()
  // Use a temporary AudioContext to decode
  const tempCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  const decoded = await tempCtx.decodeAudioData(arr.slice(0))
  tempCtx.close?.()
  const wav = encodeWavFromBuffer(decoded)
  const name = `rhythm-navigator_bpm${bpm.value}_bars${resolveLoopBars()}_${formatTimestamp()}.wav`
  downloadBlob(wav, name)
  }

  function exportMidi() {
    const blob = buildMidiBlob()
  const name = `rhythm-navigator_bpm${bpm.value}_bars${resolveLoopBars()}_${formatTimestamp()}.mid`
  downloadBlob(blob, name)
  }

  // --- Project save/load (JSON)

  function captureSessionState(): SequencerSessionSnapshot {
    return {
      bpm: bpm.value,
      loopBars: loopBars.value,
      swingPercent: swingPercent.value,
      swingGrid: swingGrid.value,
      midiEnabled: midiEnabled.value,
      midiOutputId: midiOutputId.value,
      midiChannel: midiChannel.value,
      tracks: tracks.value.map((t): SavedTrack => ({
        id: t.id,
        name: t.name,
        type: t.type,
        volume: t.volume,
        pan: t.pan,
        velocity: t.velocity,
        velRandom: t.velRandom,
        timeScale: t.timeScale,
        noteLength: t.noteLength,
        params: { ...(t.params || {}) },
        patterns: t.patterns.map((e): SavedPatternEntry => ({
          mode: e.pattern.mode,
          groupedDigitsString: e.pattern.groupedDigitsString,
          digits: [...e.pattern.digits],
          numerator: e.pattern.numerator,
          denominator: e.pattern.denominator,
          repeats: e.repeats
        }))
      }))
    }
  }

  function createDefaultSessionSnapshot(): SequencerSessionSnapshot {
    return createDefaultSequencerSessionSnapshot()
  }

  function resetToDefaultSession() {
    applySessionState(createDefaultSequencerSessionSnapshot())
  }

  function exportProject() {
    const snapshot = captureSessionState()
    const data = {
      bpm: snapshot.bpm,
      loopBars: snapshot.loopBars,
      swingPercent: snapshot.swingPercent,
      swingGrid: snapshot.swingGrid,
      tracks: snapshot.tracks
    }
    const name = `rhythm-navigator_bpm${bpm.value}_bars${resolveLoopBars()}_${formatTimestamp()}.json`
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), name)
  }

  // Utility to safely set AudioParam/Tone.Signal without throwing in invalid states
  function safeSetParam(param: any, value: number) {
    try {
      const running = (Tone.getContext().state === 'running')
      if (running && typeof param?.setValueAtTime === 'function') {
        param.setValueAtTime(value, Tone.now())
      } else if ('value' in (param ?? {})) {
        param.value = value
      }
    } catch (e) {
      try { if (param && 'value' in param) param.value = value } catch {}
    }
  }

  function rebuildPatternEntry(sp: any): PatternEntry | null {
    if (!sp || !sp.digits || !sp.mode) return null
    const mode = sp.mode as Mode
    const digits = sp.digits as number[]
    const dpb = Math.max(1, Math.floor(sp.denominator ?? 1))
    const bpd = bitsPerDigitForMode(mode)
    const spb = dpb * bpd
    const { onsets, totalBits } = digitsToOnsets(digits, mode)
    const cycleQN = totalBits / spb
    return {
      pattern: {
        mode,
        groupedDigitsString: sp.groupedDigitsString ?? '',
        digits,
        numerator: Math.max(1, Math.floor(sp.numerator ?? 4)),
        denominator: Math.max(1, Math.floor(sp.denominator ?? 1)),
        digitsPerBeat: dpb,
        totalBits,
        spb,
        onsets,
        cycleQN
      },
      repeats: Math.max(1, Math.floor(sp.repeats ?? 1))
    }
  }

  function applySessionState(snapshot: Partial<SequencerSessionSnapshot> | null | undefined) {
    if (!snapshot || !Array.isArray(snapshot.tracks)) return
    if (typeof snapshot.bpm === 'number') bpm.value = Math.max(30, Math.min(300, Math.round(snapshot.bpm)))
    if (typeof snapshot.loopBars === 'number') loopBars.value = Math.max(1, Math.round(snapshot.loopBars))
    if (typeof snapshot.swingPercent === 'number') swingPercent.value = clampSwingPercent(snapshot.swingPercent)
    else swingPercent.value = 0
    swingGrid.value = normalizeSwingGrid(snapshot.swingGrid)
    if (typeof snapshot.midiEnabled === 'boolean') midiEnabled.value = snapshot.midiEnabled
    if (snapshot.midiOutputId === null || typeof snapshot.midiOutputId === 'string') midiOutputId.value = snapshot.midiOutputId ?? null
    if (typeof snapshot.midiChannel === 'number') midiChannel.value = Math.max(1, Math.min(16, Math.floor(snapshot.midiChannel)))

    Object.values(nodes.value).forEach(nb => {
      try { nb.pan.dispose() } catch {}
      try { nb.gain.dispose() } catch {}
      disposeInstrument(nb.inst)
    })
    nodes.value = {}
    nodeSig.clear()

    const nextTracks: Track[] = []
    for (const st of snapshot.tracks) {
      const id = st.id || `t${Math.random().toString(36).slice(2, 8)}`
      const patterns: PatternEntry[] = []
      if (Array.isArray(st.patterns) && st.patterns.length > 0) {
        for (const sp of st.patterns) {
          const entry = rebuildPatternEntry(sp)
          if (entry) patterns.push(entry)
        }
      } else if (st.pattern && st.pattern.digits && st.pattern.mode) {
        const entry = rebuildPatternEntry({ ...st.pattern, repeats: 1 })
        if (entry) patterns.push(entry)
      }
      nextTracks.push({
        id,
        name: st.name ?? defaultTrackName(st.type ?? 'tom'),
        type: st.type ?? 'tom',
        rev: 0,
        volume: Number(st.volume ?? 0.8),
        pan: Number(st.pan ?? 0),
        velocity: Number(st.velocity ?? 0.8),
        velRandom: Number(st.velRandom ?? 0),
        timeScale: Number(st.timeScale) || 1,
        noteLength: Number(st.noteLength) || 0.5,
        params: { ...defaultTrackParams(st.type ?? 'tom'), ...(st.params ?? {}) },
        patterns
      })
    }
    tracks.value = nextTracks
    version.value++
    if (midiEnabled.value) initMidi()
    enqueueAudioSync()
    if (isPlaying.value) rebuildSchedule()
  }

  function importProject(json: string) {
    try {
      const data = JSON.parse(json) as Partial<SequencerSessionSnapshot>
      applySessionState({
        bpm: data.bpm,
        loopBars: data.loopBars,
        swingPercent: data.swingPercent,
        swingGrid: data.swingGrid,
        tracks: Array.isArray(data.tracks) ? data.tracks : []
      })
    } catch (e) {
      console.error('Failed to import project', e)
    }
  }

  // --- Local storage persistence (basic)
  function loadFromStorage() {
    const KEY = 'rn.sequencer'
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return
      const data = JSON.parse(raw)
      applySessionState(data)
    } catch (e) {
      console.warn('[sequencer] failed to load from storage', e)
    }
  }

  function saveToStorage() {
    const KEY = 'rn.sequencer'
    try {
      const data = captureSessionState()
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch (e) {
      console.warn('[sequencer] failed to save to storage', e)
    }
  }

  // subscribe to changes
  watch([bpm, loopBars, swingPercent, swingGrid, tracks], () => {
    saveToStorage()
  }, { deep: true })

  return {
    bpm,
    loopBars,
    swingPercent,
    swingGrid,
    effectiveLoopBars,
    isPlaying,
    tracks,
  midiEnabled,
  midiOutputs,
  midiOutputId,
  midiChannel,
  version,
  addTrack,
  removeTrack,
    start,
    stop,
    setBpm,
    setSwingPercent,
    setSwingGrid,
    setLoopBars,
    setTrackType,
  updateTrackFields,
  updateTrackParam,
  assignRhythmToTrack,
  removePatternFromTrack,
  setPatternRepeats,
  movePatternInTrack,
  updateTrackPatternMeter,
    enableMidiOutput,
    selectMidiOutput,
  updateMidiOutputs,
  // channel control
  setMidiChannel: (n: number) => { midiChannel.value = Math.max(1, Math.min(16, Math.floor(Number(n)||1))); saveToStorage() },
    exportWav,
  exportWavLiveOnly,
  exportMidi,
  exportProject,
  importProject,
  captureSessionState,
  createDefaultSessionSnapshot,
  resetToDefaultSession,
  applySessionState,
  loadFromStorage,
  saveToStorage
  }
})
