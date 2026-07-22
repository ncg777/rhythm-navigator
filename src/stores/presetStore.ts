import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useSequencerStore } from '@/stores/sequencerStore'
import { useUiStore } from '@/stores/uiStore'
import {
  buildPresetLibrary,
  normalizePresetName,
  parsePresetLibraryJson,
  type PresetFolder,
  type SessionPreset
} from '@/utils/presetLibrary'

const STORAGE_KEY = 'rn.presets'
const ACTIVE_PRESET_KEY = 'rn.presets.activePresetId'
const UI_KEY = 'rn.presets.ui'

type DirtyState = 'unsaved' | 'clean' | 'modified'

function normalizeFolderName(name: string) {
  const trimmed = name.trim()
  return trimmed || 'Untitled folder'
}

function makePresetId() {
  return `preset:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`
}

function makeFolderId() {
  return `folder:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`
}

function stableNormalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => stableNormalize(entry))
  if (!value || typeof value !== 'object') return value
  const obj = value as Record<string, unknown>
  const sorted = Object.keys(obj)
    .sort((a, b) => a.localeCompare(b))
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = stableNormalize(obj[key])
      return acc
    }, {})
  return sorted
}

function snapshotFingerprint(snapshot: unknown) {
  return JSON.stringify(stableNormalize(snapshot))
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
  const folders = ref<PresetFolder[]>([])
  const activePresetId = ref('')
  const selectedFolderId = ref<string | null>(null)
  const expandedFolderIds = ref<string[]>([])
  const activePresetBaseline = ref('')

  const sequencer = useSequencerStore()
  const ui = useUiStore()

  const folderMap = computed(() => new Map(folders.value.map((folder) => [folder.id, folder])))
  const activePreset = computed(() => presets.value.find((preset) => preset.id === activePresetId.value) ?? null)
  const activePresetName = computed(() => activePreset.value?.name ?? 'Unsaved session')
  const isDirty = computed(() => {
    if (!activePreset.value) return false
    return snapshotFingerprint(sequencer.captureSessionState()) !== activePresetBaseline.value
  })
  const dirtyState = computed<DirtyState>(() => {
    if (!activePreset.value) return 'unsaved'
    return isDirty.value ? 'modified' : 'clean'
  })
  const canSaveActive = computed(() => !!activePreset.value && isDirty.value)
  const canRestoreActive = computed(() => !!activePreset.value && isDirty.value)

  function ensureValidFolderId(folderId: string | null | undefined) {
    if (!folderId) return null
    return folderMap.value.has(folderId) ? folderId : null
  }

  function sortedPresets(list: SessionPreset[]) {
    return [...list].sort((left, right) => {
      if (left.order !== right.order) return left.order - right.order
      return right.updatedAt - left.updatedAt
    })
  }

  function childFolders(parentId: string | null) {
    return [...folders.value]
      .filter((folder) => folder.parentId === parentId)
      .sort((left, right) => {
        if (left.order !== right.order) return left.order - right.order
        return left.name.localeCompare(right.name)
      })
  }

  function nextFolderOrder(parentId: string | null) {
    const siblings = folders.value.filter((folder) => folder.parentId === parentId)
    if (!siblings.length) return 0
    return Math.max(...siblings.map((folder) => folder.order)) + 1
  }

  function nextPresetOrder(folderId: string | null) {
    const siblings = presets.value.filter((preset) => preset.folderId === folderId)
    if (!siblings.length) return 0
    return Math.max(...siblings.map((preset) => preset.order)) + 1
  }

  function setBaselineFromActivePreset() {
    activePresetBaseline.value = activePreset.value ? snapshotFingerprint(activePreset.value.sequencer) : ''
  }

  function persistUiState() {
    localStorage.setItem(ACTIVE_PRESET_KEY, activePresetId.value)
    localStorage.setItem(
      UI_KEY,
      JSON.stringify({
        selectedFolderId: selectedFolderId.value,
        expandedFolderIds: expandedFolderIds.value
      })
    )
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPresetLibrary(presets.value, folders.value)))
    persistUiState()
  }

  function initPersistence() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const library = parsePresetLibraryJson(raw)
        presets.value = library.presets
        folders.value = library.folders
      }

      activePresetId.value = localStorage.getItem(ACTIVE_PRESET_KEY) || ''
      if (activePresetId.value && !presets.value.some((preset) => preset.id === activePresetId.value)) {
        activePresetId.value = ''
      }

      const rawUi = localStorage.getItem(UI_KEY)
      if (rawUi) {
        try {
          const parsedUi = JSON.parse(rawUi) as { selectedFolderId?: string | null; expandedFolderIds?: string[] }
          selectedFolderId.value = ensureValidFolderId(parsedUi.selectedFolderId ?? null)
          expandedFolderIds.value = Array.isArray(parsedUi.expandedFolderIds)
            ? parsedUi.expandedFolderIds.filter((id) => folderMap.value.has(id))
            : []
        } catch {
          selectedFolderId.value = null
          expandedFolderIds.value = []
        }
      }

      if (selectedFolderId.value && !folderMap.value.has(selectedFolderId.value)) {
        selectedFolderId.value = null
      }
      setBaselineFromActivePreset()
    } catch (error) {
      console.warn('[presetStore] failed to load preset library', error)
    }
  }

  function saveCurrentAsPreset(name: string, folderId: string | null = selectedFolderId.value) {
    const normalizedFolderId = ensureValidFolderId(folderId)
    const now = Date.now()
    const snapshot = sequencer.captureSessionState()
    const preset: SessionPreset = {
      id: makePresetId(),
      name: normalizePresetName(name),
      folderId: normalizedFolderId,
      order: nextPresetOrder(normalizedFolderId),
      createdAt: now,
      updatedAt: now,
      sequencer: snapshot
    }
    presets.value = [preset, ...presets.value]
    activePresetId.value = preset.id
    activePresetBaseline.value = snapshotFingerprint(snapshot)
    persist()
    ui.pushToast(`Saved preset "${preset.name}".`, 'success')
    return preset
  }

  function createPresetFromDefaults(name: string, folderId: string | null = selectedFolderId.value) {
    const normalizedFolderId = ensureValidFolderId(folderId)
    const now = Date.now()
    const snapshot = sequencer.createDefaultSessionSnapshot()
    const preset: SessionPreset = {
      id: makePresetId(),
      name: normalizePresetName(name),
      folderId: normalizedFolderId,
      order: nextPresetOrder(normalizedFolderId),
      createdAt: now,
      updatedAt: now,
      sequencer: snapshot
    }
    presets.value = [preset, ...presets.value]
    activePresetId.value = preset.id
    sequencer.applySessionState(snapshot)
    activePresetBaseline.value = snapshotFingerprint(snapshot)
    persist()
    ui.pushToast(`Created default preset "${preset.name}".`, 'success')
    return preset
  }

  function overwritePreset(id: string, name?: string) {
    const index = presets.value.findIndex((entry) => entry.id === id)
    if (index < 0) return false
    const now = Date.now()
    const previous = presets.value[index]
    const snapshot = sequencer.captureSessionState()
    const updated: SessionPreset = {
      ...previous,
      name: normalizePresetName(name ?? previous.name),
      updatedAt: now,
      sequencer: snapshot
    }
    presets.value = presets.value.map((entry, entryIndex) => (entryIndex === index ? updated : entry))
    activePresetId.value = updated.id
    activePresetBaseline.value = snapshotFingerprint(snapshot)
    persist()
    ui.pushToast(`Overwrote preset "${updated.name}".`, 'success')
    return true
  }

  function saveActivePreset(name?: string) {
    if (!activePresetId.value) return false
    return overwritePreset(activePresetId.value, name)
  }

  function restoreActivePreset() {
    if (!activePreset.value) return false
    sequencer.applySessionState(activePreset.value.sequencer)
    setBaselineFromActivePreset()
    ui.pushToast(`Restored preset "${activePreset.value.name}".`, 'info')
    return true
  }

  function loadPreset(id: string) {
    const preset = presets.value.find((entry) => entry.id === id)
    if (!preset) return false
    sequencer.applySessionState(preset.sequencer)
    activePresetId.value = preset.id
    activePresetBaseline.value = snapshotFingerprint(preset.sequencer)
    ui.pushToast(`Loaded preset "${preset.name}".`, 'success')
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
    ui.pushToast(`Renamed preset to "${nextName}".`, 'success')
    return true
  }

  function movePresetToFolder(id: string, folderId: string | null) {
    const normalizedFolderId = ensureValidFolderId(folderId)
    let changed = false
    presets.value = presets.value.map((preset) => {
      if (preset.id !== id) return preset
      changed = true
      return {
        ...preset,
        folderId: normalizedFolderId,
        order: nextPresetOrder(normalizedFolderId),
        updatedAt: Date.now()
      }
    })
    if (!changed) return false
    persist()
    ui.pushToast('Moved preset.', 'success')
    return true
  }

  function duplicatePreset(id: string) {
    const source = presets.value.find((preset) => preset.id === id)
    if (!source) return null
    const now = Date.now()
    const cloneSnapshot = JSON.parse(JSON.stringify(source.sequencer))
    const copy: SessionPreset = {
      ...source,
      id: makePresetId(),
      name: normalizePresetName(`${source.name} Copy`),
      order: nextPresetOrder(source.folderId ?? null),
      createdAt: now,
      updatedAt: now,
      sequencer: cloneSnapshot
    }
    presets.value = [copy, ...presets.value]
    persist()
    ui.pushToast(`Duplicated preset "${source.name}".`, 'success')
    return copy
  }

  function deletePreset(id: string) {
    const preset = presets.value.find((entry) => entry.id === id)
    if (!preset) return false
    presets.value = presets.value.filter((entry) => entry.id !== id)
    if (activePresetId.value === id) {
      activePresetId.value = ''
      activePresetBaseline.value = ''
    }
    persist()
    ui.pushToast(`Deleted preset "${preset.name}".`, 'info')
    return true
  }

  function setSelectedFolder(id: string | null) {
    selectedFolderId.value = ensureValidFolderId(id)
    persistUiState()
  }

  function toggleFolderExpanded(id: string) {
    if (!folderMap.value.has(id)) return
    const exists = expandedFolderIds.value.includes(id)
    expandedFolderIds.value = exists
      ? expandedFolderIds.value.filter((entry) => entry !== id)
      : [...expandedFolderIds.value, id]
    persistUiState()
  }

  function createFolder(name: string, parentId: string | null = selectedFolderId.value) {
    const normalizedParentId = ensureValidFolderId(parentId)
    const folder: PresetFolder = {
      id: makeFolderId(),
      name: normalizeFolderName(name),
      parentId: normalizedParentId,
      order: nextFolderOrder(normalizedParentId),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    folders.value = [...folders.value, folder]
    expandedFolderIds.value = [...new Set([...expandedFolderIds.value, folder.id])]
    persist()
    ui.pushToast(`Created folder "${folder.name}".`, 'success')
    return folder
  }

  function renameFolder(id: string, name: string) {
    const nextName = normalizeFolderName(name)
    let changed = false
    folders.value = folders.value.map((folder) => {
      if (folder.id !== id) return folder
      changed = true
      return { ...folder, name: nextName, updatedAt: Date.now() }
    })
    if (!changed) return false
    persist()
    ui.pushToast(`Renamed folder to "${nextName}".`, 'success')
    return true
  }

  function isDescendantFolder(candidateParentId: string | null, folderId: string) {
    if (!candidateParentId) return false
    let cursor = folderMap.value.get(candidateParentId)
    while (cursor) {
      if (cursor.id === folderId) return true
      cursor = cursor.parentId ? folderMap.value.get(cursor.parentId) : undefined
    }
    return false
  }

  function moveFolder(id: string, parentId: string | null) {
    const folder = folderMap.value.get(id)
    if (!folder) return false
    const normalizedParentId = ensureValidFolderId(parentId)
    if (normalizedParentId === id || isDescendantFolder(normalizedParentId, id)) {
      ui.pushToast('Invalid folder move target.', 'error')
      return false
    }
    folders.value = folders.value.map((entry) => {
      if (entry.id !== id) return entry
      return {
        ...entry,
        parentId: normalizedParentId,
        order: nextFolderOrder(normalizedParentId),
        updatedAt: Date.now()
      }
    })
    persist()
    ui.pushToast('Moved folder.', 'success')
    return true
  }

  function collectDescendantFolderIds(folderId: string): Set<string> {
    const ids = new Set<string>()
    const stack = [folderId]
    while (stack.length) {
      const current = stack.pop()!
      if (ids.has(current)) continue
      ids.add(current)
      for (const child of childFolders(current)) {
        stack.push(child.id)
      }
    }
    return ids
  }

  function deleteFolder(id: string, strategy: 'recursive' | 'reparent' = 'reparent') {
    const folder = folderMap.value.get(id)
    if (!folder) return false

    if (strategy === 'recursive') {
      const removedFolderIds = collectDescendantFolderIds(id)
      folders.value = folders.value.filter((entry) => !removedFolderIds.has(entry.id))
      const removedPresetIds = new Set(
        presets.value.filter((preset) => preset.folderId && removedFolderIds.has(preset.folderId)).map((preset) => preset.id)
      )
      presets.value = presets.value.filter((preset) => !removedPresetIds.has(preset.id))
      if (activePresetId.value && removedPresetIds.has(activePresetId.value)) {
        activePresetId.value = ''
        activePresetBaseline.value = ''
      }
      if (selectedFolderId.value && removedFolderIds.has(selectedFolderId.value)) {
        selectedFolderId.value = folder.parentId
      }
      expandedFolderIds.value = expandedFolderIds.value.filter((folderId) => !removedFolderIds.has(folderId))
      persist()
      ui.pushToast(`Deleted folder "${folder.name}" and its contents.`, 'info')
      return true
    }

    folders.value = folders.value
      .filter((entry) => entry.id !== id)
      .map((entry) => (entry.parentId === id ? { ...entry, parentId: folder.parentId, updatedAt: Date.now() } : entry))

    presets.value = presets.value.map((preset) => {
      if (preset.folderId !== id) return preset
      return {
        ...preset,
        folderId: folder.parentId,
        order: nextPresetOrder(folder.parentId)
      }
    })

    if (selectedFolderId.value === id) {
      selectedFolderId.value = folder.parentId
    }
    expandedFolderIds.value = expandedFolderIds.value.filter((folderId) => folderId !== id)
    persist()
    ui.pushToast(`Deleted folder "${folder.name}".`, 'info')
    return true
  }

  function exportLibrary() {
    const json = JSON.stringify(buildPresetLibrary(presets.value, folders.value), null, 2)
    downloadJson(json, `rhythm-navigator-presets_${formatTimestamp()}.json`)
  }

  function importLibrary(json: string) {
    try {
      const library = parsePresetLibraryJson(json)
      presets.value = library.presets
      folders.value = library.folders
      activePresetId.value = ''
      selectedFolderId.value = null
      expandedFolderIds.value = []
      activePresetBaseline.value = ''
      persist()
      ui.pushToast(`Imported ${library.presets.length} preset(s).`, 'success')
      return library.presets.length
    } catch (error) {
      ui.pushToast(error instanceof Error ? error.message : 'Failed to import preset library.', 'error')
      return 0
    }
  }

  function presetsInFolder(folderId: string | null) {
    return sortedPresets(presets.value.filter((preset) => preset.folderId === folderId))
  }

  function foldersInParent(parentId: string | null) {
    return childFolders(parentId)
  }

  return {
    presets,
    folders,
    activePresetId,
    selectedFolderId,
    expandedFolderIds,
    activePreset,
    activePresetName,
    dirtyState,
    isDirty,
    canSaveActive,
    canRestoreActive,
    initPersistence,
    saveCurrentAsPreset,
    createPresetFromDefaults,
    overwritePreset,
    saveActivePreset,
    restoreActivePreset,
    loadPreset,
    renamePreset,
    movePresetToFolder,
    duplicatePreset,
    deletePreset,
    setSelectedFolder,
    toggleFolderExpanded,
    createFolder,
    renameFolder,
    moveFolder,
    deleteFolder,
    presetsInFolder,
    foldersInParent,
    exportLibrary,
    importLibrary
  }
})