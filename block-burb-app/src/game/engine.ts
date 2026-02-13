import type {
  Board,
  Cell,
  Coordinate,
  GameConfig,
  GameState,
  HouseholdTile,
  LastMove,
  TurnSummary,
} from '@/game/types'

let tileCounter = 0

const makeTileId = (): string => {
  tileCounter += 1
  return `tile-${tileCounter}`
}

const createHousehold = (color: HouseholdTile['color']): HouseholdTile => ({
  id: makeTileId(),
  color,
  unhappy: false,
  unhappyTurns: 0,
})

const createEmptyBoard = (size: number): Board =>
  Array.from({ length: size }, () => Array.from({ length: size }, () => null))

const cloneBoard = (board: Board): Board =>
  board.map((row) => row.map((cell) => (cell === null ? null : { ...cell })))

const isInBounds = (board: Board, row: number, col: number): boolean =>
  row >= 0 && col >= 0 && row < board.length && col < board.length

const isHousehold = (cell: Cell): cell is HouseholdTile => cell !== null

const neighborSteps: Coordinate[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
  { row: -1, col: -1 },
  { row: -1, col: 1 },
  { row: 1, col: -1 },
  { row: 1, col: 1 },
]

const neighboringCells = (board: Board, coordinate: Coordinate): Coordinate[] =>
  neighborSteps
    .map((step) => ({ row: coordinate.row + step.row, col: coordinate.col + step.col }))
    .filter((next) => isInBounds(board, next.row, next.col))

const isUnhappy = (board: Board, coordinate: Coordinate): boolean => {
  const tile = board[coordinate.row][coordinate.col]
  if (!isHousehold(tile)) {
    return false
  }

  let occupiedNeighborCount = 0
  let sameColorNeighborCount = 0

  for (const neighbor of neighboringCells(board, coordinate)) {
    const neighborTile = board[neighbor.row][neighbor.col]
    if (!isHousehold(neighborTile)) {
      continue
    }

    occupiedNeighborCount += 1
    if (neighborTile.color === tile.color) {
      sameColorNeighborCount += 1
    }
  }

  // A household with no neighbors is treated as happy.
  if (occupiedNeighborCount === 0) {
    return false
  }

  return sameColorNeighborCount === 0
}

const recomputeHappiness = (board: Board): void => {
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      const tile = board[row][col]
      if (!isHousehold(tile)) {
        continue
      }

      const unhappyNow = isUnhappy(board, { row, col })
      tile.unhappy = unhappyNow
      tile.unhappyTurns = unhappyNow ? tile.unhappyTurns + 1 : 0
    }
  }
}

const countUnhappy = (board: Board): number =>
  board.flat().filter((cell) => isHousehold(cell) && cell.unhappy).length

const countVacancies = (board: Board): number => board.flat().filter((cell) => cell === null).length

const adjacencyStats = (board: Board): { same: number; mixed: number } => {
  let same = 0
  let mixed = 0

  const uniquePairOffsets: Coordinate[] = [
    { row: 0, col: 1 },
    { row: 1, col: 0 },
    { row: 1, col: 1 },
    { row: 1, col: -1 },
  ]

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      const current = board[row][col]
      if (!isHousehold(current)) {
        continue
      }

      for (const offset of uniquePairOffsets) {
        const nextRow = row + offset.row
        const nextCol = col + offset.col
        if (!isInBounds(board, nextRow, nextCol)) {
          continue
        }

        const neighbor = board[nextRow][nextCol]
        if (!isHousehold(neighbor)) {
          continue
        }

        if (neighbor.color === current.color) {
          same += 1
        } else {
          mixed += 1
        }
      }
    }
  }

  return { same, mixed }
}

const calculateSegregationIndex = (board: Board): number => {
  const { same, mixed } = adjacencyStats(board)
  const total = same + mixed
  if (total === 0) {
    return 0
  }
  return Math.round((same / total) * 100)
}

const calculateIntegrationIndex = (board: Board): number => {
  const { same, mixed } = adjacencyStats(board)
  const total = same + mixed
  if (total === 0) {
    return 0
  }
  return Math.round((mixed / total) * 100)
}

