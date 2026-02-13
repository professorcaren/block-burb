import type { GameConfig } from '@/game/types'

export type Level2Difficulty = 'easy' | 'medium' | 'hard'

export interface Level2Puzzle {
  id: string
  title: string
  difficulty: Level2Difficulty
  reverseDepth: number
  turnBudget: number
  startUnhappy: number
  startSegregation: number
  startBoard: string[]
  solvedSeed: string[]
}

// Generated from solved 8x8 low-segregation boards by reverse-scrambling legal moves.
export const LEVEL2_PUZZLES: Level2Puzzle[] = [
  {
    id: 'l2-easy-1',
    title: 'Easy 1',
    difficulty: 'easy',
    reverseDepth: 8,
    turnBudget: 24,
    startUnhappy: 9,
    startSegregation: 59,
    startBoard: [
      '.OBO.BBO',
      '.BB..BB.',
      'OBBBBBBO',
      'BBBOBB.B',
      'B.OOO.BB',
      'B.BOB.OO',
      'BOOOOOOB',
      'BBOOBO.O',
    ],
    solvedSeed: [
      '.OBO.BOO',
      'OBBOOBB.',
      '.BBBBBBO',
      'BBBOBBOB',
      'B.OOO.BB',
      'B.B.B.OO',
      '.OOBOOOB',
      'BBO..OBB',
    ],
  },
  {
    id: 'l2-easy-2',
    title: 'Easy 2',
    difficulty: 'easy',
    reverseDepth: 8,
    turnBudget: 24,
    startUnhappy: 11,
    startSegregation: 49,
    startBoard: [
      'BOBBBB..',
      '..BOBOBO',
      'BOBBBB..',
      '.BBBBOBO',
      'OOOOBBOO',
      'B.OBBOOB',
      'O.OOBOO.',
      '.BOBBB.B',
    ],
    solvedSeed: [
      'B.BBOBOO',
      'B.BOBOBO',
      'B.BBB...',
      '.B..BOBO',
      '.OOOBBOO',
      'B.OBBOBB',
      'OBOOBOOB',
      'OBOBBB.B',
    ],
  },
  {
    id: 'l2-med-1',
    title: 'Medium 1',
    difficulty: 'medium',
    reverseDepth: 12,
    turnBudget: 30,
    startUnhappy: 12,
    startSegregation: 61,
    startBoard: [
      'B.BO.B.O',
      'O...BBB.',
      'BBBBBBBO',
      'BBBOBBBB',
      'O.OOO.BB',
      'B.BOBOO.',
      'OOO.OOOB',
      'BOOOBOBB',
    ],
    solvedSeed: [
      '.OBO.BOO',
      'OBBOOBB.',
      '.BBBBBBO',
      'BBBOBBOB',
      'B.OOO.BB',
      'B.B.B.OO',
      '.OOBOOOB',
      'BBO..OBB',
    ],
  },
  {
    id: 'l2-med-2',
    title: 'Medium 2',
    difficulty: 'medium',
    reverseDepth: 12,
    turnBudget: 30,
    startUnhappy: 11,
    startSegregation: 52,
    startBoard: [
      'BOBB.OOO',
      'BBBOBOBO',
      'BBBBB...',
      'BBO.BOBO',
      'O.OOB...',
      'B.OBBOBO',
      'O.OOBOBB',
      '.BOOBBBB',
    ],
    solvedSeed: [
      'B.BBOBOO',
      'B.BOBOBO',
      'B.BBB...',
      '.B..BOBO',
      '.OOOBBOO',
      'B.OBBOBB',
      'OBOOBOOB',
      'OBOBBB.B',
    ],
  },
  {
    id: 'l2-hard-1',
    title: 'Hard 1',
    difficulty: 'hard',
    reverseDepth: 19,
    turnBudget: 36,
    startUnhappy: 15,
    startSegregation: 59,
    startBoard: [
      'BOBBOBOB',
      'BBBB....',
      'OBBBBBBO',
      'BBB.BBBB',
      'O.OOOOOB',
      'B.BOBOOO',
      '....OOO.',
      'OBOBOOBB',
    ],
    solvedSeed: [
      '.OBO.BOO',
      'OBBOOBB.',
      '.BBBBBBO',
      'BBBOBBOB',
      'B.OOO.BB',
      'B.B.B.OO',
      '.OOBOOOB',
      'BBO..OBB',
    ],
  },
  {
    id: 'l2-hard-2',
    title: 'Hard 2',
    difficulty: 'hard',
    reverseDepth: 18,
    turnBudget: 36,
    startUnhappy: 14,
    startSegregation: 49,
    startBoard: [
      'B.BBBB.O',
      'OBBOBO.B',
      'BBBBB..O',
      'BBOBBOB.',
      'O.OOB..O',
      'B.OBBOB.',
      'OOOOBOO.',
      'OBOBBBOB',
    ],
    solvedSeed: [
      'B.BBOBOO',
      'B.BOBOBO',
      'B.BBB...',
      '.B..BOBO',
      '.OOOBBOO',
      'B.OBBOBB',
      'OBOOBOOB',
      'OBOBBB.B',
    ],
  },
]

export const level2PuzzleCount = (): number => LEVEL2_PUZZLES.length

export const clampLevel2PuzzleIndex = (index: number): number => {
  if (LEVEL2_PUZZLES.length === 0) {
    return 0
  }
  return Math.max(0, Math.min(LEVEL2_PUZZLES.length - 1, Math.floor(index)))
}

export const configForLevel2Puzzle = (baseConfig: GameConfig, puzzleIndex: number): GameConfig => {
  const safeIndex = clampLevel2PuzzleIndex(puzzleIndex)
  const puzzle = LEVEL2_PUZZLES[safeIndex]

  return {
    ...baseConfig,
    levelName: `Level 2 • Puzzle ${safeIndex + 1}/${LEVEL2_PUZZLES.length}`,
    levelNote: `${puzzle.title} (${puzzle.difficulty}) • reverse depth ${puzzle.reverseDepth}. Reach 0 unhappy with segregation <= ${baseConfig.segregationCap}%`,
    maxTurns: puzzle.turnBudget,
    presetBoard: [...puzzle.startBoard],
  }
}
