<template>
  <div class="flex flex-col gap-2 text-sm">
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span class="font-semibold text-slate-100 truncate max-w-[12rem]" :title="activePresetName">{{ activePresetName }}</span>
      <span class="px-1.5 py-0.5 rounded border uppercase tracking-wide text-[10px]" :class="dirtyStateClass">{{ dirtyStateLabel }}</span>
      <span class="text-slate-500 truncate">in {{ selectedFolderLabel }}</span>
    </div>

    <div class="flex flex-wrap items-center gap-1">
      <button class="toolbtn" title="New preset from defaults" @click="newPresetDialogOpen = true">＋</button>
      <button class="toolbtn" title="Save active preset" :disabled="!canSaveActive" @click="presetStore.saveActivePreset()">💾</button>
      <button class="toolbtn" title="Save session as a new preset" @click="onSaveAs">
        <svg aria-hidden="true" viewBox="0 0 24 24" class="h-4 w-4 fill-none stroke-current stroke-2"><path d="M6 3h9l4 4v14H6z" /><path d="M9 3v6h6M9 17h6" /></svg>
      </button>
      <button class="toolbtn" title="Restore active preset" :disabled="!canRestoreActive" @click="presetStore.restoreActivePreset()">↺</button>
      <span class="w-px h-5 bg-white/10 mx-1"></span>
      <button class="toolbtn" title="New folder in current folder" @click="onCreateFolder">📁＋</button>
      <span class="w-px h-5 bg-white/10 mx-1"></span>
      <button class="toolbtn" title="Export library" @click="presetStore.exportLibrary()">
        <svg aria-hidden="true" viewBox="0 0 24 24" class="h-4 w-4 fill-none stroke-current stroke-2"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>
      </button>
      <label class="toolbtn cursor-pointer" title="Import library">
        <svg aria-hidden="true" viewBox="0 0 24 24" class="h-4 w-4 fill-none stroke-current stroke-2"><path d="M12 21V9M7 12l5-5 5 5M5 3h14" /></svg>
        <input type="file" accept="application/json" class="hidden" @change="onImportLibrary" />
      </label>
    </div>

    <div class="rounded-lg border border-white/10 bg-slate-900/40 overflow-y-auto max-h-[55vh] lg:max-h-[60vh]">
      <div
        class="explorer-row"
        :class="[
          selectedFolderId === null ? 'bg-brand-500/10 text-brand-100' : '',
          isDropTarget(null) ? 'ring-1 ring-cyan-300/70' : ''
        ]"
        @click="presetStore.setSelectedFolder(null)"
        @dragenter.prevent="onFolderDragEnter(null)"
        @dragover.prevent="onFolderDragOver(null, $event)"
        @dragleave="onFolderDragLeave(null)"
        @drop.prevent="onFolderDrop(null, $event)"
      >
        <span class="w-4 text-center text-slate-500">🏠</span>
        <span class="flex-1 truncate">Root</span>
        <span class="text-[10px] text-slate-500">{{ rootPresetCount }}</span>
      </div>

      <template v-for="row in treeRows" :key="`${row.kind}:${row.id}`">
        <div
          class="explorer-row"
          :class="[
            row.kind === 'folder' && selectedFolderId === row.id ? 'bg-brand-500/10 text-brand-100' : '',
            row.kind === 'preset' && row.id === activePresetId ? 'bg-brand-500/15 text-brand-100' : '',
            row.kind === 'folder' && isDropTarget(row.id) ? 'ring-1 ring-cyan-300/70' : '',
            row.kind === 'preset' && draggedPresetId === row.id ? 'opacity-55' : ''
          ]"
          :style="{ paddingLeft: `${8 + row.depth * 14}px` }"
          :draggable="row.kind === 'preset'"
          @click="onRowClick(row)"
          @dragstart="row.kind === 'preset' ? onPresetDragStart(row.id, $event) : undefined"
          @dragend="onPresetDragEnd"
          @dragenter.prevent="row.kind === 'folder' ? onFolderDragEnter(row.id) : undefined"
          @dragover.prevent="row.kind === 'folder' ? onFolderDragOver(row.id, $event) : undefined"
          @dragleave="row.kind === 'folder' ? onFolderDragLeave(row.id) : undefined"
          @drop.prevent="row.kind === 'folder' ? onFolderDrop(row.id, $event) : undefined"
        >
          <span v-if="row.kind === 'folder'" class="w-4 text-center text-slate-400">{{ row.expandable ? (row.expanded ? '▾' : '▸') : '·' }}</span>
          <span v-else class="w-4 text-center text-slate-600">·</span>
          <span class="w-4 text-center">{{ row.kind === 'folder' ? '📁' : '🎵' }}</span>
          <span class="flex-1 truncate" :title="row.name">{{ row.name }}</span>
          <span v-if="row.kind === 'preset' && row.id === activePresetId && isDirty" class="text-[10px] text-amber-300">•</span>
          <button
            class="px-1.5 text-slate-400 hover:text-slate-100"
            :title="menuRowKey === rowKey(row) ? 'Hide actions' : 'Show actions'"
            @click.stop="toggleRowMenu(row)"
          >
            ⋯
          </button>
        </div>

        <div
          v-if="menuRowKey === rowKey(row)"
          class="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-white/5 bg-slate-950/50"
          :style="{ paddingLeft: `${20 + row.depth * 14}px` }"
        >
          <template v-if="row.kind === 'preset'">
            <button class="rowbtn" @click="onLoadPreset(row.id)">Load</button>
            <button class="rowbtn" @click="presetStore.overwritePreset(row.id)">Save here</button>
            <button class="rowbtn" @click="onRenamePreset(row.id, row.name)">Rename</button>
            <button class="rowbtn" @click="presetStore.duplicatePreset(row.id)">Duplicate</button>
            <button class="rowbtn danger" @click="onDeletePreset(row.id, row.name)">Delete</button>
          </template>
          <template v-else>
            <button class="rowbtn" @click="onRenameFolder(row.id, row.name)">Rename</button>
            <button class="rowbtn danger" @click="onDeleteFolder(row.id)">Delete</button>
          </template>
          <select
            class="bg-slate-800 border border-white/10 rounded px-1.5 py-1 text-xs"
            :value="ROOT_FOLDER_OPTION"
            @change="onMoveRow(row, $event)"
          >
            <option :value="ROOT_FOLDER_OPTION">Move to…</option>
            <option :value="ROOT_MOVE_TARGET">Root</option>
            <option v-for="folder in moveTargetsFor(row)" :key="folder.id" :value="folder.id">
              {{ folderPathLabel(folder.id) }}
            </option>
          </select>
          <span v-if="row.kind === 'preset'" class="text-[10px] text-slate-500">
            {{ presetMetaLabel(row.id) }}
          </span>
        </div>
      </template>

      <div v-if="!treeRows.length" class="px-3 py-4 text-xs text-slate-500">Library is empty. Use ＋ or 🗎 to create a preset.</div>
    </div>

    <p class="text-[10px] text-slate-500">
      Tap a preset to load it, a folder to open it, and ⋯ for actions. On desktop you can also drag presets onto folders.
    </p>

    <NewPresetDialog
      :open="newPresetDialogOpen"
      :initial-name="presetName"
      :is-dirty="isDirty"
      @close="newPresetDialogOpen = false"
      @create="onCreatePresetFromDialog"
      @discard-and-create="onDiscardAndCreatePresetFromDialog"
      @save-and-create="onSaveAndCreatePresetFromDialog"
    />

    <UnsavedChangesDialog
      :open="dirtyGuardDialogOpen"
      @cancel="cancelPendingPresetLoad"
      @discard="continuePendingPresetLoad"
      @save="saveAndContinuePendingPresetLoad"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { usePresetStore } from '@/stores/presetStore'
