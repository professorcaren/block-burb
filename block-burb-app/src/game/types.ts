export type HouseholdColor = 'blue' | 'orange'

export type TileKind = 'household' | 'gated_community' | 'community_center'

export type Direction = 'up' | 'down' | 'left' | 'right'

export type TippingUnit = 'row' | 'column' | 'sector2x2'

export type FlightMode = 'deterministic' | 'probabilistic'

export type FlightBehavior = 'despawn' | 'edge-relocate'

export interface Tile {
  id: string
  kind: TileKind
  color: HouseholdColor | null
  locked: boolean
  mergedThisTurn: boolean
  isolationTurns: number
}

export type Cell = Tile | null

export type Board = Cell[][]

export interface SpawnRatio {
  blue: number
  orange: number
}

export interface IntegrationBand {
  min: number
  max: number
}

export interface GameConfig {
  size: number
  initialTiles: number
  spawnRatio: SpawnRatio
  spawnRatioShiftPerTurn: number
  spawnPerTurn: number
  earlySpawnPerTurn: number
  earlySpawnTurns: number
  isolationLockDelayTurns: number
  tippingThreshold: number
  tippingUnit: TippingUnit
  flightMode: FlightMode
  flightProbability: number
  flightBehavior: FlightBehavior
  integrationBand: IntegrationBand
  integrationPointsPerRow: number
}

export type GameOverReason = 'no_legal_moves' | 'fully_locked' | 'manual_end'

export interface TurnSummary {
  moved: boolean
  merges: number
  flightCount: number
  integrationRows: number
  pointsGained: number
  segregationWarning: boolean
  spawned: boolean
}

export interface GameState {
  board: Board
  turn: number
  totalScore: number
  integrationTurnsSurvived: number
  integrationStreak: number
  gameOver: boolean
  gameOverReason: GameOverReason | null
  summary: TurnSummary
}

export interface Coordinate {
  row: number
  col: number
}
