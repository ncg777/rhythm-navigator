export const DEFAULT_FLAM_SPACING = 0.03
export const DEFAULT_ROLL_SPACING = 0.04
export type PatternOrnamentKey = 'flamCount' | 'flamSpacing' | 'rollCount' | 'rollSpacing'

export function normalizePatternOrnamentValue(key: PatternOrnamentKey, value: number): number {
  const fallback = key === 'flamSpacing' ? DEFAULT_FLAM_SPACING : key === 'rollSpacing' ? DEFAULT_ROLL_SPACING : 0
  const finite = Number.isFinite(value) ? value : fallback
  if (key === 'flamCount') return Math.max(0, Math.min(3, Math.floor(finite)))
  if (key === 'rollCount') return Math.max(0, Math.min(8, Math.floor(finite)))
  return Math.max(0.001, Math.min(0.15, finite))
}
