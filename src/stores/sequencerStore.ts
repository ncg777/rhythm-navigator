import { defineStore } from 'pinia'
import { ref, watch, markRaw, shallowRef } from 'vue'
import * as Tone from 'tone'
import type { Mode, RhythmItem } from '@/utils/rhythm'
import { bitsPerDigitForMode } from '@/utils/rhythm'
import { parseDigitsFromGroupedString } from '@/utils/relations'

export type TrackType = 'kick' | 'snare' | 'hat' | 'perc'

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

type Track = {
  id: string
  name: string
  type: TrackType
  rev: number
  volume: number // 0..1
  pan: number // -1..1
  velocity: number // 0..1 default velocity
  velRandom: number // 0..1 randomization extent
  pattern: Pattern | null
  // synth parameters per type (simple flat bag to avoid complex unions)
  params: Record<string, number | string>
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
  // Support legacy key 'distortionGain' for older projects
  // Clamp pre-gain to a safe range [-60, 120] dB
  const preDb = Math.max(-60, Math.min(120, Number((params as any).distortionInputGain ?? (params as any).distortionGain ?? 0)))
  const inputGain = markRaw(new Tone.Gain(Tone.dbToGain(preDb)));
  const distortion = markRaw(new Tone.Distortion(1)); // Fixed distortion curve strength
  const filter = markRaw(new Tone.Filter({
    frequency: Number(params.filterFrequency ?? 20000),
    type: String(params.filterType ?? 'lowpass') as BiquadFilterType,
    Q: Number(params.filterResonance ?? 1),
    rolloff: Number(params.filterRolloff ?? -12) as any, // Tone supports -12,-24,-48,-96
  }));

  // Smoothly ramp filter params
  try { filter.frequency.rampTo(Number(params.filterFrequency ?? 20000), 0.1) } catch {}
  try { filter.Q.rampTo(Number(params.filterResonance ?? 1), 0.1) } catch {}
  try { (filter as any).rolloff = Number(params.filterRolloff ?? -12) } catch {}

  // Connect inputGain -> distortion -> filter
  inputGain.connect(distortion);
  distortion.connect(filter);
  // Post-filter VCA to enforce per-hit velocity scaling after heavy drive
  const postVca = markRaw(new Tone.Gain(1));
  ;(filter as any).connect(postVca)

  // Build synth voice and route to: voice -> inputGain -> distortion -> filter (return filter as node)
  switch (type) {
    case 'kick': {
      const synth = markRaw(new Tone.MembraneSynth({
        octaves: Number(params.octaves ?? 2),
        pitchDecay: Number(params.pitchDecay ?? 0.02),
        envelope: {
          attack: Number(params.envA ?? 0.01),
          decay: Number(params.envD ?? 0.3),
          sustain: Number(params.envS ?? 0.0),
          release: Number(params.envR ?? 0.1)
        }
      }));
      synth.connect(inputGain); // Route synth to inputGain
      return {
        node: postVca,
        filter,
        voice: synth,
        preGain: inputGain,
        hitVca: postVca,
        trigger: (time: number, vel: number) => {
          // Use velocity provided by scheduler (already includes any track-level randomization)
          // Schedule post-VCA scaling so velocity is audible even after distortion/limiting
          try {
            const g: any = (postVca as any).gain
            const dur = Number(params.envD ?? 0.3) + Number(params.envR ?? 0.1) + 0.02
            g.cancelScheduledValues?.(time)
            g.setValueAtTime?.(Math.max(0, Math.min(1, vel)), time)
            g.linearRampToValueAtTime?.(1, time + Math.max(0.03, dur))
          } catch {}
          synth.triggerAttackRelease('C1', '8n', time, vel)
        }
      }
    }
    case 'snare': {
      // Map extended noise types to base Tone.Noise types (white, pink, brown)
      const nt = String(params.noiseType ?? 'white')
      const baseNoiseType = (nt === 'pink' || nt === 'brown') ? (nt as any) : 'white'

      const noise = markRaw(new Tone.NoiseSynth({
        noise: { type: baseNoiseType },
        envelope: {
          attack: Number(params.envA ?? 0.001),
          decay: Number(params.envD ?? 0.2),
          sustain: 0,
          release: Number(params.envR ?? 0.1)
        }
      }));

  // Amplitude modulation via LFO driving a VCA (placed POST-distortion for clear effect)
  const modFreq = Number(params.noiseAmpModFreq ?? 20)
  const modDepth = Math.max(0, Math.min(1, Number(params.noiseAmpModDepth ?? 1)))
  const modOn = Number(params.noiseAmpModOn ?? 0) ? 1 : 0
  const ampVca = markRaw(new Tone.Gain(1))
  const lfo = markRaw(new Tone.LFO({ type: 'square', frequency: modFreq, min: modOn ? (1 - modDepth) : 1, max: 1 }).start())

      // Coloration filter to simulate extended noise types (blue, violet, grey, bandpass)
      const color = markRaw(new (Tone as any).Filter({ type: 'allpass', frequency: 20000, Q: 0.707 }))

  // Chain: noise -> color -> inputGain -> distortion -> ampVca -> filter -> postVca
  noise.connect(color)
  ;(color as any).connect(inputGain)
  try { (distortion as any).disconnect?.() } catch {}
  ;(distortion as any).connect(ampVca)
  ;(ampVca as any).connect(filter)
  // Attach shared post-VCA after the filter to keep velocity audible
  ;(filter as any).connect(postVca)

      const modSettings = { on: !!modOn, freq: modFreq, depth: modDepth, duration: Number(params.envD ?? 0.2) + Number(params.envR ?? 0.1) + 0.05 }
      return {
        node: postVca,
        filter,
        voice: noise,
        ampVca,
        lfo,
        modSettings,
        color,
        preGain: inputGain,
        hitVca: postVca,
        trigger: (time: number, vel: number) => {
          try { (lfo as any).phase = 0 } catch {}
          // Per-hit burst gating for clear audible modulation
          try {
            const ms: any = ({} as any);
            ms.on = (modSettings as any).on; ms.freq = (modSettings as any).freq; ms.depth = (modSettings as any).depth; ms.duration = (modSettings as any).duration;
            const g: any = (ampVca as any).gain
            g.cancelScheduledValues?.(time)
            g.setValueAtTime?.(1, time)
            if (ms.on && ms.depth > 0 && ms.freq > 0) {
              const period = 1 / ms.freq
              const total = Math.max(0.05, Number(ms.duration) || 0.2)
              const pulses = Math.max(1, Math.min(12, Math.ceil(total / period)))
              const low = Math.max(0, 1 - ms.depth)
              for (let i = 0; i < pulses; i++) {
                const t1 = time + i * period + period * 0.5
                const t2 = time + (i + 1) * period
                g.setValueAtTime?.(low, t1)
                g.setValueAtTime?.(1, t2)
              }
              g.setValueAtTime?.(1, time + pulses * period + 0.001)
            }
          } catch {}
          // Post-VCA velocity scaling envelope
          try {
            const g2: any = (postVca as any).gain
            const ms: any = ({} as any)
            ms.duration = Number((modSettings as any).duration ?? (Number(params.envD ?? 0.2) + Number(params.envR ?? 0.1) + 0.05))
            g2.cancelScheduledValues?.(time)
            g2.setValueAtTime?.(Math.max(0, Math.min(1, vel)), time)
            g2.linearRampToValueAtTime?.(1, time + Math.max(0.03, ms.duration))
          } catch {}
          noise.triggerAttackRelease('16n', time, vel)
        }
      }
    }
    case 'hat': {
      const metal = markRaw(new Tone.MetalSynth({
        frequency: Number(params.frequency ?? 250),
        envelope: {
          attack: Number(params.envA ?? 0.001),
          decay: Number(params.envD ?? 0.05),
          release: Number(params.envR ?? 0.02)
        },
        harmonicity: Number(params.harmonicity ?? 5.1),
        modulationIndex: Number(params.modulationIndex ?? 32),
        resonance: Number(params.resonance ?? 8000),
        octaves: Number(params.octaves ?? 1.5)
      }));
      metal.connect(inputGain); // Route metal synth to inputGain
      return {
        node: postVca,
        filter,
        voice: metal,
        preGain: inputGain,
        hitVca: postVca,
        trigger: (time: number, vel: number) => {
          try {
            const g: any = (postVca as any).gain
            const dur = Number(params.envD ?? 0.05) + Number(params.envR ?? 0.02) + 0.02
            g.cancelScheduledValues?.(time)
            g.setValueAtTime?.(Math.max(0, Math.min(1, vel)), time)
            g.linearRampToValueAtTime?.(1, time + Math.max(0.02, dur))
          } catch {}
          metal.triggerAttackRelease('C5', '32n', time, vel)
        }
      }
    }
    case 'perc':
    default: {
      const pluck = markRaw(new Tone.PluckSynth({
        dampening: Number(params.dampening ?? 4000),
        resonance: Number(params.resonance ?? 0.7)
      }));
      pluck.connect(inputGain); // Route pluck to inputGain
      return {
        node: postVca,
        filter,
        voice: pluck,
        preGain: inputGain,
        hitVca: postVca,
        trigger: (time: number, vel: number) => {
          try {
            const g: any = (postVca as any).gain
            const dur = 0.2
            g.cancelScheduledValues?.(time)
            g.setValueAtTime?.(Math.max(0, Math.min(1, vel)), time)
            g.linearRampToValueAtTime?.(1, time + Math.max(0.03, dur))
          } catch {}
          pluck.triggerAttackRelease('C3', '16n', time, vel)
        }
      }
    }
  }
}

