<template>
  <div class="flex flex-wrap items-center gap-2 text-xs min-w-[240px]">
    <button class="px-3 py-2 rounded border border-white/10 hover:bg-white/5" @click="onToggle">
      {{ isPlaying ? 'Stop' : 'Play' }}
    </button>
    <label class="flex items-center gap-2 text-sm">
      <span class="text-slate-400">BPM</span>
      <input type="number" class="w-16 bg-slate-800 border border-white/10 rounded px-2 py-1" :value="bpm" @input="onBpm" min="30" max="300" />
    </label>
    <label class="flex items-center gap-2 text-sm">
      <span class="text-slate-400">Loop bars</span>
      <input type="number" class="w-16 bg-slate-800 border border-white/10 rounded px-2 py-1" :value="loopBars" @input="onBars" min="1" max="128" />
    </label>
  <div class="flex flex-wrap items-center gap-2 basis-full sm:basis-auto justify-start">
  <button class="px-2 py-1 rounded border border-white/10 hover:bg-white/5" @click="onExportWav">WAV</button>
      <button class="px-2 py-1 rounded border border-white/10 hover:bg-white/5" @click="onExportMidi">MIDI</button>
      <button class="px-2 py-1 rounded border border-white/10 hover:bg-white/5" @click="onExportProject">Save</button>
      <label class="px-2 py-1 rounded border border-white/10 hover:bg-white/5 cursor-pointer">
        Load JSON
        <input type="file" accept="application/json" class="hidden" @change="onImportProject" />
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useSequencerStore } from '@/stores/sequencerStore'

const seq = useSequencerStore()
const { bpm, loopBars, isPlaying } = storeToRefs(seq)

function onToggle() {
  if (isPlaying.value) seq.stop()
  else seq.start()
}
function onBpm(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  if (!Number.isFinite(v)) return
  seq.setBpm(v)
}
function onBars(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  if (!Number.isFinite(v)) return
  seq.setLoopBars(v)
}

function onExportWav() { (seq as any).exportWav() }
function onExportMidi() { seq.exportMidi() }
function onExportProject() {
  const anySeq: any = seq as any
  if (typeof anySeq.exportProject === 'function') return anySeq.exportProject()
  // Fallback: build JSON here
  const tracks = anySeq.tracks?.value || []
  const data = {
    bpm: bpm.value,
    loopBars: loopBars.value,
    tracks: tracks.map((t: any) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      volume: t.volume,
      pan: t.pan,
      velocity: t.velocity,
      velRandom: t.velRandom,
    }))
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `rhythm-navigator_bpm${bpm.value}_bars${loopBars.value}_${formatTimestamp()}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
}
function onImportProject(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files || !files[0]) return
  const reader = new FileReader()
  reader.onload = () => {
    const text = String(reader.result || '')
    const anySeq: any = seq as any
    if (typeof anySeq.importProject === 'function') return anySeq.importProject(text)
    // Fallback importer
    try {
      const data = JSON.parse(text)
      if (typeof data.bpm === 'number') seq.setBpm(data.bpm)
      if (typeof data.loopBars === 'number') seq.setLoopBars(data.loopBars)
      // remove current tracks
      const ids = (anySeq.tracks?.value || []).map((t: any) => t.id)
      ids.forEach((id: string) => anySeq.removeTrack(id))
      // rebuild tracks
      for (const st of (data.tracks || [])) {
        anySeq.addTrack(st.type, st.name)
        const list = anySeq.tracks.value
        const t = list[list.length - 1]
        if (typeof anySeq.updateTrackFields === 'function') {
          anySeq.updateTrackFields(t.id, {
            volume: st.volume,
            pan: st.pan,
            velocity: st.velocity,
            velRandom: st.velRandom,
            name: st.name
          })
        } else {
          t.volume = st.volume
          t.pan = st.pan
          t.velocity = st.velocity
          t.velRandom = st.velRandom
          t.name = st.name
        }
        if (st.params) {
          if (typeof anySeq.updateTrackParam === 'function') {
            for (const k of Object.keys(st.params)) anySeq.updateTrackParam(t.id, k, st.params[k])
          } else {
            t.params = st.params || {}
          }
        }
        if (st.pattern) {
          anySeq.assignRhythmToTrack(t.id, { base: st.pattern.mode, groupedDigitsString: st.pattern.groupedDigitsString, digits: st.pattern.digits } as any, st.pattern.numerator, st.pattern.denominator)
        }
      }
    } catch (err) {
      console.error('Import failed', err)
    }
  }
  reader.readAsText(files[0])
  ;(e.target as HTMLInputElement).value = ''
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
</script>

<style scoped></style>
