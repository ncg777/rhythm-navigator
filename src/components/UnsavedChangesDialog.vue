<template>
  <Modal :open="open" @close="emit('cancel')">
    <template #title>
      <h3 class="text-lg font-semibold">Unsaved Changes</h3>
    </template>

    <div class="space-y-4">
      <p class="text-sm text-slate-200">
        The current preset has unsaved changes. Save before continuing, discard the changes, or cancel.
      </p>

      <div class="flex flex-wrap justify-end gap-2">
        <button class="px-3 py-2 rounded border border-white/10 hover:bg-white/5" @click="emit('cancel')">Cancel</button>
        <button class="px-3 py-2 rounded border border-white/10 hover:bg-white/5" @click="emit('discard')">Discard and continue</button>
        <button class="px-3 py-2 rounded border border-brand-500/40 hover:bg-brand-500/10" @click="emit('save')">Save and continue</button>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import Modal from '@/components/Modal.vue'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (event: 'save'): void
  (event: 'discard'): void
  (event: 'cancel'): void
}>()
</script>

<style scoped></style>