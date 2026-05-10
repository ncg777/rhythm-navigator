import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useRhythmStore } from '@/stores/rhythmStore'
import { useSequencerStore } from '@/stores/sequencerStore'
import { useUiStore } from '@/stores/uiStore'
import {
  buildPresetLibrary,
  normalizePresetName,
  parsePresetLibraryJson,
  type SessionPreset
} from '@/utils/presetLibrary'

const STORAGE_KEY = 'rn.presets'

function makePresetId() {
  return `preset:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`
}

function formatTimestamp(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

function downloadJson(text: string, filename: string) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export const usePresetStore = defineStore('presets', () => {
  const presets = ref<SessionPreset[]>([])
  const activePresetId = ref('')

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPresetLibrary(presets.value)))
  }

  function initPersistence() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const library = parsePresetLibraryJson(raw)
      presets.value = library.presets
      if (activePresetId.value && !presets.value.some((preset) => preset.id === activePresetId.value)) {
        activePresetId.value = ''
      }
    } catch (error) {
      console.warn('[presetStore] failed to load preset library', error)
    }
  }

  function saveCurrentAsPreset(name: string) {
    const rhythm = useRhythmStore()
    const sequencer = useSequencerStore()
    const ui = useUiStore()
    const now = Date.now()
    const preset: SessionPreset = {
      id: makePresetId(),
      name: normalizePresetName(name),
      createdAt: now,
      updatedAt: now,
      rhythm: rhythm.captureSessionState(),
      sequencer: sequencer.captureSessionState()
    }
    presets.value = [preset, ...presets.value]
    activePresetId.value = preset.id
    persist()
    ui.pushToast(`Saved preset "${preset.name}".`, 'success')
    return preset
  }

  function loadPreset(id: string) {
    const preset = presets.value.find((entry) => entry.id === id)
    if (!preset) return false
    useRhythmStore().applySessionState(preset.rhythm)
    useSequencerStore().applySessionState(preset.sequencer)
    activePresetId.value = preset.id
    useUiStore().pushToast(`Loaded preset "${preset.name}".`, 'success')
    return true
  }

  function renamePreset(id: string, name: string) {
    const nextName = normalizePresetName(name)
    let changed = false
    const now = Date.now()
    presets.value = presets.value.map((preset) => {
      if (preset.id !== id) return preset
      changed = true
      return { ...preset, name: nextName, updatedAt: now }
    })
    if (!changed) return false
    persist()
    useUiStore().pushToast(`Renamed preset to "${nextName}".`, 'success')
    return true
  }

  function deletePreset(id: string) {
    const preset = presets.value.find((entry) => entry.id === id)
    if (!preset) return false
    presets.value = presets.value.filter((entry) => entry.id !== id)
    if (activePresetId.value === id) activePresetId.value = ''
    persist()
    useUiStore().pushToast(`Deleted preset "${preset.name}".`, 'info')
    return true
  }

  function exportLibrary() {
    const json = JSON.stringify(buildPresetLibrary(presets.value), null, 2)
    downloadJson(json, `rhythm-navigator-presets_${formatTimestamp()}.json`)
  }

  function importLibrary(json: string) {
    try {
      const library = parsePresetLibraryJson(json)
      presets.value = library.presets
      activePresetId.value = ''
      persist()
      useUiStore().pushToast(`Imported ${library.presets.length} preset(s).`, 'success')
      return library.presets.length
    } catch (error) {
      useUiStore().pushToast(error instanceof Error ? error.message : 'Failed to import preset library.', 'error')
      return 0
    }
  }

  return {
    presets,
    activePresetId,
    initPersistence,
    saveCurrentAsPreset,
    loadPreset,
    renamePreset,
    deletePreset,
    exportLibrary,
    importLibrary
  }
})