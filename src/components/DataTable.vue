<template>
  <div class="data-table" :class="{ 'data-table--compact': compact }">
    <!-- Toolbar: global search + actions -->
    <div class="dt-toolbar">
      <slot name="toolbar-start" />
      <div class="dt-search">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="dt-search-icon">
          <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clip-rule="evenodd" />
        </svg>
        <input
          v-model="globalSearch"
          type="text"
          placeholder="Search all columns…"
          class="dt-search-input"
        />
        <button v-if="globalSearch" class="dt-search-clear" @click="globalSearch = ''" title="Clear search">×</button>
      </div>
      <slot name="toolbar-end" />
    </div>

    <!-- Sort chips -->
    <div v-if="sortLevels.length" class="dt-sort-chips">
      <span class="dt-sort-label">Sort:</span>
      <button
        v-for="(sl, idx) in sortLevels"
        :key="sl.key"
        class="dt-chip"
        @click="removeSortLevel(idx)"
        :title="'Click to remove sort on ' + columnByKey(sl.key)?.label"
      >
        <span class="dt-chip-num">{{ idx + 1 }}</span>
        {{ columnByKey(sl.key)?.label }}
        <span class="dt-chip-dir">{{ sl.dir === 'asc' ? '↑' : '↓' }}</span>
        <span class="dt-chip-x">×</span>
      </button>
      <button class="dt-chip dt-chip--clear" @click="sortLevels = []" title="Clear all sorts">Clear all</button>
    </div>

    <!-- Desktop table view -->
    <div class="dt-table-wrap hidden sm:block" ref="desktopViewport" @scroll="onDesktopScroll">
      <table class="dt-table">
        <thead class="dt-thead">
          <tr>
            <th
              v-for="col in visibleColumns"
              :key="col.key"
              class="dt-th"
              :class="{ 'dt-th--sortable': col.sortable !== false, 'dt-th--sorted': sortIndexOf(col.key) >= 0 }"
              :style="col.width ? { width: col.width, minWidth: col.width } : {}"
            >
              <div class="dt-th-inner" @click="col.sortable !== false && toggleSort(col.key)">
                <span class="dt-th-label">{{ col.label }}</span>
                <span v-if="sortIndexOf(col.key) >= 0" class="dt-th-sort-indicator">
                  <span class="dt-sort-badge">{{ sortIndexOf(col.key) + 1 }}</span>
                  {{ sortDirOf(col.key) === 'asc' ? '↑' : '↓' }}
                </span>
              </div>
              <!-- Column filter -->
              <div v-if="col.filterable !== false" class="dt-th-filter">
                <input
                  v-model="columnFilters[col.key]"
                  type="text"
                  :placeholder="'Filter…'"
                  class="dt-filter-input"
                  @click.stop
                />
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="desktopTopPad > 0" class="dt-spacer-row" aria-hidden="true">
            <td :colspan="visibleColumns.length" class="dt-spacer-cell" :style="{ height: desktopTopPad + 'px' }"></td>
          </tr>
          <tr
            v-for="row in desktopVisibleRows"
            :key="rowKey(row)"
            class="dt-row"
            :class="{ 'dt-row--selected': isSelected(row) }"
            @click="$emit('row-click', row)"
            :style="{ height: rowHeight + 'px' }"
          >
            <td
              v-for="col in visibleColumns"
              :key="col.key"
              class="dt-td"
              :class="col.cellClass"
              :style="col.width ? { width: col.width, minWidth: col.width } : {}"
              :title="String(getCellValue(row, col))"
            >
              <slot :name="'cell-' + col.key" :row="row" :value="getCellValue(row, col)">
                {{ formatCell(row, col) }}
              </slot>
            </td>
          </tr>
          <tr v-if="desktopBottomPad > 0" class="dt-spacer-row" aria-hidden="true">
            <td :colspan="visibleColumns.length" class="dt-spacer-cell" :style="{ height: desktopBottomPad + 'px' }"></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Mobile card view -->
    <div class="dt-mobile-wrap sm:hidden" ref="mobileViewport" @scroll="onMobileScroll">
      <div :style="{ height: mobileTopPad + 'px' }" v-if="mobileTopPad > 0"></div>
      <div
        v-for="row in mobileVisibleRows"
        :key="rowKey(row)"
        class="dt-card"
        :class="{ 'dt-card--selected': isSelected(row) }"
        :style="{ height: mobileRH + 'px' }"
        @click="$emit('row-click', row)"
      >
        <div class="dt-card-grid">
          <template v-for="col in visibleColumns" :key="col.key">
            <div class="dt-card-label">{{ col.label }}</div>
            <div class="dt-card-value" :class="col.cellClass" :title="String(getCellValue(row, col))">
              <slot :name="'cell-' + col.key" :row="row" :value="getCellValue(row, col)">
                {{ formatCell(row, col) }}
              </slot>
            </div>
          </template>
        </div>
      </div>
      <div :style="{ height: mobileBottomPad + 'px' }" v-if="mobileBottomPad > 0"></div>
    </div>

    <!-- Footer -->
    <div class="dt-footer">
      <span class="dt-count">{{ processedRows.length }} of {{ totalRows }} rows</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount, type PropType } from 'vue'

