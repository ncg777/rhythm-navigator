import { describe, expect, it } from 'vitest'
import {
  PRESET_LIBRARY_VERSION,
  normalizePresetName,
  parsePresetLibraryJson
} from '@/utils/presetLibrary'

describe('presetLibrary', () => {
  it('normalizes blank names', () => {
    expect(normalizePresetName('   ')).toBe('Untitled preset')
    expect(normalizePresetName('  Session A  ')).toBe('Session A')
  })

  it('parses a preset library and preserves clap tracks', () => {
    const library = parsePresetLibraryJson(JSON.stringify({
      version: PRESET_LIBRARY_VERSION,
      presets: [
        {
          id: 'preset-1',
          name: '  Clap Session  ',
          createdAt: 1,
          updatedAt: 2,
          rhythm: {
            mode: 'hex',
            numerator: 4,
            denominator: 1,
            items: [],
            selectedId: ''
          },
          sequencer: {
            bpm: 128,
            loopBars: 4,
            tracks: [
              {
                id: 'track-1',
                name: 'Clap',
                type: 'clap',
                volume: 0.8,
                pan: 0,
                velocity: 0.9,
                velRandom: 0.1,
                timeScale: 1,
                noteLength: 0.5,
                params: { midiKey: 39, snap: 0.85 },
                patterns: []
              }
            ]
          }
        }
      ]
    }))

    expect(library.presets).toHaveLength(1)
    expect(library.presets[0].name).toBe('Clap Session')
    expect(library.presets[0].sequencer.tracks?.[0]?.type).toBe('clap')
    expect(library.presets[0].sequencer.bpm).toBe(128)
  })

  it('rejects unsupported preset library versions', () => {
    expect(() => parsePresetLibraryJson(JSON.stringify({ version: 99, presets: [] }))).toThrow(
      /Unsupported preset library version/
    )
  })
})