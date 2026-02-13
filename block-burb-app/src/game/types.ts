export type HouseholdColor = 'blue' | 'orange'

export type Direction = 'up' | 'down' | 'left' | 'right'

export interface HouseholdTile {
  id: string
  color: HouseholdColor
  unhappy: boolean
}

export type Cell = HouseholdTile | null

export type Board = Cell[][]

export interface GameConfig {
  size: number
  initialOccupancy: number
  minorityShare: number
  maxTurns: number
}

export interface Coordinate {
  row: number
  col: number
}

export interface LastMove {
  from: Coordinate
  to: Coordinate
  direction: Direction
  trail: Coordinate[]
}

export type GameOverReason = 'equilibrium' | 'max_turns' | 'manual_end'

export interface TurnSummary {
  moved: boolean
  selectedValid: boolean
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