export type ColumnDef = {
  key: string
  label: string
  sortable?: boolean
  filterable?: boolean
  width?: string
  cellClass?: string
  /** Extract a raw value from the row for sorting/filtering. Defaults to row[key]. */
  getValue?: (row: any) => any
  /** Format for display. Defaults to String(value). */
  format?: (value: any, row: any) => string
  /** Numeric column — sorts numerically instead of lexically. */
  numeric?: boolean
}

type SortLevel = { key: string; dir: 'asc' | 'desc' }

const props = defineProps({
  columns: { type: Array as PropType<ColumnDef[]>, required: true },
  rows: { type: Array as PropType<any[]>, required: true },
  rowKeyField: { type: String, default: 'id' },
  selectedKey: { type: String, default: '' },
  rowHeight: { type: Number, default: 36 },
  mobileRowHeight: { type: Number, default: 0 },
  compact: { type: Boolean, default: false },
})

const emit = defineEmits<{
  (e: 'row-click', row: any): void
}>()

// ─── State ──────────────────────────────────────────────────────
const globalSearch = ref('')
const columnFilters = ref<Record<string, string>>({})
const sortLevels = ref<SortLevel[]>([])

// ─── Helpers ────────────────────────────────────────────────────
const visibleColumns = computed(() => props.columns)
const totalRows = computed(() => props.rows.length)

function columnByKey(k: string) { return props.columns.find(c => c.key === k) }

function getCellValue(row: any, col: ColumnDef): any {
  return col.getValue ? col.getValue(row) : row[col.key]
}
function formatCell(row: any, col: ColumnDef): string {
  const v = getCellValue(row, col)
  if (col.format) return col.format(v, row)
  if (v === null || v === undefined) return ''
  return String(v)
}
function rowKey(row: any): string { return row[props.rowKeyField] ?? '' }
function isSelected(row: any): boolean { return props.selectedKey !== '' && rowKey(row) === props.selectedKey }

// ─── Filtering ──────────────────────────────────────────────────
const filteredRows = computed(() => {
  let data = props.rows
  const gs = globalSearch.value.trim().toLowerCase()

  // Global search
  if (gs) {
    data = data.filter(row =>
      visibleColumns.value.some(col => {
        const v = getCellValue(row, col)
        return v !== null && v !== undefined && String(v).toLowerCase().includes(gs)
      })
    )
  }

  // Per-column filters
  for (const col of visibleColumns.value) {
    const fv = (columnFilters.value[col.key] ?? '').trim().toLowerCase()
    if (!fv) continue
    data = data.filter(row => {
      const v = getCellValue(row, col)
      return v !== null && v !== undefined && String(v).toLowerCase().includes(fv)
    })
  }

  return data
})

// ─── Sorting ────────────────────────────────────────────────────
function sortIndexOf(key: string): number { return sortLevels.value.findIndex(s => s.key === key) }
function sortDirOf(key: string): 'asc' | 'desc' | null {
  const s = sortLevels.value.find(s => s.key === key)
  return s ? s.dir : null
}

