export type HouseholdColor = 'blue' | 'orange'

export interface HouseholdTile {
  id: string
  color: HouseholdColor
  unhappy: boolean
  unhappyTurns: number
}

export type Cell = HouseholdTile | null

export type Board = Cell[][]

export type LevelId = 'level0' | 'level1' | 'level2a' | 'level2b'

export type WinCondition = 'all_happy' | 'all_happy_low_segregation'

export interface GameConfig {
  levelId: LevelId
  levelName: string
  levelNote: string
  size: number
  blueCount: number
  orangeCount: number
  maxTurns: number
  winCondition: WinCondition
  segregationCap: number | null
  presetBoard: string[] | null
}

export interface Coordinate {
  row: number
  col: number
}

export interface LastMove {
  from: Coordinate
  to: Coordinate
  trail: Coordinate[]
}

export type GameOverReason = 'objective_met' | 'max_turns' | 'manual_end'

export interface TurnSummary {
  moved: boolean
  validMove: boolean
  unhappyBefore: number
  unhappyAfter: number
  segregationIndex: number
  integrationIndex: number
  vacancyCount: number
  lastMove: LastMove | null
}

export interface GameState {
  board: Board
  turn: number
  gameOver: boolean
  gameOverReason: GameOverReason | null
  summary: TurnSummary
}
