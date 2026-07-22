<template>
  <Modal :open="open" @close="emit('close')">
    <template #title>
      <h3 class="text-lg font-semibold">Create New Preset</h3>
    </template>

    <div class="space-y-4">
      <label class="block text-xs uppercase tracking-wide text-slate-400">Preset name</label>
      <input
        ref="nameInput"
        v-model="name"
        type="text"
        class="w-full bg-slate-800 border border-white/10 rounded px-3 py-2"
        placeholder="Named preset"
        @keydown.enter.prevent="onPrimaryAction"
      />

      <div
        v-if="isDirty"
        class="rounded-md border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100"
      >
        Current preset has unsaved changes. Choose how to proceed before creating a new default preset.
      </div>

      <div class="flex flex-wrap gap-2 justify-end">
        <button class="px-3 py-2 rounded border border-white/10 hover:bg-white/5" @click="emit('close')">Cancel</button>
        <template v-if="isDirty">
          <button class="px-3 py-2 rounded border border-white/10 hover:bg-white/5" @click="emit('discard-and-create', name)">Discard and create</button>
          <button class="px-3 py-2 rounded border border-brand-500/40 hover:bg-brand-500/10" @click="emit('save-and-create', name)">Save and create</button>
        </template>
        <button
          v-else
          class="px-3 py-2 rounded border border-brand-500/40 hover:bg-brand-500/10"
          @click="emit('create', name)"
        >
          Create preset
        </button>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import Modal from '@/components/Modal.vue'

const props = defineProps<{
  open: boolean
  initialName: string
  isDirty: boolean
}>()

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'create', name: string): void
  (event: 'save-and-create', name: string): void
  (event: 'discard-and-create', name: string): void
}>()

const name = ref('')
const nameInput = ref<HTMLInputElement | null>(null)

watch(
  () => [props.open, props.initialName] as const,
  ([open, initialName]) => {
    if (!open) return
    name.value = initialName
    void nextTick(() => {
      nameInput.value?.focus()
      nameInput.value?.select()
    })
  },
  { immediate: true }
)

function onPrimaryAction() {
  if (props.isDirty) {
    emit('save-and-create', name.value)
    return
  }
  emit('create', name.value)
}
</script>

<style scoped></style>