// Define the master limiter at the top level
const masterLimiter = markRaw(new Tone.Limiter(-1));
masterLimiter.connect(Tone.getDestination());

export const useSequencerStore = defineStore('sequencer', () => {
  const bpm = ref(60)
  const loopBars = ref(1) // 8 bars @ 4/4 by default
  const isPlaying = ref(false)
  // bump this whenever track structure/pattern associations change
  const version = ref(0)

  const tracks = ref<Track[]>([])

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



  function addTrack(type: TrackType = 'kick', name?: string) {
    const id = `t${Math.random().toString(36).slice(2, 8)}`
    const t: Track = {
      id,
      name: name || (type === 'kick' ? 'Kick' : type === 'snare' ? 'Snare' : type === 'hat' ? 'Hat' : 'Perc'),
      type,
  rev: 0,
      volume: 0.8,
      pan: 0,
      velocity: 0.8,
      velRandom: 0,
      pattern: null,
      params: {
        filterType: 'lowpass',
        filterFrequency: 20000,
        filterResonance: 1,
        filterRolloff: -12,
        // Velocity → filter envelope modulation
        velToFilter: 0,
        filterEnvTime: 0.15,
        distortionInputGain: 0,
        midiKey: (type === 'kick' ? 36 : type === 'snare' ? 38 : type === 'hat' ? 42 : 39),
        ...(type === 'kick'
          ? { octaves: 2, pitchDecay: 0.02, envA: 0.001, envD: 0.3, envS: 0, envR: 0.1 }
      : type === 'snare'
      ? { noiseType: 'white', envA: 0.001, envD: 0.2, envR: 0.1,
        // extended noise coloring + clap-like tremolo
        noiseAmpModOn: 0, noiseAmpModFreq: 20, noiseAmpModDepth: 1,
        noiseBandFreq: 1500, noiseBandQ: 3 }
          : type === 'hat'
          ? { frequency: 250, harmonicity: 5.1, modulationIndex: 32, resonance: 8000, octaves: 1.5, envA: 0.001, envD: 0.05, envR: 0.02 }
          : { dampening: 4000, resonance: 0.7 })
      }
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
      nodes.value[id] = markRaw(bundle)
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
  ;(n.inst as any)?.tremolo?.dispose?.()
  ;(n.inst as any)?.lfo?.dispose?.()
  ;(n.inst as any)?.ampVca?.dispose?.()
      ;(n.inst as any)?.color?.dispose?.()
      ;(n.inst.node as any).dispose?.()
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
  addTrack('perc', 'Perc')

  // scheduled event IDs for clearing on rebuild
  let scheduledIds: number[] = []

  function qnToSeconds(qn: number): number {
    return (60 / bpm.value) * qn
  }

  function computeVelocity(t: Track, absoluteSeconds: number): number {
    let v = t.velocity
    if (t.velRandom > 0) {
      const r = (Math.random() * 2 - 1) * t.velRandom
      v = v * (1 + r)
    }
    return Math.max(0, Math.min(1, v))
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
      try { if ('type' in filter) filter.type = String((t.params as any)?.filterType ?? 'lowpass') } catch {}
      try { if ('rolloff' in filter) filter.rolloff = Number((t.params as any)?.filterRolloff ?? -12) } catch {}

      // Live instrument-specific param updates
      const voice: any = (nb.inst as any)?.voice
      if (voice && typeof voice.set === 'function') {
        try {
          switch (t.type) {
            case 'kick':
              voice.set({
                octaves: Number((t.params as any)?.octaves ?? 2),
                pitchDecay: Number((t.params as any)?.pitchDecay ?? 0.02),
                envelope: {
                  attack: Number((t.params as any)?.envA ?? 0.01),
                  decay: Number((t.params as any)?.envD ?? 0.3),
                  sustain: Number((t.params as any)?.envS ?? 0.0),
                  release: Number((t.params as any)?.envR ?? 0.1)
                }
              })
              break
            case 'snare':
              // Base noise type update (only white/pink/brown are native)
              voice.set({
                noise: { type: ['white','pink','brown'].includes(String((t.params as any)?.noiseType ?? 'white'))
                  ? String((t.params as any)?.noiseType ?? 'white')
                  : 'white' },
                envelope: {
                  attack: Number((t.params as any)?.envA ?? 0.001),
                  decay: Number((t.params as any)?.envD ?? 0.2),
                  sustain: 0,
                  release: Number((t.params as any)?.envR ?? 0.1)
                }
              })
              // Tremolo (implemented via LFO + VCA) controls for clap-like textures
              try {
                const lfo: any = (nb.inst as any)?.lfo
                const vca: any = (nb.inst as any)?.ampVca
                const ms: any = (nb.inst as any)?.modSettings
                if (lfo && vca) {
                  const f = Number((t.params as any)?.noiseAmpModFreq ?? 20)
                  const d = Math.max(0, Math.min(1, Number((t.params as any)?.noiseAmpModDepth ?? 1)))
                  const on = Number((t.params as any)?.noiseAmpModOn ?? 0) ? 1 : 0
                  if (lfo.frequency?.value != null) smoothSetParam(lfo.frequency, f)
                  // Map depth/on to LFO min/max targeting the VCA gain
                  const min = on ? (1 - d) : 1
                  try { if (typeof lfo.set === 'function') lfo.set({ type: 'square', min, max: 1 }) } catch {}
                  if (lfo.min != null) lfo.min = min
                  if (lfo.max != null) lfo.max = 1
                  // Ensure the VCA base gain is 0 so LFO fully controls amplitude
                  if (vca.gain?.value != null && vca.gain.value < 0) vca.gain.value = 0
                  // Update modSettings for per-hit pulse scheduling
                  if (ms) {
                    ms.on = !!on; ms.freq = f; ms.depth = d; ms.duration = Number((t.params as any)?.envD ?? 0.2) + Number((t.params as any)?.envR ?? 0.1) + 0.05
                  }
                }
              } catch {}
              // Coloration filter to emulate extended noise colors
              try {
                const color: any = (nb.inst as any)?.color
                if (color) {
                  const nt = String((t.params as any)?.noiseType ?? 'white')
                  // Simple approximations:
                  // - blue/violet: high-shelf boosts highs; implement as highpass with higher freq and Q
                  // - grey: EQ flatter perceived loudness -> use peaking at mid freqs
                  // - band: bandpass around specified frequency
                  switch (nt) {
                    case 'blue':
                      color.type = 'highpass'; color.frequency.value = 3000; color.Q.value = 0.5; break
                    case 'violet':
                      color.type = 'highpass'; color.frequency.value = 6000; color.Q.value = 0.7; break
                    case 'grey':
                      color.type = 'peaking'; color.frequency.value = 1000; color.Q.value = 1; if (color.gain) color.gain.value = 3; break
                    case 'band':
                      color.type = 'bandpass'; color.frequency.value = Number((t.params as any)?.noiseBandFreq ?? 1500); color.Q.value = Number((t.params as any)?.noiseBandQ ?? 3); break
                    case 'pink':
                    case 'brown':
                    case 'white':
                    default:
                      color.type = 'allpass'; color.frequency.value = 20000; color.Q.value = 0.707; break
                  }
                }
              } catch {}
              break
            case 'hat':
              voice.set({
                frequency: Number((t.params as any)?.frequency ?? 250),
                harmonicity: Number((t.params as any)?.harmonicity ?? 5.1),
                modulationIndex: Number((t.params as any)?.modulationIndex ?? 32),
                resonance: Number((t.params as any)?.resonance ?? 8000),
                octaves: Number((t.params as any)?.octaves ?? 1.5),
                envelope: {
                  attack: Number((t.params as any)?.envA ?? 0.001),
                  decay: Number((t.params as any)?.envD ?? 0.05),
                  release: Number((t.params as any)?.envR ?? 0.02)
                }
              })
              break
            case 'perc':
            default:
              voice.set({
                dampening: Number((t.params as any)?.dampening ?? 4000),
                resonance: Number((t.params as any)?.resonance ?? 0.7)
              })
              break
          }
        } catch {}
      }
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
        try { (nodes.value[id].inst.node as any).dispose?.() } catch {}
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
      try { (nb.inst.node as any).dispose?.() } catch {}
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
    // If not running, skip scheduling entirely; start() will rebuild when Transport starts
    if (!running) {
      Tone.Transport.bpm.value = bpm.value
      return
    }
  // Context running: set BPM and schedule
  Tone.Transport.bpm.value = bpm.value
    const loopQN = Math.max(1, Math.floor(loopBars.value) * 4)
    Tone.Transport.loop = true
    Tone.Transport.loopStart = 0
    Tone.Transport.loopEnd = qnToSeconds(loopQN)

  tracks.value.forEach((t) => {
      const pat = t.pattern
      if (!pat) return
      const cycleQN = pat.cycleQN
      if (cycleQN <= 0) return
      for (let base = 0; base < loopQN - 1e-9; base += cycleQN) {
        for (const onset of pat.onsets) {
          const onsetQN = onset / pat.spb
          const atQN = base + onsetQN
          if (atQN > loopQN + 1e-9) break
          const atSec = qnToSeconds(atQN)
          const trackId = t.id
          const id = Tone.Transport.schedule((time: number) => {
            // Resolve latest track state at callback time so velocity/velRandom changes are live
            const tLatest = tracks.value.find(x => x.id === trackId) || t
            const vel = computeVelocity(tLatest, atSec)
            const nb = nodes.value[trackId]
            nb?.inst.trigger(time, vel)
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
    rebuildSchedule()
    Tone.Transport.start()
    isPlaying.value = true
  }

  function stop() {
    if (Tone.getContext().state === 'running') {
      Tone.Transport.stop()
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

  function setLoopBars(v: number) {
    loopBars.value = Math.max(1, Math.round(v))
    if (isPlaying.value) rebuildSchedule()
  }

  function setTrackType(id: string, type: TrackType) {
    let changed = false
    tracks.value = tracks.value.map(t => {
      if (t.id !== id) return t
      changed = true
      return { ...t, type, rev: t.rev + 1 }
    })
    if (!changed) return
  // will be recreated on next syncNodes (signature change)
  enqueueAudioSync()
  version.value++
  }

  // Immutable updates for mix fields to avoid deep in-place mutations
  function updateTrackFields(id: string, patch: Partial<Pick<Track, 'name' | 'volume' | 'pan' | 'velocity' | 'velRandom'>>) {
    let changed = false
    tracks.value = tracks.value.map(t => {
      if (t.id !== id) return t
      const next: Track = { ...t, ...patch }
      // clamp where necessary
      next.volume = Math.max(0, Math.min(1, Number(next.volume)))
      next.pan = Math.max(-1, Math.min(1, Number(next.pan)))
      next.velocity = Math.max(0, Math.min(1, Number(next.velocity)))
      next.velRandom = Math.max(0, Math.min(1, Number(next.velRandom)))
      changed = true
      return next
    })
    if (changed) {
      version.value++
      enqueueAudioSync()
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
  // set new pattern and force shallow copy to ensure reactivity in all consumers
  // Immutable update of the track to ensure change detection
  tracks.value = tracks.value.map((t, i) => i === idx ? { ...t, pattern, rev: t.rev + 1 } : t)
  version.value++
    if (isPlaying.value) rebuildSchedule()
  }

  // Update the assigned pattern's meter (numerator/denominator) per track
  function updateTrackPatternMeter(id: string, numerator: number, denominator: number) {
    const idx = tracks.value.findIndex((x) => x.id === id)
    if (idx < 0) return
    const t = tracks.value[idx]
    if (!t.pattern) return
    const num = Math.max(1, Math.floor(Number(numerator)))
    const den = Math.max(1, Math.floor(Number(denominator)))
    const mode = t.pattern.mode
    const bpd = bitsPerDigitForMode(mode)
    const dpb = den
    const spb = dpb * bpd
    const totalBits = t.pattern.digits.length * bpd
    const cycleQN = totalBits / spb
    const nextPattern: Pattern = {
      ...t.pattern,
      numerator: num,
      denominator: den,
      digitsPerBeat: dpb,
      spb,
      totalBits, // redundant but keep consistent
      cycleQN
    }
    tracks.value = tracks.value.map((tr) => (tr.id === id ? { ...tr, pattern: nextPattern, rev: tr.rev + 1 } : tr))
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
  function snapshotEvents(loopQN: number): { timeQN: number; timeSec: number; trackIndex: number; velocity: number }[] {
    const events: { timeQN: number; timeSec: number; trackIndex: number; velocity: number }[] = []
    tracks.value.forEach((t, i) => {
      const pat = t.pattern
      if (!pat) return
      const cycleQN = pat.cycleQN
      if (cycleQN <= 0) return
      for (let base = 0; base < loopQN - 1e-9; base += cycleQN) {
        for (const onset of pat.onsets) {
          const onsetQN = onset / pat.spb
          const atQN = base + onsetQN
          if (atQN > loopQN + 1e-9) break
          const atSec = qnToSeconds(atQN)
          const vel = computeVelocity(t, atSec)
          events.push({ timeQN: atQN, timeSec: atSec, trackIndex: i, velocity: vel })
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

  function midiNoteForType(type: TrackType): number {
    switch (type) {
      case 'kick': return 36 // C1
      case 'snare': return 38 // D1
      case 'hat': return 42 // F#1 (closed hat)
      case 'perc':
      default: return 39 // D#1 (hand clap as placeholder)
    }
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
    const loopQN = Math.max(1, Math.floor(loopBars.value) * 4)
    const PPQ = 960
    const tempoUsPerQN = Math.round(60000000 / bpm.value)

    type Ev = { tick: number; bytes: number[] }
    const perTrack: Ev[][] = tracks.value.map(() => [])

    const noteLenTicks = Math.max(30, Math.floor(PPQ / 8))
    // Collect events per track
    tracks.value.forEach((t, i) => {
      const pat = t.pattern
      if (!pat) return
      for (let base = 0; base < loopQN - 1e-9; base += pat.cycleQN) {
        for (const onset of pat.onsets) {
          const onsetQN = onset / pat.spb
          const atQN = base + onsetQN
          if (atQN > loopQN + 1e-9) break
          const tick = Math.round(atQN * PPQ)
          const note = Number((t.params as any)?.midiKey ?? midiNoteForType(t.type))
          const vel = Math.max(1, Math.min(127, Math.round(t.velocity * 127)))
          perTrack[i].push({ tick, bytes: [0x90 | 0x09, note, vel] })
          perTrack[i].push({ tick: tick + noteLenTicks, bytes: [0x80 | 0x09, note, 0] })
        }
      }
    })

    // Tempo/meta track (track 0)
    const tempoTrack: number[] = []
    // Track name
    tempoTrack.push(...writeVarLen(0), 0xFF, 0x03, 0x06, ...Array.from(new TextEncoder().encode('Tempo')))
    // Tempo
    tempoTrack.push(...writeVarLen(0), 0xFF, 0x51, 0x03, (tempoUsPerQN >> 16) & 0xFF, (tempoUsPerQN >> 8) & 0xFF, tempoUsPerQN & 0xFF)
    // Time signature hint 4/4
    tempoTrack.push(...writeVarLen(0), 0xFF, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08)
    // End
    tempoTrack.push(...writeVarLen(0), 0xFF, 0x2F, 0x00)

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
    const loopQN = Math.max(1, Math.floor(loopBars.value) * 4)
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
        switch (trk.type) {
          case 'kick':
            // MembraneSynth: (note, dur, time, vel)
            trk.inst.trigger(at, vel)
            break
          case 'snare':
            // NoiseSynth: (dur, time, vel)
            trk.inst.trigger(at, vel)
            break
          case 'hat':
            // MetalSynth
            trk.inst.trigger(at, vel)
            break
          case 'perc':
          default:
            // PluckSynth
            trk.inst.trigger(at, vel)
            break
        }
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
    const name = `rhythm-navigator_bpm${bpm.value}_bars${loopBars.value}_${formatTimestamp()}.wav`
    downloadBlob(wav, name)
  }

  async function exportWavLiveOnly() {
    const loopQN = Math.max(1, Math.floor(loopBars.value) * 4)
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
  const name = `rhythm-navigator_bpm${bpm.value}_bars${loopBars.value}_${formatTimestamp()}.wav`
  downloadBlob(wav, name)
  }

  function exportMidi() {
    const blob = buildMidiBlob()
  const name = `rhythm-navigator_bpm${bpm.value}_bars${loopBars.value}_${formatTimestamp()}.mid`
  downloadBlob(blob, name)
  }

  // --- Project save/load (JSON)
  type SavedPattern = Omit<Pattern, 'onsets' | 'totalBits' | 'spb' | 'cycleQN'> & { digits: number[] }
  type SavedTrack = {
    id: string
    name: string
    type: TrackType
    volume: number
    pan: number
    velocity: number
    velRandom: number
    params: Record<string, number | string>
    pattern: null | {
      mode: Mode
      groupedDigitsString: string
      digits: number[]
      numerator: number
      denominator: number
    }
  }
  type Project = {
    bpm: number
    loopBars: number
    tracks: SavedTrack[]
  }

  function exportProject() {
    const data: Project = {
      bpm: bpm.value,
      loopBars: loopBars.value,
      tracks: tracks.value.map(t => ({
        id: t.id,
        name: t.name,
        type: t.type,
        volume: t.volume,
        pan: t.pan,
        velocity: t.velocity,
        velRandom: t.velRandom,
        params: t.params,
        pattern: t.pattern ? {
          mode: t.pattern.mode,
          groupedDigitsString: t.pattern.groupedDigitsString,
          digits: t.pattern.digits,
          numerator: t.pattern.numerator,
          denominator: t.pattern.denominator
        } : null
      }))
    }
    const name = `rhythm-navigator_bpm${bpm.value}_bars${loopBars.value}_${formatTimestamp()}.json`
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

  function importProject(json: string) {
    try {
      const data = JSON.parse(json) as Project
      bpm.value = data.bpm
      loopBars.value = data.loopBars
      // Rebuild tracks and nodes
      // Dispose existing
      Object.values(nodes.value).forEach(nb => {
        nb.pan.dispose()
        nb.gain.dispose()
        ;(nb.inst.node as any).dispose?.()
      })
      nodes.value = {}
      nodeSig.clear()
      tracks.value = []
      data.tracks.forEach(st => {
        const id = st.id || `t${Math.random().toString(36).slice(2, 8)}`
        const t: Track = {
          id,
          name: st.name,
          type: st.type,
          rev: 0,
          volume: st.volume,
          pan: st.pan,
          velocity: st.velocity,
          velRandom: st.velRandom,
          params: st.params,
          pattern: null
        }
        // Recompute pattern timing if present
        if (st.pattern) {
          const mode = st.pattern.mode
          const digits = st.pattern.digits
          const dpb = Math.max(1, Math.floor(st.pattern.denominator))
          const bpd = bitsPerDigitForMode(mode)
          const spb = dpb * bpd
          const { onsets, totalBits } = digitsToOnsets(digits, mode)
          const cycleQN = totalBits / spb
          t.pattern = {
            mode,
            groupedDigitsString: st.pattern.groupedDigitsString,
            digits,
            numerator: st.pattern.numerator,
            denominator: st.pattern.denominator,
            digitsPerBeat: dpb,
            totalBits,
            spb,
            onsets,
            cycleQN
          }
        }
        tracks.value = tracks.value.concat(t)
      })
      version.value++
      if (isPlaying.value) rebuildSchedule()
    } catch (e) {
      console.error('Failed to import project', e)
    }
  }

  return {
    bpm,
    loopBars,
    isPlaying,
    tracks,
  version,
  addTrack,
  removeTrack,
    start,
    stop,
    setBpm,
    setLoopBars,
    setTrackType,
  updateTrackFields,
  updateTrackParam,
  assignRhythmToTrack,
  updateTrackPatternMeter,
    exportWav,
  exportWavLiveOnly,
  exportMidi,
  exportProject,
  importProject
  }
})