function toggleSort(key: string) {
  const idx = sortIndexOf(key)
  if (idx < 0) {
    sortLevels.value = [...sortLevels.value, { key, dir: 'asc' }]
  } else if (sortLevels.value[idx].dir === 'asc') {
    const arr = [...sortLevels.value]
    arr[idx] = { key, dir: 'desc' }
    sortLevels.value = arr
  } else {
    sortLevels.value = sortLevels.value.filter((_, i) => i !== idx)
  }
}
function removeSortLevel(idx: number) {
  sortLevels.value = sortLevels.value.filter((_, i) => i !== idx)
}

function compareValues(a: any, b: any, numeric: boolean): number {
  if (a === b) return 0
  if (a === null || a === undefined) return -1
  if (b === null || b === undefined) return 1
  if (numeric) {
    const na = Number(a), nb = Number(b)
    if (!isNaN(na) && !isNaN(nb)) return na - nb
  }
  const sa = String(a), sb = String(b)
  return sa < sb ? -1 : sa > sb ? 1 : 0
}

const processedRows = computed(() => {
  const data = filteredRows.value.slice()
  if (!sortLevels.value.length) return data

  data.sort((a, b) => {
    for (const sl of sortLevels.value) {
      const col = columnByKey(sl.key)
      if (!col) continue
      const va = getCellValue(a, col)
      const vb = getCellValue(b, col)
      const cmp = compareValues(va, vb, col.numeric === true)
      if (cmp !== 0) return sl.dir === 'asc' ? cmp : -cmp
    }
    return 0
  })
  return data
})

// ─── Virtual scrolling (desktop) ───────────────────────────────
// Number of extra rows rendered above/below the visible viewport for smooth scrolling
const BUFFER = 15
const desktopViewport = ref<HTMLElement | null>(null)
const desktopScrollTop = ref(0)
const desktopViewportHeight = ref(600)

const desktopStartIdx = computed(() => Math.max(0, Math.floor(desktopScrollTop.value / props.rowHeight) - BUFFER))
const desktopVisibleCount = computed(() => Math.ceil(desktopViewportHeight.value / props.rowHeight) + BUFFER * 2)
const desktopEndIdx = computed(() => Math.min(processedRows.value.length, desktopStartIdx.value + desktopVisibleCount.value))
const desktopVisibleRows = computed(() => processedRows.value.slice(desktopStartIdx.value, desktopEndIdx.value))
const desktopTopPad = computed(() => desktopStartIdx.value * props.rowHeight)
const desktopBottomPad = computed(() => Math.max(0, (processedRows.value.length - desktopEndIdx.value) * props.rowHeight))

function onDesktopScroll() {
  if (!desktopViewport.value) return
  desktopScrollTop.value = desktopViewport.value.scrollTop
}

// ─── Virtual scrolling (mobile) ────────────────────────────────
const MOBILE_ROW_HEIGHT_DEFAULT = 140
// Gap between mobile cards in px — must match the margin-bottom on .dt-card in CSS
const MOBILE_CARD_GAP = 8
const mobileRH = computed(() => props.mobileRowHeight || MOBILE_ROW_HEIGHT_DEFAULT)
// Effective per-row height includes the card's margin-bottom so spacer calculations
// match the actual scroll position, preventing drift past the first screenful.
const mobileEffRH = computed(() => mobileRH.value + MOBILE_CARD_GAP)
const mobileViewport = ref<HTMLElement | null>(null)
const mobileScrollTop = ref(0)
const mobileViewportHeight = ref(600)

const mobileStartIdx = computed(() => Math.max(0, Math.floor(mobileScrollTop.value / mobileEffRH.value) - BUFFER))
const mobileVisibleCount = computed(() => Math.ceil(mobileViewportHeight.value / mobileEffRH.value) + BUFFER * 2)
const mobileEndIdx = computed(() => Math.min(processedRows.value.length, mobileStartIdx.value + mobileVisibleCount.value))
const mobileVisibleRows = computed(() => processedRows.value.slice(mobileStartIdx.value, mobileEndIdx.value))
const mobileTopPad = computed(() => mobileStartIdx.value * mobileEffRH.value)
const mobileBottomPad = computed(() => Math.max(0, (processedRows.value.length - mobileEndIdx.value) * mobileEffRH.value))

