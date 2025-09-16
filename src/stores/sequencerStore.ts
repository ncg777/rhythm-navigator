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
  lfoEnabled: boolean
  lfoFreq: number // Hz (deprecated; kept for backward compatibility)
  lfoRate?: string // musical rate like '1/4', '1/4.', '1/4t', '1/8', '1/8.', '1/8t', '1/16', '1/16.', '1/16t'
  lfoDepth: number // 0..1 depth multiplier
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
  // Simple synth-only drum voices
  switch (type) {
    case 'kick': {
      const synth = new Tone.MembraneSynth({
        octaves: Number(params.octaves ?? 2),
        pitchDecay: Number(params.pitchDecay ?? 0.02),
        envelope: {
          attack: Number(params.envA ?? 0.001),
          decay: Number(params.envD ?? 0.3),
          sustain: Number(params.envS ?? 0.0),
          release: Number(params.envR ?? 0.1)
        }
      })
      return {
        node: synth,
        trigger: (time: number, vel: number) => synth.triggerAttackRelease('C1', '8n', time, vel)
      }
    }
    case 'snare': {
      const noise = new Tone.NoiseSynth({
        noise: { type: String(params.noiseType ?? 'white') as any },
        envelope: {
          attack: Number(params.envA ?? 0.001),
          decay: Number(params.envD ?? 0.2),
          sustain: 0,
          release: Number(params.envR ?? 0.1)
        }
      })
      return {
        node: noise,
        trigger: (time: number, vel: number) => noise.triggerAttackRelease('16n', time, vel)
      }
    }
    case 'hat': {
      const metal = new Tone.MetalSynth({
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
      })
      return {
        node: metal,
        trigger: (time: number, vel: number) => metal.triggerAttackRelease('C5', '32n', time, vel)
      }
    }
    case 'perc':
    default: {
      const pluck = new Tone.PluckSynth({
        dampening: Number(params.dampening ?? 4000),
        resonance: Number(params.resonance ?? 0.7)
      })
      return {
        node: pluck,
        trigger: (time: number, vel: number) => pluck.triggerAttackRelease('C3', '16n', time, vel)
      }
    }
  }
}

