import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function normalizeAppliedSnapshot(snapshot: any) {
  const cloned = deepClone(snapshot ?? {})
  const tracks = Array.isArray(cloned.tracks) ? cloned.tracks : []
  cloned.tracks = tracks.map((track: any) => ({
    ...track,
    params: {
      normalizedDefault: 1,
      ...(track?.params ?? {})
    }
  }))
  return cloned
}

const DEFAULT_SESSION = {
  bpm: 120,
  loopBars: 4,
  swingPercent: 0,
  swingGrid: 'eighth',
  tracks: [
    {
      id: 'track-1',
      type: 'kick',
      volume: 0.8,
      pan: 0,
      velocity: 0.8,
      velRandom: 0,
      timeScale: 1,
      noteLength: 0.5,
      params: {},
      patterns: []
    }
  ]
}

const currentSession = ref(normalizeAppliedSnapshot(DEFAULT_SESSION))

const sequencerMock = {
  captureSessionState: vi.fn(() => deepClone(currentSession.value)),
  applySessionState: vi.fn((snapshot: any) => {
    currentSession.value = normalizeAppliedSnapshot(snapshot)
  }),
  createDefaultSessionSnapshot: vi.fn(() => normalizeAppliedSnapshot(DEFAULT_SESSION))
}

const uiMock = {
  pushToast: vi.fn()
}

vi.mock('@/stores/sequencerStore', () => ({
  useSequencerStore: () => sequencerMock
}))

vi.mock('@/stores/uiStore', () => ({
  useUiStore: () => uiMock
}))

import { usePresetStore } from '@/stores/presetStore'

class LocalStorageMock {
  private readonly storage = new Map<string, string>()

  getItem(key: string): string | null {
    return this.storage.has(key) ? this.storage.get(key)! : null
  }

  setItem(key: string, value: string): void {
    this.storage.set(key, String(value))
  }

  removeItem(key: string): void {
    this.storage.delete(key)
  }

  clear(): void {
    this.storage.clear()
  }
}

function seedSinglePreset(store: ReturnType<typeof usePresetStore>) {
  store.presets = [
    {
      id: 'preset-1',
      name: 'Test preset',
      folderId: null,
      order: 0,
      createdAt: 1,
      updatedAt: 1,
      sequencer: {
        ...deepClone(DEFAULT_SESSION),
        tracks: [
          {
            ...deepClone(DEFAULT_SESSION.tracks[0]),
            params: {}
          }
        ]
      }
    }
  ] as any
  store.folders = []
  store.activePresetId = ''
}

describe('presetStore dirty baseline', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentSession.value = normalizeAppliedSnapshot(DEFAULT_SESSION)
    sequencerMock.captureSessionState.mockClear()
    sequencerMock.applySessionState.mockClear()
    sequencerMock.createDefaultSessionSnapshot.mockClear()
    uiMock.pushToast.mockClear()
    Object.defineProperty(globalThis, 'localStorage', {
      value: new LocalStorageMock(),
      configurable: true
    })
  })

  it('keeps loaded preset clean after sequencer normalization', () => {
    const store = usePresetStore()
    seedSinglePreset(store)

    const loaded = store.loadPreset('preset-1')

    expect(loaded).toBe(true)
    expect(store.activePresetId).toBe('preset-1')
    expect(store.isDirty).toBe(false)
    expect(store.dirtyState).toBe('clean')
    expect(store.canSaveActive).toBe(false)
  })

  it('returns to clean state after restoreActivePreset', () => {
    const store = usePresetStore()
    seedSinglePreset(store)
    store.loadPreset('preset-1')

    currentSession.value = {
      ...deepClone(currentSession.value),
      bpm: 136
    }

    expect(store.isDirty).toBe(true)
    expect(store.dirtyState).toBe('modified')

    const restored = store.restoreActivePreset()

    expect(restored).toBe(true)
    expect(store.isDirty).toBe(false)
    expect(store.dirtyState).toBe('clean')
  })
})