import NewPresetDialog from '@/components/NewPresetDialog.vue'
import UnsavedChangesDialog from '@/components/UnsavedChangesDialog.vue'
import type { PresetFolder } from '@/utils/presetLibrary'

type TreeRow = {
  kind: 'folder' | 'preset'
  id: string
  name: string
  depth: number
  expandable: boolean
  expanded: boolean
}

const presetStore = usePresetStore()
const {
  presets,
  folders,
  activePresetId,
  selectedFolderId,
  expandedFolderIds,
  activePresetName,
  isDirty,
  dirtyState,
  canSaveActive,
  canRestoreActive
} = storeToRefs(presetStore)

const ROOT_FOLDER_OPTION = '__move_placeholder__'
const ROOT_MOVE_TARGET = '__root_target__'
const ROOT_PRESET_DROP_TARGET = '__preset-drop-root__'

const presetName = ref('')
const newPresetDialogOpen = ref(false)
const dirtyGuardDialogOpen = ref(false)
const pendingPresetLoadId = ref<string | null>(null)
const menuRowKey = ref<string | null>(null)
const draggedPresetId = ref<string | null>(null)
const dropTargetFolderKey = ref<string | null>(null)

const folderMap = computed(() => new Map(folders.value.map((folder) => [folder.id, folder])))
const dirtyStateLabel = computed(() => (dirtyState.value === 'modified' ? 'Modified' : dirtyState.value === 'clean' ? 'Clean' : 'Unsaved'))
const dirtyStateClass = computed(() => {
  if (dirtyState.value === 'modified') return 'border-amber-400/50 text-amber-300'
  if (dirtyState.value === 'clean') return 'border-emerald-400/50 text-emerald-300'
  return 'border-slate-500/60 text-slate-300'
})
const selectedFolderLabel = computed(() => (selectedFolderId.value ? folderPathLabel(selectedFolderId.value) : 'Root'))
const rootPresetCount = computed(() => presetStore.presetsInFolder(null).length)

