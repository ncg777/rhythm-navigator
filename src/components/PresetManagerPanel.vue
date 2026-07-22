<template>
  <div class="space-y-4">
    <div class="rounded-lg border border-white/10 bg-slate-900/50 p-3 flex flex-wrap items-center gap-2 text-xs">
      <span class="uppercase tracking-wide text-slate-400">Current preset</span>
      <span class="font-semibold text-slate-100">{{ activePresetName }}</span>
      <span
        class="px-2 py-0.5 rounded border uppercase tracking-wide"
        :class="dirtyStateClass"
      >
        {{ dirtyStateLabel }}
      </span>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-3">
      <div class="rounded-lg border border-white/10 p-3 space-y-2">
        <label class="block text-xs uppercase tracking-wide text-slate-400">Save current session as new preset</label>
        <div class="flex flex-col sm:flex-row gap-2">
          <input
            v-model="presetName"
            type="text"
            class="flex-1 bg-slate-800 border border-white/10 rounded px-3 py-2"
            placeholder="Named preset"
            @keydown.enter.prevent="onSaveAsCurrent"
          />
          <button class="px-3 py-2 rounded border border-white/10 hover:bg-white/5" @click="onSaveAsCurrent">Save As</button>
          <button class="px-3 py-2 rounded border border-brand-500/40 hover:bg-brand-500/10" @click="onNewDefault">New default</button>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="px-3 py-2 rounded border border-white/10 hover:bg-white/5" :disabled="!canSaveActive" @click="presetStore.saveActivePreset()">Save active</button>
          <button class="px-3 py-2 rounded border border-white/10 hover:bg-white/5" :disabled="!canRestoreActive" @click="presetStore.restoreActivePreset()">Restore active</button>
        </div>
      </div>

      <div class="rounded-lg border border-white/10 p-3 space-y-2">
        <label class="block text-xs uppercase tracking-wide text-slate-400">Folders and library</label>
        <div class="flex flex-col sm:flex-row gap-2">
          <input
            v-model="folderName"
            type="text"
            class="flex-1 bg-slate-800 border border-white/10 rounded px-3 py-2"
            placeholder="New folder name"
            @keydown.enter.prevent="onCreateFolder"
          />
          <button class="px-3 py-2 rounded border border-white/10 hover:bg-white/5" @click="onCreateFolder">Create folder</button>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="px-3 py-2 rounded border border-white/10 hover:bg-white/5" @click="presetStore.exportLibrary()">Export library</button>
          <label class="px-3 py-2 rounded border border-white/10 hover:bg-white/5 cursor-pointer">
            Import library
            <input type="file" accept="application/json" class="hidden" @change="onImportLibrary" />
          </label>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-[minmax(14rem,18rem)_1fr] gap-4">
      <aside class="rounded-lg border border-white/10 bg-slate-900/35 p-3 space-y-2">
        <button
          class="w-full text-left px-2 py-1 rounded border"
          :class="[
            selectedFolderId === null ? 'border-brand-400/60 bg-brand-500/10' : 'border-white/10 hover:bg-white/5',
            isPresetDropTarget(null) ? 'border-cyan-300/70 bg-cyan-500/15' : ''
          ]"
          @click="presetStore.setSelectedFolder(null)"
          @dragenter.prevent="onFolderDragEnter(null)"
          @dragover.prevent="onFolderDragOver(null, $event)"
          @dragleave="onFolderDragLeave(null)"
          @drop.prevent="onFolderDrop(null, $event)"
        >
          Root
        </button>
        <div v-for="row in folderRows" :key="row.folder.id" class="space-y-1" :style="{ paddingLeft: `${row.depth * 12}px` }">
          <div class="flex items-center gap-1">
            <button
              v-if="row.hasChildren"
              class="px-1 text-xs text-slate-400 hover:text-slate-200"
              @click="presetStore.toggleFolderExpanded(row.folder.id)"
              :title="row.expanded ? 'Collapse folder' : 'Expand folder'"
            >
              {{ row.expanded ? '▾' : '▸' }}
            </button>
            <span v-else class="px-1 text-xs text-slate-600">•</span>
            <button
              class="flex-1 text-left px-2 py-1 rounded border"
              :class="[
                selectedFolderId === row.folder.id ? 'border-brand-400/60 bg-brand-500/10' : 'border-white/10 hover:bg-white/5',
                isPresetDropTarget(row.folder.id) ? 'border-cyan-300/70 bg-cyan-500/15' : ''
              ]"
              @click="presetStore.setSelectedFolder(row.folder.id)"
              @dragenter.prevent="onFolderDragEnter(row.folder.id)"
              @dragover.prevent="onFolderDragOver(row.folder.id, $event)"
              @dragleave="onFolderDragLeave(row.folder.id)"
              @drop.prevent="onFolderDrop(row.folder.id, $event)"
            >
              {{ row.folder.name }}
            </button>
            <button class="px-2 py-1 rounded border border-white/10 hover:bg-white/5 text-xs" @click="onRenameFolder(row.folder.id, row.folder.name)">Rename</button>
            <button class="px-2 py-1 rounded border border-white/10 hover:bg-white/5 text-xs" @click="openMoveFolder(row.folder.id, row.folder.parentId)">Move</button>
            <button class="px-2 py-1 rounded border border-red-500/30 hover:bg-red-500/10 text-xs" @click="openDeleteFolder(row.folder.id)">Delete</button>
          </div>

          <div
            v-if="folderMoveEditorId === row.folder.id"
            class="ml-6 rounded-md border border-white/10 bg-slate-900/60 p-2 space-y-2"
          >
            <label class="block text-[11px] uppercase tracking-wide text-slate-400">Move folder to</label>
            <div class="flex flex-col sm:flex-row sm:items-center gap-2">
              <select v-model="folderMoveTargetId" class="flex-1 bg-slate-800 border border-white/10 rounded px-2 py-2 text-xs">
                <option :value="ROOT_FOLDER_OPTION">Root</option>
                <option v-for="folder in folderMoveTargets" :key="folder.id" :value="folder.id">
                  {{ folderPathLabel(folder.id) }}
                </option>
              </select>
              <button class="px-3 py-2 rounded border border-white/10 hover:bg-white/5 text-xs" @click="confirmMoveFolder">Move</button>
              <button class="px-3 py-2 rounded border border-white/10 hover:bg-white/5 text-xs" @click="cancelMoveFolder">Cancel</button>
            </div>
          </div>

          <div
            v-if="folderDeleteEditorId === row.folder.id"
            class="ml-6 rounded-md border border-red-500/30 bg-red-500/5 p-2 space-y-2"
          >
            <label class="block text-[11px] uppercase tracking-wide text-red-200">Delete folder strategy</label>
            <div class="flex flex-col sm:flex-row sm:items-center gap-2">
              <select v-model="folderDeleteStrategy" class="flex-1 bg-slate-800 border border-white/10 rounded px-2 py-2 text-xs">
                <option value="reparent">Reparent children and presets to parent folder</option>
                <option value="recursive">Delete folder and all descendant folders and presets</option>
              </select>
            </div>
            <div class="flex flex-col sm:flex-row gap-2">
              <button class="px-3 py-2 rounded border border-red-500/40 hover:bg-red-500/10 text-xs" @click="confirmDeleteFolder">Confirm delete</button>
              <button class="px-3 py-2 rounded border border-white/10 hover:bg-white/5 text-xs" @click="cancelDeleteFolder">Cancel</button>
            </div>
          </div>
        </div>
      </aside>

      <section class="space-y-3">
        <div class="text-xs text-slate-500">
          Showing {{ selectedFolderId ? folderNameById(selectedFolderId) : 'Root' }} · {{ visiblePresets.length }} preset(s)
        </div>
        <div class="text-[11px] text-slate-500">
          Drag a preset card onto a folder (or Root) in the left panel to move it.
        </div>

        <div v-if="!visiblePresets.length" class="rounded-lg border border-dashed border-white/10 p-5 text-sm text-slate-500">
          No presets in this folder.
        </div>

        <article
          v-for="preset in visiblePresets"
          :key="preset.id"
          class="rounded-lg border p-3 cursor-grab"
          :class="[
            preset.id === activePresetId ? 'border-brand-500/60 bg-brand-500/10' : 'border-white/10 bg-slate-900/40',
            draggedPresetId === preset.id ? 'opacity-55 ring-1 ring-cyan-300/70' : ''
          ]"
          draggable="true"
          @dragstart="onPresetDragStart(preset.id, $event)"
          @dragend="onPresetDragEnd"
        >
          <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div class="flex-1 min-w-0 space-y-2">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-sm font-semibold text-slate-100">{{ preset.name }}</span>
                <span v-if="preset.id === activePresetId" class="text-[10px] uppercase tracking-wide text-brand-300">Active</span>
                <span v-if="preset.id === activePresetId && isDirty" class="text-[10px] uppercase tracking-wide text-amber-300">Modified</span>
              </div>
              <div class="text-xs text-slate-500 flex flex-wrap gap-3">
                <span>{{ preset.sequencer.tracks?.length ?? 0 }} track(s)</span>
                <span>{{ patternCountFor(preset) }} pattern(s)</span>
                <span>Updated {{ formatDate(preset.updatedAt) }}</span>
                <span v-if="preset.folderId">Folder: {{ folderPathLabel(preset.folderId) }}</span>
              </div>
              <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  :value="draftFor(preset.id, preset.name)"
                  type="text"
                  class="flex-1 bg-slate-800 border border-white/10 rounded px-3 py-2"
                  @input="setDraft(preset.id, $event)"
                  @keydown.enter.prevent="onRename(preset.id, preset.name)"
                />
                <button class="px-3 py-2 rounded border border-white/10 hover:bg-white/5 transition" @click="onRename(preset.id, preset.name)">Rename</button>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2 shrink-0">
              <button class="px-3 py-2 rounded border border-white/10 hover:bg-white/5" @click="onLoadPreset(preset.id)">Load</button>
              <button class="px-3 py-2 rounded border border-white/10 hover:bg-white/5" @click="presetStore.overwritePreset(preset.id)">Save</button>
              <button class="px-3 py-2 rounded border border-white/10 hover:bg-white/5" @click="presetStore.duplicatePreset(preset.id)">Duplicate</button>
              <button class="px-3 py-2 rounded border border-red-500/30 hover:bg-red-500/10" @click="presetStore.deletePreset(preset.id)">Delete</button>
            </div>
          </div>
        </article>
      </section>
    </div>

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
import type { PresetFolder, SessionPreset } from '@/utils/presetLibrary'

