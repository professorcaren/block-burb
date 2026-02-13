import type {
  Board,
  Cell,
  Coordinate,
  Direction,
  GameConfig,
  GameState,
  HouseholdColor,
  HouseholdTile,
  LastMove,
  TurnSummary,
} from '@/game/types'

let tileCounter = 0

const makeTileId = (): string => {
  tileCounter += 1
  return `tile-${tileCounter}`
}

const createHousehold = (color: HouseholdColor): HouseholdTile => ({
  id: makeTileId(),
  color,
  unhappy: false,
})

const createEmptyBoard = (size: number): Board =>
  Array.from({ length: size }, () => Array.from({ length: size }, () => null))

const cloneBoard = (board: Board): Board =>
  board.map((row) => row.map((cell) => (cell === null ? null : { ...cell })))

const isInBounds = (board: Board, row: number, col: number): boolean =>
  row >= 0 && col >= 0 && row < board.length && col < board.length

const isHousehold = (cell: Cell): cell is HouseholdTile => cell !== null

const directions: Coordinate[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
]

const orthogonalNeighbors = (board: Board, coordinate: Coordinate): Coordinate[] =>
  directions
    .map((step) => ({ row: coordinate.row + step.row, col: coordinate.col + step.col }))
    .filter((next) => isInBounds(board, next.row, next.col))

const isHappy = (board: Board, coordinate: Coordinate): boolean => {
  const tile = board[coordinate.row][coordinate.col]
  if (!isHousehold(tile)) {
    return true
  }

  return orthogonalNeighbors(board, coordinate).some((neighbor) => {
    const neighborTile = board[neighbor.row][neighbor.col]
    return isHousehold(neighborTile) && neighborTile.color === tile.color
  })
}

const recomputeHappiness = (board: Board): void => {
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      const tile = board[row][col]
      if (!isHousehold(tile)) {
        continue
      }
      tile.unhappy = !isHappy(board, { row, col })
    }
  }
}

const countUnhappy = (board: Board): number =>
  board.flat().filter((cell) => isHousehold(cell) && cell.unhappy).length

const countVacancies = (board: Board): number => board.flat().filter((cell) => cell === null).length

