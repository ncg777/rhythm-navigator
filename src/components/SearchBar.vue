<template>
  <div class="flex items-center gap-2">
    <input v-model="local" type="text" placeholder="Search digits, hex/oct/bin…" class="bg-slate-800 border border-white/10 rounded px-3 py-2 w-full" @input="onInput" />
    <button class="px-3 py-2 rounded border border-white/10 hover:bg-white/5" @click="clear" v-if="local.length">Clear</button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const model = defineModel<string>({ default: '' })
const local = ref(model.value)

function onInput() { model.value = local.value }
function clear() { local.value = ''; model.value = '' }

watch(model, (v) => { if (v !== local.value) local.value = v })
</script>