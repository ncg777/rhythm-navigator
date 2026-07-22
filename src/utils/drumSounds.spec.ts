import { describe, expect, it } from 'vitest'
import { automaticTrackLabels, sortTracksByMidiKey } from '@/utils/drumSounds'

describe('track presentation helpers', () => {
  it('orders tracks by General MIDI key without mutating source order', () => {
    const tracks = [
      { id: 'crash', type: 'crash' as const },
      { id: 'kick', type: 'kick' as const },
      { id: 'snare', type: 'snare' as const }
    ]

    expect(sortTracksByMidiKey(tracks).map((track) => track.id)).toEqual(['kick', 'snare', 'crash'])
    expect(tracks.map((track) => track.id)).toEqual(['crash', 'kick', 'snare'])
  })

  it('uses stable source order for tracks with equal MIDI keys', () => {
    const tracks = [
      { id: 'hat-2', type: 'hat' as const },
      { id: 'hat-1', type: 'hat' as const }
    ]

    expect(sortTracksByMidiKey(tracks).map((track) => track.id)).toEqual(['hat-2', 'hat-1'])
  })

  it('uses plain labels for unique sounds and numbered labels for duplicates', () => {
    const labels = automaticTrackLabels([
      { id: 'kick', type: 'kick' as const },
      { id: 'hat-1', type: 'hat' as const },
      { id: 'hat-2', type: 'hat' as const }
    ])

    expect(labels.get('kick')).toBe('Kick')
    expect(labels.get('hat-1')).toBe('Closed Hi-Hat 1')
    expect(labels.get('hat-2')).toBe('Closed Hi-Hat 2')
  })
})