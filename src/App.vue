<template>
  <div class="min-h-screen flex flex-col">
    <header class="sticky top-0 z-30 border-b border-cyan-300/20 bg-slate-950/85 backdrop-blur-xl">
      <div class="mx-auto max-w-7xl px-2 sm:px-4 lg:px-8 py-2 flex flex-wrap items-center gap-2 overflow-x-auto">
        <h1 class="app-title shrink-0 pr-1" :title="`Rhythm Navigator v${appVersion}`">
          Rhythm Navigator <span class="app-version">v{{ appVersion }}</span>
        </h1>

        <div class="glass rounded px-2 sm:px-3 py-2 flex-1 min-w-[260px]">
          <TransportBar />
        </div>

        <ActionMenu label="Tools" icon="🧰" title="Generators and views" align="right">
          <template #default="{ close }">
            <div class="menu-stack">
              <button class="menu-btn" @click="rhythmsOpen = true; close()" title="Open generated rhythms table view">📊 Table view</button>
              <button class="menu-btn" @click="pulsationsOpen = true; close()" title="Open pulsations builder">♩ Pulsations</button>
              <button class="menu-btn" @click="sequenceOpen = true; close()" title="Open rhythm-driven sequence generator">🧬 Sequence generator</button>
              <button class="menu-btn" @click="settingsOpen = true; close()" title="Open generator and filters">⚙️ Generator & filters</button>
              <button class="menu-btn" @click="convolutionOpen = true; close()" title="Open XOR convolver">✳️ XOR convolver</button>
            </div>
          </template>
        </ActionMenu>

        <ActionMenu :label="`Preset: ${activePresetName}`" icon="💽" title="Preset actions" align="right">
          <template #default="{ close }">
            <div class="menu-stack">
              <label class="menu-label">
                Preset name
                <input v-model="newPresetName" type="text" class="menu-input mt-1" placeholder="Named preset" />
              </label>
              <div class="grid grid-cols-2 gap-2">
                <button class="menu-btn menu-btn--center" @click="onCreatePreset">➕ New</button>
                <button class="menu-btn menu-btn--center" :disabled="!activePresetId" @click="onOverwriteActive">♻️ Overwrite</button>
              </div>
              <div class="menu-divider"></div>
              <button class="menu-btn" @click="seq.exportProject(); close()">💾 Save session JSON</button>
              <button class="menu-btn" @click="sessionInput?.click()">📂 Load session JSON</button>
              <button class="menu-btn" @click="presetStore.exportLibrary(); close()">📤 Export preset library</button>
              <button class="menu-btn" @click="libraryInput?.click()">📥 Import preset library</button>
              <div class="menu-divider"></div>
              <div v-if="!presets.length" class="menu-empty">No saved presets.</div>
              <div v-else class="menu-scroll">
                <div v-for="preset in presets" :key="preset.id" class="menu-item-row">
                  <button class="menu-link" @click="presetStore.loadPreset(preset.id); close()">
                    {{ preset.id === activePresetId ? '✅ ' : '' }}{{ preset.name }}
                  </button>
                  <div class="flex items-center gap-1">
                    <button class="menu-icon-btn" title="Overwrite this preset" @click="presetStore.overwritePreset(preset.id, newPresetName || preset.name)">♻️</button>
                    <button class="menu-icon-btn" title="Delete preset" @click="presetStore.deletePreset(preset.id)">🗑</button>
                  </div>
                </div>
              </div>
            </div>
            <input ref="libraryInput" type="file" accept="application/json" class="hidden" @change="onImportLibrary" />
            <input ref="sessionInput" type="file" accept="application/json" class="hidden" @change="onImportSession" />
          </template>
        </ActionMenu>
      </div>
    </header>

    <main class="flex-1">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <DrumTracks class="glass rounded-xl p-6 w-full relative z-10" />
      </div>
    </main>

    <ToastHost />

    <Modal :open="pulsationsOpen" @close="pulsationsOpen = false">
      <template #title><h3 class="text-lg font-semibold">Pulsations</h3></template>
      <PulsationsPanel />
    </Modal>

    <Modal :open="settingsOpen" @close="settingsOpen = false">
      <template #title><h3 class="text-lg font-semibold">Generator & Filters</h3></template>
      <SettingsPanel />
    </Modal>

    <Modal :open="rhythmsOpen" @close="rhythmsOpen = false">
      <template #title>
        <div class="flex items-center gap-3">
          <span class="text-xl">🎵</span>
          <h3 class="text-lg font-semibold">Generated rhythms table</h3>
          <span class="text-xs text-slate-400">Count: {{ items.length }}</span>
        </div>
      </template>
      <RhythmList class="glass rounded-xl p-4" />
    </Modal>

    <ConvolutionModal :open="convolutionOpen" @close="convolutionOpen = false" />
    <SequenceGeneratorModal :open="sequenceOpen" @close="sequenceOpen = false" />

    <footer class="border-t border-cyan-300/20">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 text-xs text-cyan-100/70">
        Built with Vue 3 + TypeScript · PWA enabled
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import SettingsPanel from '@/components/SettingsPanel.vue'
import PulsationsPanel from '@/components/PulsationsPanel.vue'
import RhythmList from '@/components/RhythmList.vue'
import TransportBar from '@/components/TransportBar.vue'
import DrumTracks from '@/components/DrumTracks.vue'
import Modal from '@/components/Modal.vue'
import ToastHost from '@/components/ToastHost.vue'
import ConvolutionModal from '@/components/ConvolutionModal.vue'
import SequenceGeneratorModal from '@/components/SequenceGeneratorModal.vue'
import ActionMenu from '@/components/ActionMenu.vue'
import { storeToRefs } from 'pinia'
import { useRhythmStore } from '@/stores/rhythmStore'
import { computed, ref } from 'vue'
import { usePresetStore } from '@/stores/presetStore'
import { useSequencerStore } from '@/stores/sequencerStore'
import { useUiStore } from '@/stores/uiStore'
import pkg from '../package.json'

