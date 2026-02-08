<script lang="ts">
export default { name: 'PredicateTreeEditor' }
</script>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PredicateNode, PredicateGroup, PredicateLeaf, PredicateId } from '@/types/predicateExpression'
import { ALL_PREDICATE_IDS, PREDICATE_LABELS } from '@/types/predicateExpression'

const props = withDefaults(defineProps<{
  node: PredicateGroup
  removable?: boolean
  depth?: number
}>(), {
  removable: false,
  depth: 0
})

const emit = defineEmits<{
  update: [node: PredicateGroup]
  remove: []
}>()

const addSelection = ref<PredicateId | ''>('')

// Predicate ids already present as direct children of this group
const usedIds = computed(() =>
  new Set(
    props.node.children
      .filter((c): c is PredicateLeaf => c.type === 'predicate')
      .map(c => c.id)
  )
)

const availablePredicates = computed(() =>
  ALL_PREDICATE_IDS.filter(id => !usedIds.value.has(id))
)

/* ── mutations (immutable-style: always emit a new object) ── */

function emitUpdate(children: PredicateNode[]) {
  emit('update', { type: props.node.type, children })
}

function toggleOp() {
  emit('update', {
    type: props.node.type === 'and' ? 'or' : 'and',
    children: [...props.node.children]
  })
}

function updateChild(i: number, child: PredicateNode) {
  const arr = [...props.node.children]
  arr[i] = child
  emitUpdate(arr)
}

function removeChild(i: number) {
  emitUpdate(props.node.children.filter((_, idx) => idx !== i))
}

function addPredicate() {
  if (!addSelection.value) return
  const leaf: PredicateLeaf = { type: 'predicate', id: addSelection.value }
  if (leaf.id === 'ordinal') leaf.params = { n: 4 }
  emitUpdate([...props.node.children, leaf])
  addSelection.value = ''
}

function addGroup() {
  // New sub-group defaults to the opposite operator for convenience
  const child: PredicateGroup = {
    type: props.node.type === 'and' ? 'or' : 'and',
    children: []
  }
  emitUpdate([...props.node.children, child])
}

function updateOrdinalN(i: number, raw: number) {
  const old = props.node.children[i] as PredicateLeaf
  updateChild(i, { ...old, params: { ...old.params, n: Math.max(2, raw || 2) } })
}

function label(id: PredicateId) { return PREDICATE_LABELS[id] }

const borderClass = computed(() =>
  props.node.type === 'and' ? 'border-blue-500/30' : 'border-amber-500/30'
)
const badgeClass = computed(() =>
  props.node.type === 'and'
    ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
    : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
)
const railClass = computed(() =>
  props.node.type === 'and' ? 'border-blue-500/20' : 'border-amber-500/20'
)
</script>

<template>
  <div class="rounded-lg border p-2 space-y-1.5" :class="borderClass">
    <!-- Header -->
    <div class="flex items-center gap-2">
      <button
        class="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide transition-colors"
        :class="badgeClass"
        @click="toggleOp"
        :title="`Switch to ${node.type === 'and' ? 'OR' : 'AND'}`"
      >{{ node.type === 'and' ? 'AND' : 'OR' }}</button>
      <span class="text-[10px] text-slate-500 select-none">{{
        node.type === 'and' ? 'all must pass' : 'any must pass'
      }}</span>
      <button
        v-if="removable"
        class="ml-auto text-slate-500 hover:text-red-400 text-sm leading-none"
        @click="$emit('remove')"
        title="Remove group"
      >&times;</button>
    </div>

    <!-- Children -->
    <div class="space-y-1 pl-3 border-l-2" :class="railClass">
      <template v-for="(child, i) in node.children" :key="i">
        <!-- Nested group -->
        <PredicateTreeEditor
          v-if="child.type === 'and' || child.type === 'or'"
          :node="(child as PredicateGroup)"
          :removable="true"
          :depth="depth + 1"
          @update="updateChild(i, $event)"
          @remove="removeChild(i)"
        />

        <!-- Leaf predicate -->
        <div v-else class="flex items-center gap-2 py-0.5 group/leaf">
          <span class="text-sm text-slate-300">{{ label((child as PredicateLeaf).id) }}</span>

          <!-- Ordinal: inline n parameter -->
          <template v-if="(child as PredicateLeaf).id === 'ordinal'">
            <span class="text-[10px] text-slate-500">n =</span>
            <input
              type="number"
              :value="(child as PredicateLeaf).params?.n ?? 4"
              @input="updateOrdinalN(i, ($event.target as HTMLInputElement).valueAsNumber)"
              min="2"
              class="w-14 bg-slate-800 border border-white/10 rounded px-1.5 py-0.5 text-xs"
            />
          </template>

          <button
            class="ml-auto text-slate-500 hover:text-red-400 text-xs opacity-0 group-hover/leaf:opacity-100 transition-opacity leading-none"
            @click="removeChild(i)"
            title="Remove"
          >&times;</button>
        </div>
      </template>

      <!-- Empty state -->
      <div v-if="node.children.length === 0" class="text-xs text-slate-600 italic py-1 select-none">
        No filters — all rhythms pass
      </div>
    </div>

    <!-- Add controls -->
    <div class="flex items-center gap-2 pl-3 pt-0.5">
      <select
        v-model="addSelection"
        class="bg-slate-800 border border-white/10 rounded px-2 py-1 text-xs flex-1 max-w-[220px]"
      >
        <option value="">+ predicate…</option>
        <option v-for="p in availablePredicates" :key="p" :value="p">{{ label(p) }}</option>
      </select>
      <button
        @click="addPredicate"
        :disabled="!addSelection"
        class="px-2 py-1 text-xs rounded border border-white/10 hover:bg-white/5 disabled:opacity-30 transition"
      >Add</button>
      <button
        v-if="depth < 3"
        @click="addGroup"
        class="px-2 py-1 text-xs rounded border border-white/10 hover:bg-white/5 transition"
        :title="`Add nested ${node.type === 'and' ? 'OR' : 'AND'} group`"
      >+ group</button>
    </div>
  </div>
</template>
