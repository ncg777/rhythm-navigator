import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'
import { useRhythmStore } from '@/stores/rhythmStore'
import { useSequencerStore } from '@/stores/sequencerStore'

const app = createApp(App)
app.use(createPinia())
// Initialize stores and load persisted state before mount
try {
	const rhythm = useRhythmStore()
	rhythm.initPersistence()
} catch {}
try {
	const seq = useSequencerStore()
	seq.loadFromStorage()
} catch {}
app.mount('#app')