type FolderRow = {
  folder: PresetFolder
  depth: number
  hasChildren: boolean
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

const presetName = ref('')
const folderName = ref('')
const renameDrafts = ref<Record<string, string>>({})
const ROOT_FOLDER_OPTION = '__root__'
const folderMoveEditorId = ref<string | null>(null)
const folderMoveTargetId = ref<string>(ROOT_FOLDER_OPTION)
const folderDeleteEditorId = ref<string | null>(null)
const folderDeleteStrategy = ref<'recursive' | 'reparent'>('reparent')
const newPresetDialogOpen = ref(false)
const dirtyGuardDialogOpen = ref(false)
const pendingPresetLoadId = ref<string | null>(null)
const draggedPresetId = ref<string | null>(null)
const ROOT_PRESET_DROP_TARGET = '__preset-drop-root__'
const dropTargetFolderKey = ref<string | null>(null)

const folderMap = computed(() => new Map(folders.value.map((folder) => [folder.id, folder])))
const visiblePresets = computed(() => presetStore.presetsInFolder(selectedFolderId.value))
const dirtyStateLabel = computed(() => (dirtyState.value === 'modified' ? 'Modified' : dirtyState.value === 'clean' ? 'Clean' : 'Unsaved'))
const dirtyStateClass = computed(() => {
  if (dirtyState.value === 'modified') return 'border-amber-400/50 text-amber-300'
  if (dirtyState.value === 'clean') return 'border-emerald-400/50 text-emerald-300'
  return 'border-slate-500/60 text-slate-300'
})

const folderRows = computed<FolderRow[]>(() => {
  const rows: FolderRow[] = []
  const buildRows = (parentId: string | null, depth: number) => {
    const children = presetStore.foldersInParent(parentId)
    for (const child of children) {
      const hasChildren = presetStore.foldersInParent(child.id).length > 0
      const expanded = expandedFolderIds.value.includes(child.id)
      rows.push({ folder: child, depth, hasChildren, expanded })
      if (hasChildren && expanded) {
        buildRows(child.id, depth + 1)
      }
    }
  }
  buildRows(null, 0)
  return rows
})

const folderMoveTargets = computed(() => {
  if (!folderMoveEditorId.value) return []
  const sourceFolderId = folderMoveEditorId.value
  return folders.value
    .filter((folder) => !isFolderInSubtree(sourceFolderId, folder.id))
    .sort((left, right) => folderPathLabel(left.id).localeCompare(folderPathLabel(right.id)))
})

function draftFor(id: string, fallback: string) {
  return renameDrafts.value[id] ?? fallback
}

function setDraft(id: string, event: Event) {
  renameDrafts.value = {
    ...renameDrafts.value,
    [id]: (event.target as HTMLInputElement).value
  }
}

function onSaveAsCurrent() {
  const preset = presetStore.saveCurrentAsPreset(presetName.value)
  presetName.value = preset.name
}

function onNewDefault() {
  newPresetDialogOpen.value = true
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

function onRename(id: string, fallback: string) {
  const value = draftFor(id, fallback)
  if (presetStore.renamePreset(id, value)) {
    renameDrafts.value = {
      ...renameDrafts.value,
      [id]: value.trim() || fallback
    }
  }
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
    const text = String(reader.result || '')
    presetStore.importLibrary(text)
    renameDrafts.value = Object.fromEntries(presets.value.map((preset) => [preset.id, preset.name]))
  }
  reader.readAsText(file)
  input.value = ''
}

function onCreateFolder() {
  const folder = presetStore.createFolder(folderName.value)
  folderName.value = ''
  presetStore.setSelectedFolder(folder.id)
}

function onRenameFolder(id: string, fallback: string) {
  const value = window.prompt('Rename folder', fallback)
  if (value == null) return
  presetStore.renameFolder(id, value)
}

function openMoveFolder(id: string, currentParentId: string | null) {
  folderMoveEditorId.value = id
  folderMoveTargetId.value = currentParentId ?? ROOT_FOLDER_OPTION
  folderDeleteEditorId.value = null
}

function cancelMoveFolder() {
  folderMoveEditorId.value = null
  folderMoveTargetId.value = ROOT_FOLDER_OPTION
}

function confirmMoveFolder() {
  if (!folderMoveEditorId.value) return
  const targetId = folderMoveTargetId.value === ROOT_FOLDER_OPTION ? null : folderMoveTargetId.value
  if (presetStore.moveFolder(folderMoveEditorId.value, targetId)) {
    cancelMoveFolder()
  }
}

function openDeleteFolder(id: string) {
  folderDeleteEditorId.value = id
  folderDeleteStrategy.value = 'reparent'
  folderMoveEditorId.value = null
}

function cancelDeleteFolder() {
  folderDeleteEditorId.value = null
  folderDeleteStrategy.value = 'reparent'
}

function confirmDeleteFolder() {
  if (!folderDeleteEditorId.value) return
  if (presetStore.deleteFolder(folderDeleteEditorId.value, folderDeleteStrategy.value)) {
    cancelDeleteFolder()
  }
}

function folderNameById(id: string) {
  return folderMap.value.get(id)?.name ?? 'Unknown folder'
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

function patternCountFor(preset: SessionPreset) {
  return (preset.sequencer.tracks ?? []).reduce((total, track) => total + (track.patterns?.length ?? 0), 0)
}

function formatDate(value: number) {
  return new Date(value).toLocaleString()
}

function isPresetDropTarget(folderId: string | null) {
  const key = folderId ?? ROOT_PRESET_DROP_TARGET
  return dropTargetFolderKey.value === key
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
  const key = folderId ?? ROOT_PRESET_DROP_TARGET
  if (dropTargetFolderKey.value === key) {
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

<style scoped></style>
