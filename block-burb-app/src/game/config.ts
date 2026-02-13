import type { GameConfig } from '@/game/types'

export const DEFAULT_CONFIG: GameConfig = {
  size: 5,
  initialTiles: 7,
  spawnRatio: {
    blue: 0.9,
    orange: 0.1,
  },
  spawnRatioShiftPerTurn: 0,
  spawnPerTurn: 1,
  earlySpawnPerTurn: 2,
  earlySpawnTurns: 12,
  isolationLockDelayTurns: 3,
  tippingThreshold: 0.3,
  tippingUnit: 'row',
  flightMode: 'probabilistic',
  flightProbability: 0.45,
  flightBehavior: 'edge-relocate',
  integrationBand: {
    min: 0.3,
    max: 0.7,
  },
  integrationPointsPerRow: 10,
}

export const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))