const treeRows = computed<TreeRow[]>(() => {
  const rows: TreeRow[] = []
  const buildLevel = (parentId: string | null, depth: number) => {
    for (const folder of presetStore.foldersInParent(parentId)) {
      const childFolders = presetStore.foldersInParent(folder.id)
      const childPresets = presetStore.presetsInFolder(folder.id)
      const expandable = childFolders.length > 0 || childPresets.length > 0
      const expanded = expandedFolderIds.value.includes(folder.id)
      rows.push({ kind: 'folder', id: folder.id, name: folder.name, depth, expandable, expanded })
      if (expandable && expanded) buildLevel(folder.id, depth + 1)
    }
    for (const preset of presetStore.presetsInFolder(parentId)) {
      rows.push({ kind: 'preset', id: preset.id, name: preset.name, depth, expandable: false, expanded: false })
    }
  }
  buildLevel(null, 0)
  return rows
})

function rowKey(row: TreeRow) {
  return `${row.kind}:${row.id}`
}

function toggleRowMenu(row: TreeRow) {
  menuRowKey.value = menuRowKey.value === rowKey(row) ? null : rowKey(row)
}

function onRowClick(row: TreeRow) {
  if (row.kind === 'folder') {
    presetStore.setSelectedFolder(row.id)
    if (row.expandable) presetStore.toggleFolderExpanded(row.id)
    return
  }
  onLoadPreset(row.id)
}

function moveTargetsFor(row: TreeRow) {
  return folders.value
    .filter((folder) => (row.kind === 'preset' ? true : !isFolderInSubtree(row.id, folder.id)))
    .sort((left, right) => folderPathLabel(left.id).localeCompare(folderPathLabel(right.id)))
}

function onMoveRow(row: TreeRow, event: Event) {
  const select = event.target as HTMLSelectElement
  const value = select.value
  select.value = ROOT_FOLDER_OPTION
  if (value === ROOT_FOLDER_OPTION) return
  const targetId = value === ROOT_MOVE_TARGET ? null : value
  if (row.kind === 'preset') {
    presetStore.movePresetToFolder(row.id, targetId)
  } else {
    presetStore.moveFolder(row.id, targetId)
  }
  menuRowKey.value = null
}

function onSaveAs() {
  const value = window.prompt('Save session as new preset', presetName.value || activePresetName.value)
  if (value == null) return
  const preset = presetStore.saveCurrentAsPreset(value)
  presetName.value = preset.name
}

function createDefaultPreset(name: string) {
  const preset = presetStore.createPresetFromDefaults(name)
  presetName.value = preset.name
  newPresetDialogOpen.value = false
}

function onCreatePresetFromDialog(name: string) {
  createDefaultPreset(name)
}

function onDiscardAndCreatePresetFromDialog(name: string) {
  createDefaultPreset(name)
}

function onSaveAndCreatePresetFromDialog(name: string) {
  if (!presetStore.saveActivePreset()) return
  createDefaultPreset(name)
}

function onRenamePreset(id: string, fallback: string) {
  const value = window.prompt('Rename preset', fallback)
  if (value == null) return
  presetStore.renamePreset(id, value)
}

function onDeletePreset(id: string, name: string) {
  if (!window.confirm(`Delete preset "${name}"?`)) return
  presetStore.deletePreset(id)
  menuRowKey.value = null
}

function onLoadPreset(id: string) {
  if (id === activePresetId.value) return
  if (!isDirty.value) {
    presetStore.loadPreset(id)
    return
  }
  pendingPresetLoadId.value = id
  dirtyGuardDialogOpen.value = true
}

function continuePendingPresetLoad() {
  if (pendingPresetLoadId.value) {
    presetStore.loadPreset(pendingPresetLoadId.value)
  }
  pendingPresetLoadId.value = null
  dirtyGuardDialogOpen.value = false
}

function saveAndContinuePendingPresetLoad() {
  if (!presetStore.saveActivePreset()) return
  continuePendingPresetLoad()
}