const adjacencyStats = (board: Board): { same: number; mixed: number } => {
  let same = 0
  let mixed = 0

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      const current = board[row][col]
      if (!isHousehold(current)) {
        continue
      }

      const right = col + 1 < board.length ? board[row][col + 1] : null
      const down = row + 1 < board.length ? board[row + 1][col] : null

      if (isHousehold(right)) {
        if (right.color === current.color) {
          same += 1
        } else {
          mixed += 1
        }
      }

      if (isHousehold(down)) {
        if (down.color === current.color) {
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
  selectedValid: boolean,
  moved: boolean,
  lastMove: LastMove | null,
): TurnSummary => ({
  moved,
  selectedValid,
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

const isInDirection = (from: Coordinate, to: Coordinate, direction: Direction): boolean => {
  if (direction === 'up') {
    return to.row < from.row
  }
  if (direction === 'down') {
    return to.row > from.row
  }
  if (direction === 'left') {
    return to.col < from.col
  }
  return to.col > from.col
}

const compareDirectionalTieBreak = (
  from: Coordinate,
  a: Coordinate,
  b: Coordinate,
  direction: Direction,
): number => {
  if (direction === 'up') {
    if (a.row !== b.row) {
      return a.row - b.row
    }
    return Math.abs(a.col - from.col) - Math.abs(b.col - from.col)
  }

  if (direction === 'down') {
    if (a.row !== b.row) {
      return b.row - a.row
    }
    return Math.abs(a.col - from.col) - Math.abs(b.col - from.col)
  }

  if (direction === 'left') {
    if (a.col !== b.col) {
      return a.col - b.col
    }
    return Math.abs(a.row - from.row) - Math.abs(b.row - from.row)
  }

  if (a.col !== b.col) {
    return b.col - a.col
  }
  return Math.abs(a.row - from.row) - Math.abs(b.row - from.row)
}

const nearestVacancyInDirection = (board: Board, from: Coordinate, direction: Direction): Coordinate | null => {
  const vacancies: Coordinate[] = []

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      if (board[row][col] !== null) {
        continue
      }

      const candidate = { row, col }
      if (!isInDirection(from, candidate, direction)) {
        continue
      }
      vacancies.push(candidate)
    }
  }

  if (vacancies.length === 0) {
    return null
  }

  const manhattanDistance = (a: Coordinate, b: Coordinate): number =>
    Math.abs(a.row - b.row) + Math.abs(a.col - b.col)

  vacancies.sort((a, b) => {
    const distanceDelta = manhattanDistance(from, a) - manhattanDistance(from, b)
    if (distanceDelta !== 0) {
      return distanceDelta
    }

    const directionalDelta = compareDirectionalTieBreak(from, a, b, direction)
    if (directionalDelta !== 0) {
      return directionalDelta
    }

    if (a.row !== b.row) {
      return a.row - b.row
    }
    return a.col - b.col
  })

  return vacancies[0]
}

const moveTrail = (from: Coordinate, to: Coordinate, direction: Direction): Coordinate[] => {
  const trail: Coordinate[] = []
  let row = from.row
  let col = from.col

  if (direction === 'up' || direction === 'down') {
    while (row !== to.row) {
      row += row < to.row ? 1 : -1
      trail.push({ row, col })
    }
    while (col !== to.col) {
      col += col < to.col ? 1 : -1
      trail.push({ row, col })
    }
  } else {
    while (col !== to.col) {
      col += col < to.col ? 1 : -1
      trail.push({ row, col })
    }
    while (row !== to.row) {
      row += row < to.row ? 1 : -1
      trail.push({ row, col })
    }
  }

  return trail
}

const normalizedConfig = (config: GameConfig): GameConfig => {
  const size = Math.max(8, Math.min(16, Math.round(config.size)))
  const initialOccupancy = Math.max(0.65, Math.min(0.98, config.initialOccupancy))
  const minorityShare = Math.max(0.1, Math.min(0.2, config.minorityShare))
  const maxTurns = Math.max(10, Math.min(80, Math.round(config.maxTurns)))

  return {
    size,
    initialOccupancy,
    minorityShare,
    maxTurns,
  }
}

export const createInitialState = (rawConfig: GameConfig): GameState => {
  const config = normalizedConfig(rawConfig)
  const board = createEmptyBoard(config.size)

  const capacity = config.size * config.size
  const householdCount = Math.max(2, Math.min(capacity - 1, Math.round(capacity * config.initialOccupancy)))
  const minorityCount = Math.round(householdCount * config.minorityShare)
  const majorityCount = householdCount - minorityCount

  const colors = shuffle([
    ...Array.from({ length: majorityCount }, () => 'blue' as const),
    ...Array.from({ length: minorityCount }, () => 'orange' as const),
  ])

  const positions = shuffle(allCoordinates(config.size)).slice(0, householdCount)

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
  selected: Coordinate,
  direction: Direction,
  rawConfig: GameConfig,
): GameState => {
  if (state.gameOver) {
    return state
  }

  const config = normalizedConfig(rawConfig)
  const board = cloneBoard(state.board)
  const unhappyBefore = countUnhappy(board)

  const selectedTile = isInBounds(board, selected.row, selected.col) ? board[selected.row][selected.col] : null
  if (!isHousehold(selectedTile) || !selectedTile.unhappy) {
    return {
      ...state,
      summary: summaryForBoard(board, unhappyBefore, false, false, null),
    }
  }

  const vacancy = nearestVacancyInDirection(board, selected, direction)
  if (vacancy === null) {
    return {
      ...state,
      summary: summaryForBoard(board, unhappyBefore, true, false, null),
    }
  }

  board[vacancy.row][vacancy.col] = selectedTile
  board[selected.row][selected.col] = null
  recomputeHappiness(board)

  const turn = state.turn + 1
  const unhappyAfter = countUnhappy(board)

  let gameOver = false
  let gameOverReason: GameState['gameOverReason'] = null

  if (unhappyAfter === 0) {
    gameOver = true
    gameOverReason = 'equilibrium'
  } else if (turn >= config.maxTurns) {
    gameOver = true
    gameOverReason = 'max_turns'
  }

  const lastMove: LastMove = {
    from: selected,
    to: vacancy,
    direction,
    trail: moveTrail(selected, vacancy, direction),
  }

  return {
    board,
    turn,
    gameOver,
    gameOverReason,
    summary: summaryForBoard(board, unhappyBefore, true, true, lastMove),
  }
}
