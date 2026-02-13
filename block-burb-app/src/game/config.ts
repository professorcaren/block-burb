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
    winCondition: 'all_happy',
    segregationCap: null,
    presetBoard: null,
  },
  level1: {
    levelId: 'level1',
    levelName: 'Level 1: Emergence',
    levelNote: '6x6 board, less crowded. Watch how local isolation fixes scale into neighborhood patterns.',
    size: 6,
    blueCount: 14,
    orangeCount: 4,
    maxTurns: 28,
    winCondition: 'all_happy',
    segregationCap: null,
    presetBoard: null,
  },
  level2a: {
    levelId: 'level2a',
    levelName: 'Level 2A: Tradeoff Board',
    levelNote:
      '8x8 reverse-engineered board. Goal: make everyone happy while keeping segregation low. High-segregation happy outcomes are possible, but they do not win.',
    size: 8,
    blueCount: 30,
    orangeCount: 22,
    maxTurns: 36,
    winCondition: 'all_happy_low_segregation',
    segregationCap: 55,
    presetBoard: [
      'BOBBBBBO',
      '..BOBO.O',
      'OBOBBB.B',
      'BBBOO.OB',
      'OBB.BOB.',
      'BB.OO..B',
      'B.BO.OOO',
      'OBBOBOOB',
    ],
  },
  level2b: {
    levelId: 'level2b',
    levelName: 'Level 2B: Harder Tradeoff',
    levelNote:
      'Another 8x8 reverse-engineered board. You can end fully happy with high segregation, but the objective requires low segregation.',
    size: 8,
    blueCount: 30,
    orangeCount: 22,
    maxTurns: 40,
    winCondition: 'all_happy_low_segregation',
    segregationCap: 55,
    presetBoard: [
      'O.OO.BOB',
      'BBBOOOOO',
      '.BBBOO..',
      'OBBBBOBO',
      'B.OBBBBB',
      'BBB.B.OO',
      'OBB..OBB',
      'BBOB..OO',
    ],
  },
}

export const LEVEL_ORDER: LevelId[] = ['level0', 'level1', 'level2a', 'level2b']

export const DEFAULT_CONFIG: GameConfig = LEVEL_CONFIGS.level0

export const configForLevel = (levelId: LevelId): GameConfig => {
  const source = LEVEL_CONFIGS[levelId]
  return {
    ...source,
    presetBoard: source.presetBoard === null ? null : [...source.presetBoard],
  }
}
