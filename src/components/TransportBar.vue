<template>
  <div class="flex flex-wrap items-center gap-2 min-w-[240px]">
    <button class="transport-play-btn" :class="{ 'transport-play-btn--active': isPlaying }" @click="onToggle" :title="isPlaying ? 'Stop playback' : 'Start playback'">
      <span class="text-base" aria-hidden="true">{{ isPlaying ? '⏹' : '▶' }}</span>
      <span>{{ isPlaying ? 'Stop' : 'Play' }}</span>
    </button>

    <label class="flex items-center gap-2 text-sm">
      <span class="text-cyan-200/80 uppercase text-[10px] tracking-wider">BPM</span>
      <input type="number" class="transport-input w-16" :value="bpm" @input="onBpm" min="30" max="300" />
    </label>

    <div class="flex items-center gap-2 text-sm">
      <span class="text-cyan-200/80 uppercase text-[10px] tracking-wider">Swing</span>
      <input type="number" class="transport-input w-14" :value="swingPercent" @input="onSwing" min="0" max="100" />
      <span class="text-cyan-100/70 text-[10px]">%</span>
      <select class="transport-input w-20" :value="swingGrid" @change="onSwingGrid" title="Swing grid">
        <option value="eighth">1/8</option>
        <option value="sixteenth">1/16</option>
      </select>
    </div>

    <div class="transport-pill" title="Automatically computed loop length">
      <span aria-hidden="true">🔁</span>
      <span>{{ effectiveLoopBars }} bar<span v-if="effectiveLoopBars !== 1">s</span></span>
    </div>

    <ActionMenu label="Media" icon="💾" title="Media and MIDI actions" align="right">
      <template #default="{ close }">
        <div class="menu-stack">
          <button class="menu-btn" @click="onExportWav(); close()">🎧 Export WAV</button>
          <button class="menu-btn" @click="onExportMidi(); close()">🎼 Export MIDI</button>
          <label class="menu-row">
            <span class="text-[11px] text-slate-300">MIDI out</span>
            <input type="checkbox" :checked="midiEnabled" @change="onMidiToggle" />
          </label>
          <div v-if="midiEnabled" class="menu-group">
            <label class="menu-label">
              Device
              <select class="transport-input mt-1 w-full" :value="midiOutputId || ''" @change="onMidiDevice">
                <option value="">Select…</option>
                <option v-for="o in midiOutputs" :key="o.id" :value="o.id">{{ o.name }}</option>
              </select>
            </label>
            <label class="menu-label">
              Channel
              <input type="number" min="1" max="16" class="transport-input mt-1 w-full" :value="midiChannel" @input="onMidiChannel" />
            </label>
            <button class="menu-btn" @click="onMidiRescan">🔄 Rescan devices</button>
          </div>
        </div>
      </template>
    </ActionMenu>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useSequencerStore } from '@/stores/sequencerStore'
import ActionMenu from '@/components/ActionMenu.vue'

const seq = useSequencerStore()
const { bpm, swingPercent, swingGrid, isPlaying, midiEnabled, midiOutputs, midiOutputId, midiChannel, effectiveLoopBars } = storeToRefs(seq)

function onToggle() {
  if (isPlaying.value) seq.stop()
  else seq.start()
}

function onBpm(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  if (!Number.isFinite(v)) return
  seq.setBpm(v)
}

function onSwing(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  if (!Number.isFinite(v)) return
  seq.setSwingPercent(v)
}

function onSwingGrid(e: Event) {
  const value = (e.target as HTMLSelectElement).value
  seq.setSwingGrid(value === 'sixteenth' ? 'sixteenth' : 'eighth')
}

function onExportWav() { seq.exportWav() }
function onExportMidi() { seq.exportMidi() }
function onMidiToggle(e: Event) { ;(seq as any).enableMidiOutput?.((e.target as HTMLInputElement).checked) }
function onMidiDevice(e: Event) { ;(seq as any).selectMidiOutput?.((e.target as HTMLSelectElement).value || null) }
function onMidiChannel(e: Event) { ;(seq as any).setMidiChannel?.(Number((e.target as HTMLInputElement).value)) }
function onMidiRescan() { ;(seq as any).updateMidiOutputs?.() }
</script>

<style scoped>
.transport-play-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.75rem;
  border-radius: 0.6rem;
  border: 1px solid rgba(52, 211, 153, 0.5);
  background: linear-gradient(120deg, rgba(4, 120, 87, 0.85), rgba(6, 78, 59, 0.95));
  font-size: 0.76rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #ecfeff;
  box-shadow: 0 0 12px rgba(52, 211, 153, 0.28);
}

.transport-play-btn--active {
  border-color: rgba(248, 113, 113, 0.6);
  background: linear-gradient(120deg, rgba(127, 29, 29, 0.9), rgba(69, 10, 10, 0.95));
  box-shadow: 0 0 12px rgba(248, 113, 113, 0.32);
}

.transport-input {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 0.45rem;
  padding: 0.22rem 0.45rem;
  color: #e2e8f0;
}

.transport-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.34rem 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(125, 211, 252, 0.25);
  font-size: 0.7rem;
  color: #bae6fd;
}

.menu-stack {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.menu-group {
  border-top: 1px solid rgba(148, 163, 184, 0.2);
  padding-top: 0.45rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.menu-btn {
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 0.45rem;
  padding: 0.35rem 0.5rem;
  text-align: left;
  font-size: 0.74rem;
  color: #e2e8f0;
  background: rgba(15, 23, 42, 0.85);
}

.menu-btn:hover {
  background: rgba(30, 41, 59, 0.95);
}

.menu-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.6rem;
}

.menu-label {
  font-size: 0.7rem;
  color: #94a3b8;
}
</style>
