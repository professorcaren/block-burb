import type { GameConfig } from '@/game/types'

export const DEFAULT_CONFIG: GameConfig = {
  size: 12,
  initialOccupancy: 0.9,
  minorityShare: 0.15,
  maxTurns: 32,
}
