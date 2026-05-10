<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div class="flex-1">
        <label class="block text-xs uppercase tracking-wide text-slate-400">Save current session as preset</label>
        <div class="mt-1 flex flex-col gap-2 sm:flex-row">
          <input
            v-model="presetName"
            type="text"
            class="flex-1 bg-slate-800 border border-white/10 rounded px-3 py-2"
            placeholder="Named preset"
            @keydown.enter.prevent="onSave"
          />
          <button class="px-4 py-2 rounded-md bg-brand-600 hover:bg-brand-500 transition" @click="onSave">
            Save preset
          </button>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button class="px-4 py-2 rounded-md border border-white/10 hover:bg-white/5 transition" @click="presetStore.exportLibrary()">
          Export library
        </button>
        <label class="px-4 py-2 rounded-md border border-white/10 hover:bg-white/5 transition cursor-pointer">
          Import library
          <input type="file" accept="application/json" class="hidden" @change="onImportLibrary" />
        </label>
      </div>
    </div>

    <div class="text-xs text-slate-500">
      Import replaces the current preset library.
    </div>

    <div v-if="!presets.length" class="rounded-lg border border-dashed border-white/10 p-6 text-sm text-slate-500">
      No saved presets yet.
    </div>

    <div v-else class="space-y-3">
      <article
        v-for="preset in presets"
        :key="preset.id"
        class="rounded-lg border p-4"
        :class="preset.id === activePresetId ? 'border-brand-500/60 bg-brand-500/10' : 'border-white/10 bg-slate-900/40'"
      >
        <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div class="flex-1 min-w-0 space-y-2">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-semibold text-slate-100">{{ preset.name }}</span>
              <span v-if="preset.id === activePresetId" class="text-[10px] uppercase tracking-wide text-brand-300">Active</span>
            </div>
            <div class="text-xs text-slate-500 flex flex-wrap gap-3">
              <span>{{ preset.sequencer.tracks?.length ?? 0 }} track(s)</span>
              <span>{{ preset.rhythm.items?.length ?? 0 }} rhythm(s)</span>
              <span>Updated {{ formatDate(preset.updatedAt) }}</span>
            </div>
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                :value="draftFor(preset.id, preset.name)"
                type="text"
                class="flex-1 bg-slate-800 border border-white/10 rounded px-3 py-2"
                @input="setDraft(preset.id, $event)"
                @keydown.enter.prevent="onRename(preset.id, preset.name)"
              />
              <button class="px-3 py-2 rounded border border-white/10 hover:bg-white/5 transition" @click="onRename(preset.id, preset.name)">
                Rename
              </button>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button class="px-3 py-2 rounded border border-white/10 hover:bg-white/5 transition" @click="presetStore.loadPreset(preset.id)">
              Load
            </button>
            <button class="px-3 py-2 rounded border border-red-500/30 hover:bg-red-500/10 transition" @click="presetStore.deletePreset(preset.id)">
              Delete
            </button>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { usePresetStore } from '@/stores/presetStore'

const presetStore = usePresetStore()
const { presets, activePresetId } = storeToRefs(presetStore)

const presetName = ref('')
const renameDrafts = ref<Record<string, string>>({})

function draftFor(id: string, fallback: string) {
  return renameDrafts.value[id] ?? fallback
}

function setDraft(id: string, event: Event) {
  renameDrafts.value = {
    ...renameDrafts.value,
    [id]: (event.target as HTMLInputElement).value
  }
}

function onSave() {
  const preset = presetStore.saveCurrentAsPreset(presetName.value)
  presetName.value = ''
  renameDrafts.value = {
    ...renameDrafts.value,
    [preset.id]: preset.name
  }
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

function formatDate(value: number) {
  return new Date(value).toLocaleString()
}
</script>

<style scoped></style>