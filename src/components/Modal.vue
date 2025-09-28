<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center" @keydown.esc.prevent.stop="emit('close')" tabindex="-1">
    <div class="fixed inset-0 bg-black/60" @click="emit('close')" aria-hidden="true"></div>
    <div class="glass rounded-lg shadow-xl w-full max-w-5xl max-h-full overflow-y-auto p-4" role="dialog" aria-modal="true">
      <header class="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <slot name="title"><h3 class="text-lg font-semibold">Modal</h3></slot>
        <button class="px-2 py-1 text-sm rounded border border-white/10 hover:bg-white/5" @click="emit('close')">Close</button>
      </header>
      <div class="p-4">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()
</script>

<style scoped>
.fixed.inset-0 {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
