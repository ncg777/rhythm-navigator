<template>
  <div v-if="open" class="fixed inset-0 z-50" @keydown.esc.prevent.stop="emit('close')" tabindex="-1">
    <div class="absolute inset-0 bg-black/60" @click="emit('close')" aria-hidden="true"></div>
    <div class="absolute inset-0 flex items-start justify-center p-4 overflow-auto">
      <div class="glass rounded-lg shadow-xl w-full max-w-5xl mt-10" role="dialog" aria-modal="true">
        <header class="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <slot name="title"><h3 class="text-lg font-semibold">Modal</h3></slot>
          <button class="px-2 py-1 text-sm rounded border border-white/10 hover:bg-white/5" @click="emit('close')">Close</button>
        </header>
        <div class="p-4">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()
</script>

<style scoped></style>