function cancelPendingPresetLoad() {
  pendingPresetLoadId.value = null
  dirtyGuardDialogOpen.value = false
}

function onImportLibrary(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    presetStore.importLibrary(String(reader.result || ''))
  }
  reader.readAsText(file)
  input.value = ''
}

function onCreateFolder() {
  const value = window.prompt('New folder name', 'New folder')
  if (value == null) return
  const folder = presetStore.createFolder(value)
  presetStore.setSelectedFolder(folder.id)
}

function onRenameFolder(id: string, fallback: string) {
  const value = window.prompt('Rename folder', fallback)
  if (value == null) return
  presetStore.renameFolder(id, value)
}

function onDeleteFolder(id: string) {
  const name = folderMap.value.get(id)?.name ?? 'this folder'
  if (!window.confirm(`Delete folder "${name}"?`)) return
  const recursive = window.confirm(
    'Also delete every sub-folder and preset inside it?\n\nOK = delete everything, Cancel = move the contents to the parent folder.'
  )
  presetStore.deleteFolder(id, recursive ? 'recursive' : 'reparent')
  menuRowKey.value = null
}

function isFolderInSubtree(folderId: string, candidateId: string) {
  let cursor: PresetFolder | undefined = folderMap.value.get(candidateId)
  while (cursor) {
    if (cursor.id === folderId) return true
    cursor = cursor.parentId ? folderMap.value.get(cursor.parentId) : undefined
  }
  return false
}

function folderPathLabel(folderId: string) {
  const labels: string[] = []
  let cursor = folderMap.value.get(folderId)
  while (cursor) {
    labels.unshift(cursor.name)
    cursor = cursor.parentId ? folderMap.value.get(cursor.parentId) : undefined
  }
  return labels.join(' / ') || 'Root'
}

function presetMetaLabel(id: string) {
  const preset = presets.value.find((entry) => entry.id === id)
  if (!preset) return ''
  const tracks = preset.sequencer.tracks ?? []
  const patterns = tracks.reduce((total, track) => total + (track.patterns?.length ?? 0), 0)
  return `${tracks.length} track(s) · ${patterns} pattern(s) · ${new Date(preset.updatedAt).toLocaleString()}`
}

function isDropTarget(folderId: string | null) {
  return dropTargetFolderKey.value === (folderId ?? ROOT_PRESET_DROP_TARGET)
}

function canDropPresetToFolder(folderId: string | null) {
  if (!draggedPresetId.value) return false
  const preset = presets.value.find((entry) => entry.id === draggedPresetId.value)
  if (!preset) return false
  return preset.folderId !== folderId
}

function onPresetDragStart(presetId: string, event: DragEvent) {
  draggedPresetId.value = presetId
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', presetId)
  }
}

function onPresetDragEnd() {
  draggedPresetId.value = null
  dropTargetFolderKey.value = null
}

function onFolderDragEnter(folderId: string | null) {
  if (!canDropPresetToFolder(folderId)) return
  dropTargetFolderKey.value = folderId ?? ROOT_PRESET_DROP_TARGET
}

function onFolderDragOver(folderId: string | null, event: DragEvent) {
  if (!canDropPresetToFolder(folderId)) return
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
  dropTargetFolderKey.value = folderId ?? ROOT_PRESET_DROP_TARGET
}

function onFolderDragLeave(folderId: string | null) {
  if (dropTargetFolderKey.value === (folderId ?? ROOT_PRESET_DROP_TARGET)) {
    dropTargetFolderKey.value = null
  }
}

function onFolderDrop(folderId: string | null, event: DragEvent) {
  event.preventDefault()
  if (!canDropPresetToFolder(folderId) || !draggedPresetId.value) {
    onPresetDragEnd()
    return
  }
  presetStore.movePresetToFolder(draggedPresetId.value, folderId)
  onPresetDragEnd()
}
</script>

<style scoped>
.explorer-row {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  width: 100%;
  padding: 0.3rem 0.5rem;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 0.8125rem;
  line-height: 1.1rem;
  user-select: none;
}

.explorer-row:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.toolbtn {
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 0.8125rem;
  line-height: 1.1rem;
}

.toolbtn:hover:not(:disabled) {
  background-color: rgba(255, 255, 255, 0.05);
}

.toolbtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.rowbtn {
  padding: 0.15rem 0.45rem;
  border-radius: 0.25rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 0.6875rem;
}

.rowbtn:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.rowbtn.danger {
  border-color: rgba(239, 68, 68, 0.35);
}

.rowbtn.danger:hover {
  background-color: rgba(239, 68, 68, 0.12);
}
</style>