const appVersion = pkg.version
const r = useRhythmStore()
const presetStore = usePresetStore()
const seq = useSequencerStore()
const ui = useUiStore()
const { items } = storeToRefs(r)
const { presets, activePresetId } = storeToRefs(presetStore)
const activePresetName = computed(() => presets.value.find((entry) => entry.id === activePresetId.value)?.name ?? 'Unsaved session')
const newPresetName = ref('')

const rhythmsOpen = ref(false)
const settingsOpen = ref(false)
const pulsationsOpen = ref(false)
const convolutionOpen = ref(false)
const sequenceOpen = ref(false)
const libraryInput = ref<HTMLInputElement | null>(null)
const sessionInput = ref<HTMLInputElement | null>(null)

function onCreatePreset() {
  const preset = presetStore.saveCurrentAsPreset(newPresetName.value)
  newPresetName.value = preset.name
}

function onOverwriteActive() {
  if (!activePresetId.value) return
  presetStore.overwritePreset(activePresetId.value, newPresetName.value || activePresetName.value)
}

function onImportLibrary(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const text = String(reader.result || '')
    presetStore.importLibrary(text)
  }
  reader.readAsText(file)
  input.value = ''
}

function onImportSession(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const text = String(reader.result || '')
    try {
      seq.importProject(text)
      ui.pushToast('Session JSON loaded.', 'success')
    } catch {
      ui.pushToast('Failed to load session JSON.', 'error')
    }
  }
  reader.readAsText(file)
  input.value = ''
}
</script>

<style scoped>
.app-title {
  font-family: 'Orbitron', 'Rajdhani', system-ui, sans-serif;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: #e0f2fe;
  text-shadow: 0 0 12px rgba(56, 189, 248, 0.35);
}

.app-version {
  margin-left: 0.2rem;
  font-size: 0.68rem;
  color: #67e8f9;
}

.menu-stack {
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

.menu-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.menu-btn--center {
  text-align: center;
}

.menu-btn:hover:not(:disabled) {
  background: rgba(30, 41, 59, 0.95);
}

.menu-input {
  width: 100%;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 0.45rem;
  background: rgba(15, 23, 42, 0.85);
  color: #e2e8f0;
  padding: 0.35rem 0.5rem;
  font-size: 0.74rem;
}

.menu-label {
  font-size: 0.7rem;
  color: #94a3b8;
}

.menu-divider {
  border-top: 1px solid rgba(148, 163, 184, 0.2);
}

.menu-scroll {
  max-height: 11rem;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
}

.menu-item-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.menu-link {
  flex: 1;
  text-align: left;
  border-radius: 0.4rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(15, 23, 42, 0.7);
  color: #cbd5e1;
  padding: 0.25rem 0.4rem;
  font-size: 0.7rem;
}

.menu-link:hover {
  background: rgba(30, 41, 59, 0.9);
}

.menu-icon-btn {
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 0.35rem;
  padding: 0.17rem 0.3rem;
  font-size: 0.72rem;
}

.menu-empty {
  font-size: 0.72rem;
  color: #64748b;
}
</style>