function onMobileScroll() {
  if (!mobileViewport.value) return
  mobileScrollTop.value = mobileViewport.value.scrollTop
}

// ─── ResizeObserver ─────────────────────────────────────────────
let ro: ResizeObserver | null = null
function handleResize() {
  if (desktopViewport.value) desktopViewportHeight.value = desktopViewport.value.clientHeight
  if (mobileViewport.value) mobileViewportHeight.value = mobileViewport.value.clientHeight
}

onMounted(() => {
  handleResize()
  ro = new ResizeObserver(handleResize)
  if (desktopViewport.value) ro.observe(desktopViewport.value)
  if (mobileViewport.value) ro.observe(mobileViewport.value)
})

onBeforeUnmount(() => {
  if (ro) {
    if (desktopViewport.value) ro.unobserve(desktopViewport.value)
    if (mobileViewport.value) ro.unobserve(mobileViewport.value)
    ro = null
  }
})

// Reset scroll when data changes significantly
watch(() => processedRows.value.length, () => {
  if (desktopViewport.value) desktopViewport.value.scrollTop = 0
  if (mobileViewport.value) mobileViewport.value.scrollTop = 0
  desktopScrollTop.value = 0
  mobileScrollTop.value = 0
})

// Expose processed rows so parent can access sorted/filtered data (e.g. for CSV export)
defineExpose({ processedRows })
</script>

<style scoped>
/* ─── Variables ──────────────────────────────────────────────── */
.data-table {
  --dt-bg: rgba(15, 23, 42, 0.6);
  --dt-border: rgba(255, 255, 255, 0.08);
  --dt-border-strong: rgba(255, 255, 255, 0.12);
  --dt-header-bg: rgba(30, 41, 59, 0.8);
  --dt-row-hover: rgba(255, 255, 255, 0.04);
  --dt-row-selected: rgba(14, 165, 233, 0.12);
  --dt-text: #e2e8f0;
  --dt-text-muted: #94a3b8;
  --dt-text-dim: #64748b;
  --dt-accent: #38bdf8;
  --dt-accent-soft: rgba(56, 189, 248, 0.15);
  --dt-radius: 0.5rem;
  font-size: 0.8125rem;
  color: var(--dt-text);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* ─── Toolbar ────────────────────────────────────────────────── */
.dt-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}
.dt-search {
  position: relative;
  flex: 1;
  min-width: 180px;
  max-width: 360px;
}
.dt-search-icon {
  position: absolute;
  left: 0.625rem;
  top: 50%;
  transform: translateY(-50%);
  width: 0.875rem;
  height: 0.875rem;
  color: var(--dt-text-dim);
  pointer-events: none;
}
.dt-search-input {
  width: 100%;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid var(--dt-border);
  border-radius: var(--dt-radius);
  padding: 0.4375rem 2rem 0.4375rem 2rem;
  color: var(--dt-text);
  font-size: 0.8125rem;
  transition: border-color 0.15s;
}
.dt-search-input:focus {
  outline: none;
  border-color: var(--dt-accent);
  box-shadow: 0 0 0 1px var(--dt-accent-soft);
}
.dt-search-input::placeholder { color: var(--dt-text-dim); }
.dt-search-clear {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--dt-text-muted);
  font-size: 1rem;
  cursor: pointer;
  line-height: 1;
  padding: 0 0.25rem;
}

