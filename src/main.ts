import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'
import { useComparisonStore } from '@/stores/comparisonStore'
import { useRhythmStore } from '@/stores/rhythmStore'
import { useSequencerStore } from '@/stores/sequencerStore'
import { usePresetStore } from '@/stores/presetStore'

const app = createApp(App)
app.use(createPinia())
// Initialize stores and load persisted state before mount
try {
	const rhythm = useRhythmStore()
	rhythm.initPersistence()
	useComparisonStore().initPersistence(rhythm.items.map((item) => item.id))
} catch {}
try {
	const seq = useSequencerStore()
	seq.loadFromStorage()
} catch {}
try {
	const presets = usePresetStore()
	presets.initPersistence()
} catch {}
app.mount('#app')