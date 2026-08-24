const TICKS_PER_QUARTER_NOTE = 960
const MAX_LOOP_TICKS = 256 * 4 * TICKS_PER_QUARTER_NOTE

export type CombinedSequencePattern = {
  totalBits: number
  spb: number
  onsets: number[]
  cycleQN: number
}

export type CombinedSequenceTrack = {
  timeScale: number
  patterns: Array<{
    pattern: CombinedSequencePattern
    repeats: number
  }>
}

export type CombinedDrumSequence = {
  denominator: number
  loopQuarterNotes: number
  masks: bigint[]
  sequence: string
}

function gcdInt(a: number, b: number): number {
  let left = Math.abs(Math.round(a))
  let right = Math.abs(Math.round(b))
  while (right) {
    const remainder = left % right
    left = right
    right = remainder
  }
  return left || 1
}

function lcmInt(a: number, b: number): number {
  if (!a || !b) return 0
  return Math.abs(Math.round(a / gcdInt(a, b) * b))
}

function trackChainTicks(track: CombinedSequenceTrack): number {
  const timeScale = track.timeScale || 1
  const quarterNotes = track.patterns.reduce(
    (sum, entry) => sum + entry.pattern.cycleQN * entry.repeats * timeScale,
    0
  )
  return Math.round(quarterNotes * TICKS_PER_QUARTER_NOTE)
}

export function resolveCombinedLoopTicks(tracks: readonly CombinedSequenceTrack[]): number {
  const chainTicks = tracks.map(trackChainTicks).filter((ticks) => ticks > 0)
  if (!chainTicks.length) return 0

  let loopTicks = chainTicks[0]
  for (let index = 1; index < chainTicks.length; index++) {
    const next = lcmInt(loopTicks, chainTicks[index])
    if (!Number.isFinite(next) || next <= 0 || next > MAX_LOOP_TICKS) {
      return Math.max(...chainTicks)
    }
    loopTicks = next
  }
  return loopTicks
}

export function buildCombinedDrumSequence(
  tracks: readonly CombinedSequenceTrack[]
): CombinedDrumSequence {
  const loopTicks = resolveCombinedLoopTicks(tracks)
  if (!loopTicks) {
    return { denominator: 1, loopQuarterNotes: 0, masks: [], sequence: '' }
  }

  const stepTicks = tracks.flatMap((track) => {
    const timeScale = track.timeScale || 1
    return track.patterns.map((entry) => Math.max(
      1,
      Math.round((timeScale / entry.pattern.spb) * TICKS_PER_QUARTER_NOTE)
    ))
  })
  const gridTicks = stepTicks.reduce(
    (grid, step) => gcdInt(grid, step),
    gcdInt(TICKS_PER_QUARTER_NOTE, loopTicks)
  )
  const masks = Array.from(
    { length: Math.ceil(loopTicks / gridTicks) },
    () => 0n
  )

  tracks.forEach((track, trackIndex) => {
    const timeScale = track.timeScale || 1
    const chainTicks = trackChainTicks(track)
    if (!chainTicks) return

    for (let chainBaseTicks = 0; chainBaseTicks < loopTicks; chainBaseTicks += chainTicks) {
      let entryOffsetQN = 0
      for (const entry of track.patterns) {
        for (let repeat = 0; repeat < entry.repeats; repeat++) {
          for (const onset of entry.pattern.onsets) {
            const onsetQN = entryOffsetQN + (onset / entry.pattern.spb) * timeScale
            const onsetTicks = chainBaseTicks + Math.round(onsetQN * TICKS_PER_QUARTER_NOTE)
            const stepIndex = Math.round(onsetTicks / gridTicks)
            if (stepIndex >= 0 && stepIndex < masks.length) {
              masks[stepIndex] |= 1n << BigInt(trackIndex)
            }
          }
          entryOffsetQN += entry.pattern.cycleQN * timeScale
        }
      }
    }
  })

  return {
    denominator: TICKS_PER_QUARTER_NOTE / gridTicks,
    loopQuarterNotes: loopTicks / TICKS_PER_QUARTER_NOTE,
    masks,
    sequence: masks.map((mask) => mask.toString(10)).join(' ')
  }
}