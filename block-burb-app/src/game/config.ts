import type { GameConfig, LevelId } from '@/game/types'

export const LEVEL_CONFIGS: Record<LevelId, GameConfig> = {
  level0: {
    levelId: 'level0',
    levelName: 'Level 0: Basics',
    levelNote: '4x4 board with 4 blue and 2 orange households. Find both a happy integrated pattern and a happy segregated pattern.',
    size: 4,
    blueCount: 4,
    orangeCount: 2,
    maxTurns: 14,
  },
  level1: {
    levelId: 'level1',
    levelName: 'Level 1: Emergence',
    levelNote: '6x6 board, less crowded. Watch how local isolation fixes scale into neighborhood patterns.',
    size: 6,
    blueCount: 14,
    orangeCount: 4,
    maxTurns: 28,
  },
}

export const LEVEL_ORDER: LevelId[] = ['level0', 'level1']

export const DEFAULT_CONFIG: GameConfig = LEVEL_CONFIGS.level0

export const configForLevel = (levelId: LevelId): GameConfig => ({ ...LEVEL_CONFIGS[levelId] })