export const useSequencerStore = defineStore('sequencer', () => {
  const bpm = ref(120)
  const loopBars = ref(8) // 8 bars @ 4/4 by default
  const isPlaying = ref(false)
  // bump this whenever track structure/pattern associations change
  const version = ref(0)

  // master chain (markRaw to avoid Vue proxying audio nodes)
  const masterLimiter = markRaw(new Tone.Limiter(-1))
  masterLimiter.connect(Tone.getDestination())

  const tracks = ref<Track[]>([])

  type NodeBundle = { inst: ReturnType<typeof makeInstrument>; gain: any; pan: any; filter?: any; lfo?: any }
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

  // Helper: parse musical rate (e.g., '1/8', '1/8.', '1/8t') to Hz at current BPM
  function rateToHz(rate: string, bpmNow: number): number {
    const secondsPerQN = 60 / bpmNow
    const m = rate.match(/^1\/(\d+)([dt])?$/) || rate.match(/^(\d+)([dt])?$/)
    if (!m) return 0
    const num = m[1] ? Number(m[1]) : 1
    const isNoteForm = /^1\//.test(rate)
    let qn = isNoteForm ? (1 / (Number(num) / 4)) : (Number(num))
    const mod = m[2]
    if (mod === 'd') qn *= 1.5
    else if (mod === 't') qn *= 2 / 3
    const durSec = qn * secondsPerQN
    return durSec > 0 ? 1 / durSec : 0
  }

  function syncLfoForTrack(t: Track, nb: NodeBundle) {
    try {
      const want = !!t.lfoEnabled && t.lfoDepth > 0 && ((t.lfoRate && t.lfoRate.length > 0) || t.lfoFreq > 0)
      if (!want) {
        if (nb.lfo) { try { nb.lfo.dispose() } catch {} nb.lfo = undefined }
        if (nb.filter) {
          try { (nb.inst.node as any).disconnect(nb.filter) } catch {}
          try { nb.filter.disconnect(nb.gain) } catch {}
          try { nb.filter.dispose() } catch {}
          nb.filter = undefined
          try { (nb.inst.node as any).connect(nb.gain) } catch {}
        }
        return
      }
      // Ensure filter exists and is in chain inst -> filter -> gain
      if (!nb.filter) {
        nb.filter = new (Tone as any).Filter(1200, 'lowpass')
        try { (nb.inst.node as any).disconnect(nb.gain) } catch {}
        ;(nb.inst.node as any).connect(nb.filter)
        nb.filter.connect(nb.gain)
      }
      // Ensure LFO exists and is connected to filter frequency
      const hz = t.lfoRate ? rateToHz(t.lfoRate, bpm.value) : Math.max(0, Number(t.lfoFreq || 0))
      const depth = Math.max(0, Math.min(1, Number(t.lfoDepth)))
      const base = 800
      const max = base + 3200 * depth
      const min = base
      if (!nb.lfo) {
        nb.lfo = new (Tone as any).LFO({ frequency: hz || '1/8', min, max, type: 'sine', phase: 0 })
        nb.lfo.connect(nb.filter.frequency)
        nb.lfo.start()
      } else {
        try { nb.lfo.frequency.value = hz || nb.lfo.frequency.value } catch {}
        try { nb.lfo.min = min; nb.lfo.max = max } catch {}
      }
    } catch (e) {
      // ignore
    }
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
      lfoEnabled: false,
  lfoFreq: 0.5,
  lfoRate: '1/4',
      lfoDepth: 0.2,
      pattern: null,
      params:
        type === 'kick'
          ? { octaves: 2, pitchDecay: 0.02, envA: 0.001, envD: 0.3, envS: 0, envR: 0.1 }
          : type === 'snare'
          ? { noiseType: 'white', envA: 0.001, envD: 0.2, envR: 0.1 }
          : type === 'hat'
          ? { frequency: 250, harmonicity: 5.1, modulationIndex: 32, resonance: 8000, octaves: 1.5, envA: 0.001, envD: 0.05, envR: 0.02 }
          : { dampening: 4000, resonance: 0.7 }
    }
  tracks.value = tracks.value.concat(t)
    // create nodes only when context is running; otherwise defer to syncNodes on start
    if (Tone.getContext().state === 'running') {
      const inst = markRaw(makeInstrument(t.type, t.params))
      const gain = markRaw(new (Tone as any).Gain(t.volume))
      const pan = markRaw(new (Tone as any).PanVol(t.pan, 0))
      ;(inst.node as any).connect(gain)
      gain.connect(pan)
      pan.connect(masterLimiter)
      const bundle: NodeBundle = { inst, gain, pan }
      syncLfoForTrack(t, bundle)
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
      try { n.lfo?.dispose() } catch {}
      try { n.filter?.dispose() } catch {}
      n.pan.dispose()
      n.gain.dispose()
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
    if (t.lfoEnabled && t.lfoDepth > 0) {
      let lfoHz = t.lfoFreq || 0
      // Musical rate takes precedence if present
      if (t.lfoRate) {
        const secondsPerQN = 60 / bpm.value
        const parseRate = (rate: string): number => {
          // rate like '1/4', '1/4.', '1/4t', '1/8', '1/8.', '1/8t', '1/2', '1', etc.
          const m = rate.match(/^1\/(\d+)([dt])?$/) || rate.match(/^(\d+)([dt])?$/)
          if (!m) return 0
          const num = m[1] ? Number(m[1]) : 1
          const isNoteForm = /^1\//.test(rate)
          // base in quarter notes: 1/4 -> 1 QN; 1/8 -> 0.5 QN; 1/16 -> 0.25 QN
          let qn = isNoteForm ? (1 / (Number(num) / 4)) : (Number(num))
          // Dotted (.) increases by 50%; Triplet (t) reduces to 2/3
          const mod = m[2]
          if (mod === 'd') qn *= 1.5
          else if (mod === 't') qn *= 2 / 3
          const durSec = qn * secondsPerQN
          return durSec > 0 ? 1 / durSec : 0
        }
        lfoHz = parseRate(t.lfoRate)
      }
      if (lfoHz > 0) {
        const lfo = Math.sin(2 * Math.PI * lfoHz * absoluteSeconds) // -1..1
        v = v * (1 + t.lfoDepth * lfo)
      }
    }
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
      safeSetParam(nb.gain.gain, vol)
      safeSetParam(nb.pan.pan, pan)
      // keep LFO/filter synced to track settings
      syncLfoForTrack(t, nb)
    })
  }

  const nodeSig = new Map<string, string>()
  function signatureFor(t: Track): string {
    const p = t.params || {}
    const entries = Object.keys(p).sort().map(k => `${k}=${(p as any)[k]}`)
    return `${t.type}|${entries.join(',')}`
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
        const gain = markRaw(new (Tone as any).Gain(Math.max(0, Math.min(1, t.volume))))
        const pan = markRaw(new (Tone as any).PanVol(Math.max(-1, Math.min(1, t.pan)), 0))
        ;(inst.node as any).connect(gain)
        gain.connect(pan)
        pan.connect(masterLimiter)
        const bundle: NodeBundle = { inst, gain, pan }
        syncLfoForTrack(t, bundle)
        nodes.value[id] = markRaw(bundle)
        nodeSig.set(id, sig)
        return
      }
      if (currentSig !== sig) {
        // replace instrument (keep gain/pan so automation stays stable)
        try { (nodes.value[id].inst.node as any).disconnect?.() } catch {}
        try { (nodes.value[id].inst.node as any).dispose?.() } catch {}
        const inst = markRaw(makeInstrument(t.type, t.params))
        if (nodes.value[id].filter) {
          ;(inst.node as any).connect(nodes.value[id].filter)
        } else {
          ;(inst.node as any).connect(nodes.value[id].gain)
        }
        nodes.value[id].inst = inst as any
        nodeSig.set(id, sig)
      }
      // Ensure LFO chain reflects current track settings
      syncLfoForTrack(t, nodes.value[id])
    })
    // Dispose any stray nodes not in tracks
    Object.keys(nodes.value).forEach(id => {
      if (presentIds.has(id)) return
      const nb = nodes.value[id]
      try { nb.pan.dispose() } catch {}
      try { nb.gain.dispose() } catch {}
      try { nb.lfo?.dispose() } catch {}
      try { nb.filter?.dispose() } catch {}
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
    const nb = nodes.value[t.id]
    if (nb) syncLfoForTrack(t, nb)
      const cycleQN = pat.cycleQN
      if (cycleQN <= 0) return
      for (let base = 0; base < loopQN - 1e-9; base += cycleQN) {
        for (const onset of pat.onsets) {
          const onsetQN = onset / pat.spb
          const atQN = base + onsetQN
          if (atQN > loopQN + 1e-9) break
          const atSec = qnToSeconds(atQN)
          const id = Tone.Transport.schedule((time: number) => {
            const vel = computeVelocity(t, atSec)
            const nb = nodes.value[t.id]
            nb?.inst.trigger(time, vel)
          }, atSec)
          scheduledIds.push(id)
        }
      }
    })
  }

  async function start() {
    if (Tone.getContext().state !== 'running') {
      await Tone.start()
    }
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
  function updateTrackFields(id: string, patch: Partial<Pick<Track, 'name' | 'volume' | 'pan' | 'velocity' | 'velRandom' | 'lfoEnabled' | 'lfoFreq' | 'lfoRate' | 'lfoDepth'>>) {
    let changed = false
    tracks.value = tracks.value.map(t => {
      if (t.id !== id) return t
      const next: Track = { ...t, ...patch }
      // clamp where necessary
      next.volume = Math.max(0, Math.min(1, Number(next.volume)))
      next.pan = Math.max(-1, Math.min(1, Number(next.pan)))
      next.velocity = Math.max(0, Math.min(1, Number(next.velocity)))
      next.velRandom = Math.max(0, Math.min(1, Number(next.velRandom)))
  next.lfoFreq = Math.max(0, Number(next.lfoFreq))
      next.lfoDepth = Math.max(0, Math.min(1, Number(next.lfoDepth)))
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
    // Use provided denominator (digits per beat) from the rhythm block settings
    const dpb = Math.max(1, Math.floor(denominator))
    const bpd = bitsPerDigitForMode(mode)
    const spb = dpb * bpd
    const { onsets, totalBits } = digitsToOnsets(digits, mode)
    const cycleQN = totalBits / spb
    const pattern: Pattern = {
      mode,
      groupedDigitsString: item.groupedDigitsString,
      digits,
      numerator,
      denominator,
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
          const note = midiNoteForType(t.type)
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
        const inst = makeInstrument(t.type, t.params).node as any
        const vol = Math.max(0, Math.min(1, t.volume))
        const pn = Math.max(-1, Math.min(1, t.pan))
        const gain = new (Tone as any).Gain(vol)
        const pan = new (Tone as any).PanVol(pn, 0)
        let filter: any | null = null
        let lfo: any | null = null
        // Default chain
        inst.connect(gain)
        // Optional LFO/filter
        if (t.lfoEnabled && t.lfoDepth > 0 && ((t.lfoRate && t.lfoRate.length > 0) || t.lfoFreq > 0)) {
          filter = new (Tone as any).Filter(1200, 'lowpass')
          try { inst.disconnect(gain) } catch {}
          inst.connect(filter)
          filter.connect(gain)
          const hz = t.lfoRate ? rateToHz(t.lfoRate, bpm.value) : Math.max(0, Number(t.lfoFreq || 0))
          const depth = Math.max(0, Math.min(1, Number(t.lfoDepth)))
          const base = 800
          const max = base + 3200 * depth
          const min = base
          lfo = new (Tone as any).LFO({ frequency: hz || '1/8', min, max, type: 'sine', phase: 0 })
          lfo.connect((filter as any).frequency)
          lfo.start()
        }
        gain.connect(pan)
        pan.connect(Tone.getDestination())
        return { inst, type: t.type as TrackType, filter, lfo }
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
            trk.inst.triggerAttackRelease('C1', 0.5 * secondsPerQN, at, vel)
            break
          case 'snare':
            // NoiseSynth: (dur, time, vel)
            trk.inst.triggerAttackRelease(0.25 * secondsPerQN, at, vel)
            break
          case 'hat':
            // MetalSynth
            trk.inst.triggerAttackRelease('C5', 0.125 * secondsPerQN, at, vel)
            break
          case 'perc':
          default:
            // PluckSynth
            trk.inst.triggerAttackRelease('C3', 0.25 * secondsPerQN, at, vel)
            break
        }
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
    lfoEnabled: boolean
    lfoFreq: number
  lfoRate?: string
    lfoDepth: number
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
        lfoEnabled: t.lfoEnabled,
        lfoFreq: t.lfoFreq,
  lfoRate: t.lfoRate,
        lfoDepth: t.lfoDepth,
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
          lfoEnabled: st.lfoEnabled,
          lfoFreq: st.lfoFreq,
          lfoRate: st.lfoRate,
          lfoDepth: st.lfoDepth,
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
    exportWav,
  exportWavLiveOnly,
  exportMidi,
  exportProject,
  importProject
  }
})