const summaryForBoard = (
  board: Board,
  unhappyBefore: number,
  validMove: boolean,
  moved: boolean,
  lastMove: LastMove | null,
): TurnSummary => ({
  moved,
  validMove,
  unhappyBefore,
  unhappyAfter: countUnhappy(board),
  segregationIndex: calculateSegregationIndex(board),
  integrationIndex: calculateIntegrationIndex(board),
  vacancyCount: countVacancies(board),
  lastMove,
})

const shuffle = <T,>(items: T[]): T[] => {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

const allCoordinates = (size: number): Coordinate[] =>
  Array.from({ length: size * size }, (_, index) => ({
    row: Math.floor(index / size),
    col: index % size,
  }))

const moveTrail = (from: Coordinate, to: Coordinate): Coordinate[] => {
  const trail: Coordinate[] = []
  let row = from.row
  let col = from.col

  while (row !== to.row) {
    row += row < to.row ? 1 : -1
    trail.push({ row, col })
  }

  while (col !== to.col) {
    col += col < to.col ? 1 : -1
    trail.push({ row, col })
  }

  return trail
}

const normalizedConfig = (config: GameConfig): GameConfig => {
  const size = Math.max(4, Math.min(12, Math.round(config.size)))
  const maxCells = size * size
  const blueCount = Math.max(1, Math.min(maxCells - 1, Math.round(config.blueCount)))
  const orangeCount = Math.max(1, Math.min(maxCells - blueCount, Math.round(config.orangeCount)))
  const maxTurns = Math.max(6, Math.min(80, Math.round(config.maxTurns)))

  return {
    ...config,
    size,
    blueCount,
    orangeCount,
    maxTurns,
  }
}

export const createInitialState = (rawConfig: GameConfig): GameState => {
  const config = normalizedConfig(rawConfig)
  const board = createEmptyBoard(config.size)

  const colors = shuffle([
    ...Array.from({ length: config.blueCount }, () => 'blue' as const),
    ...Array.from({ length: config.orangeCount }, () => 'orange' as const),
  ])

  const positions = shuffle(allCoordinates(config.size)).slice(0, colors.length)

  for (let index = 0; index < positions.length; index += 1) {
    const position = positions[index]
    board[position.row][position.col] = createHousehold(colors[index])
  }

  recomputeHappiness(board)

  return {
    board,
    turn: 0,
    gameOver: false,
    gameOverReason: null,
    summary: summaryForBoard(board, countUnhappy(board), true, false, null),
  }
}

export const endSession = (state: GameState): GameState => ({
  ...state,
  gameOver: true,
  gameOverReason: 'manual_end',
})

export const applyTurn = (
  state: GameState,
  from: Coordinate,
  to: Coordinate,
  rawConfig: GameConfig,
): GameState => {
  if (state.gameOver) {
    return state
  }

  const config = normalizedConfig(rawConfig)
  const board = cloneBoard(state.board)
  const unhappyBefore = countUnhappy(board)

  if (!isInBounds(board, from.row, from.col) || !isInBounds(board, to.row, to.col)) {
    return {
      ...state,
      summary: summaryForBoard(board, unhappyBefore, false, false, null),
    }
  }

  const source = board[from.row][from.col]
  const target = board[to.row][to.col]

  if (!isHousehold(source) || target !== null) {
    return {
      ...state,
      summary: summaryForBoard(board, unhappyBefore, false, false, null),
    }
  }

  board[to.row][to.col] = source
  board[from.row][from.col] = null
  recomputeHappiness(board)

  const turn = state.turn + 1
  const unhappyAfter = countUnhappy(board)

  const gameOverReason =
    unhappyAfter === 0 ? 'all_happy' : turn >= config.maxTurns ? 'max_turns' : null

  return {
    board,
    turn,
    gameOver: gameOverReason !== null,
    gameOverReason,
    summary: summaryForBoard(board, unhappyBefore, true, true, {
      from,
      to,
      trail: moveTrail(from, to),
    }),
  }
}