/* ─── Sort Chips ─────────────────────────────────────────────── */
.dt-sort-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
}
.dt-sort-label {
  font-size: 0.6875rem;
  color: var(--dt-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.dt-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.1875rem 0.5rem;
  font-size: 0.6875rem;
  border-radius: 999px;
  border: 1px solid var(--dt-border-strong);
  background: var(--dt-accent-soft);
  color: var(--dt-accent);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.dt-chip:hover { background: rgba(56, 189, 248, 0.25); }
.dt-chip-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: var(--dt-accent);
  color: #0f172a;
  font-weight: 700;
  font-size: 0.625rem;
}
.dt-chip-dir { font-weight: 600; }
.dt-chip-x { font-size: 0.75rem; opacity: 0.6; margin-left: 0.125rem; }
.dt-chip--clear {
  background: transparent;
  color: var(--dt-text-dim);
  border-color: var(--dt-border);
}
.dt-chip--clear:hover { color: var(--dt-text-muted); background: var(--dt-row-hover); }

/* ─── Desktop Table ──────────────────────────────────────────── */
.dt-table-wrap {
  overflow: auto;
  border: 1px solid var(--dt-border);
  border-radius: var(--dt-radius);
  max-height: 65vh;
}
.dt-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.dt-thead {
  position: sticky;
  top: 0;
  z-index: 2;
}
.dt-th {
  background: var(--dt-header-bg);
  border-bottom: 1px solid var(--dt-border-strong);
  padding: 0;
  text-align: left;
  font-weight: 600;
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--dt-text-muted);
  user-select: none;
  vertical-align: top;
}
.dt-th--sortable { cursor: pointer; }
.dt-th--sortable:hover .dt-th-label { color: var(--dt-accent); }
.dt-th--sorted .dt-th-label { color: var(--dt-accent); }
.dt-th-inner {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.625rem 0.25rem;
  white-space: nowrap;
}
.dt-th-sort-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
  font-size: 0.625rem;
  color: var(--dt-accent);
}
.dt-sort-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 50%;
  background: var(--dt-accent);
  color: #0f172a;
  font-weight: 700;
  font-size: 0.5625rem;
}
.dt-th-filter {
  padding: 0.125rem 0.5rem 0.375rem;
}
.dt-filter-input {
  width: 100%;
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid var(--dt-border);
  border-radius: 0.25rem;
  padding: 0.25rem 0.375rem;
  color: var(--dt-text);
  font-size: 0.6875rem;
  transition: border-color 0.15s;
}
.dt-filter-input:focus {
  outline: none;
  border-color: var(--dt-accent);
}
.dt-filter-input::placeholder { color: var(--dt-text-dim); }

/* ─── Rows ───────────────────────────────────────────────────── */
.dt-row {
  border-bottom: 1px solid var(--dt-border);
  transition: background 0.1s;
  cursor: pointer;
}
.dt-row:hover { background: var(--dt-row-hover); }
.dt-row--selected {
  background: var(--dt-row-selected) !important;
  box-shadow: inset 2px 0 0 var(--dt-accent);
}
.dt-td {
  padding: 0 0.625rem;
  white-space: nowrap;
  vertical-align: middle;
  line-height: 1;
}
.dt-spacer-row { pointer-events: none; }
.dt-spacer-cell {
  padding: 0;
  border: 0;
  font-size: 0;
  line-height: 0;
}

/* ─── Mobile Cards ───────────────────────────────────────────── */
.dt-mobile-wrap {
  overflow-y: auto;
  max-height: 65vh;
  display: flex;
  flex-direction: column;
  padding: 0.25rem;
}
.dt-card {
  border: 1px solid var(--dt-border);
  border-radius: var(--dt-radius);
  padding: 0.75rem;
  background: var(--dt-bg);
  cursor: pointer;
  transition: all 0.15s;
  /* 0.5rem matches MOBILE_CARD_GAP (8 px) in the virtual-scroll JS */
  margin-bottom: 0.5rem;
  overflow: hidden;
}
.dt-card:hover { border-color: var(--dt-border-strong); background: var(--dt-row-hover); }
.dt-card--selected {
  border-color: var(--dt-accent);
  background: var(--dt-row-selected);
  box-shadow: 0 0 0 1px var(--dt-accent-soft);
}
.dt-card-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.25rem 0.75rem;
  font-size: 0.75rem;
}
.dt-card-label {
  color: var(--dt-text-dim);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 0.625rem;
  padding-top: 0.125rem;
}
.dt-card-value {
  color: var(--dt-text);
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  white-space: normal;
  word-break: break-word;
}

/* ─── Footer ─────────────────────────────────────────────────── */
.dt-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.25rem 0;
}
.dt-count {
  font-size: 0.6875rem;
  color: var(--dt-text-dim);
}
</style>
