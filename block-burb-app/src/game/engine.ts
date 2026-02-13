import { clamp01 } from '@/game/config'
import type { Board, Coordinate, Direction, GameConfig, GameState, HouseholdColor, Tile, TurnSummary } from '@/game/types'

const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right']

let tileCounter = 0

const makeTileId = (): string => {
  tileCounter += 1
  return `tile-${tileCounter}`
}

const defaultSummary = (): TurnSummary => ({
  moved: false,
  merges: 0,
  flightCount: 0,
  integrationRows: 0,
  pointsGained: 0,
  segregationWarning: false,
  spawned: false,
})

const cloneBoard = (board: Board): Board =>
  board.map((row) => row.map((cell) => (cell ? { ...cell } : null)))

const createEmptyBoard = (size: number): Board =>
  Array.from({ length: size }, () => Array.from({ length: size }, () => null))

const isInBounds = (board: Board, row: number, col: number): boolean =>
  row >= 0 && col >= 0 && row < board.length && col < board.length

const isHousehold = (tile: Tile | null): tile is Tile => tile !== null && tile.kind === 'household'

const isMinority = (tile: Tile | null): boolean => isHousehold(tile) && tile.color === 'orange'

const isMajority = (tile: Tile | null): boolean => isHousehold(tile) && tile.color === 'blue'

const canSlide = (tile: Tile | null): tile is Tile => isHousehold(tile) && !tile.locked

const isImmovableWall = (tile: Tile | null): boolean => {
  if (tile === null) {
    return false
  }

  if (tile.kind !== 'household') {
    return true
  }

  return tile.locked
}

const createHousehold = (color: HouseholdColor): Tile => ({
  id: makeTileId(),
  kind: 'household',
  color,
  locked: false,
  mergedThisTurn: false,
})

const createMergeResult = (a: Tile, b: Tile): Tile => {
  if (a.color !== null && b.color !== null && a.color === b.color) {
    return {
      id: makeTileId(),
      kind: 'gated_community',
      color: null,
      locked: false,
      mergedThisTurn: true,
    }
  }

  return {
    id: makeTileId(),
    kind: 'community_center',
    color: null,
    locked: false,
    mergedThisTurn: true,
  }
}

const canMerge = (mover: Tile, target: Tile | null): target is Tile => {
  if (!isHousehold(target)) {
    return false
  }

  if (target.locked || target.mergedThisTurn || mover.mergedThisTurn) {
    return false
  }

  return true
}

const directionVector = (direction: Direction): Coordinate => {
  switch (direction) {
    case 'up':
      return { row: -1, col: 0 }
    case 'down':
      return { row: 1, col: 0 }
    case 'left':
      return { row: 0, col: -1 }
    case 'right':
      return { row: 0, col: 1 }
    default:
      return { row: 0, col: 0 }
  }
}

const traversalOrder = (size: number, direction: Direction): Coordinate[] => {
  const order: Coordinate[] = []

  if (direction === 'left') {
    for (let row = 0; row < size; row += 1) {
      for (let col = 1; col < size; col += 1) {
        order.push({ row, col })
      }
    }
    return order
  }

  if (direction === 'right') {
    for (let row = 0; row < size; row += 1) {
      for (let col = size - 2; col >= 0; col -= 1) {
        order.push({ row, col })
      }
    }
    return order
  }

  if (direction === 'up') {
    for (let col = 0; col < size; col += 1) {
      for (let row = 1; row < size; row += 1) {
        order.push({ row, col })
      }
    }
    return order
  }

  for (let col = 0; col < size; col += 1) {
    for (let row = size - 2; row >= 0; row -= 1) {
      order.push({ row, col })
    }
  }

  return order
}

const resetMergeFlags = (board: Board): void => {
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      const tile = board[row][col]
      if (tile !== null) {
        tile.mergedThisTurn = false
      }
    }
  }
}

const slideAndMerge = (board: Board, direction: Direction): { moved: boolean; merges: number } => {
  resetMergeFlags(board)

  const vector = directionVector(direction)
  const order = traversalOrder(board.length, direction)

  let moved = false
  let merges = 0

  for (const position of order) {
    const startTile = board[position.row][position.col]
    if (!canSlide(startTile)) {
      continue
    }

    let currentRow = position.row
    let currentCol = position.col
    const activeTile = startTile

    while (true) {
      const nextRow = currentRow + vector.row
      const nextCol = currentCol + vector.col

      if (!isInBounds(board, nextRow, nextCol)) {
        break
      }

      const target = board[nextRow][nextCol]

      if (target === null) {
        board[nextRow][nextCol] = activeTile
        board[currentRow][currentCol] = null
        currentRow = nextRow
        currentCol = nextCol
        moved = true
        continue
      }

      if (isImmovableWall(target)) {
        break
      }

      if (canMerge(activeTile, target)) {
        board[nextRow][nextCol] = createMergeResult(activeTile, target)
        board[currentRow][currentCol] = null
        moved = true
        merges += 1
      }
      break
    }
  }

  resetMergeFlags(board)
  return { moved, merges }
}

const getMinorityShare = (board: Board, cells: Coordinate[]): number => {
  let minorityCount = 0
  let householdCount = 0

  for (const cell of cells) {
    const tile = board[cell.row][cell.col]
    if (!isHousehold(tile) || tile.color === null) {
      continue
    }

    householdCount += 1
    if (tile.color === 'orange') {
      minorityCount += 1
    }
  }

  if (householdCount === 0) {
    return 0
  }

  return minorityCount / householdCount
}

const unitsForTipping = (board: Board, config: GameConfig): Coordinate[][] => {
  const size = board.length
  const units: Coordinate[][] = []

  if (config.tippingUnit === 'row') {
    for (let row = 0; row < size; row += 1) {
      units.push(Array.from({ length: size }, (_, col) => ({ row, col })))
    }
    return units
  }

  if (config.tippingUnit === 'column') {
    for (let col = 0; col < size; col += 1) {
      units.push(Array.from({ length: size }, (_, row) => ({ row, col })))
    }
    return units
  }

  for (let row = 0; row < size - 1; row += 1) {
    for (let col = 0; col < size - 1; col += 1) {
      units.push([
        { row, col },
        { row: row + 1, col },
        { row, col: col + 1 },
        { row: row + 1, col: col + 1 },
      ])
    }
  }

  return units
}

const shuffle = <T,>(items: T[]): T[] => {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

const edgeCells = (board: Board): Coordinate[] => {
  const size = board.length
  const cells: Coordinate[] = []

  for (let i = 0; i < size; i += 1) {
    cells.push({ row: 0, col: i })
    cells.push({ row: size - 1, col: i })
  }

  for (let row = 1; row < size - 1; row += 1) {
    cells.push({ row, col: 0 })
    cells.push({ row, col: size - 1 })
  }

  return cells
}

const manhattan = (a: Coordinate, b: Coordinate): number =>
  Math.abs(a.row - b.row) + Math.abs(a.col - b.col)

const findFarthestEdgeCell = (
  board: Board,
  minorityCells: Coordinate[],
  excluded: Coordinate,
): Coordinate | null => {
  const center = { row: (board.length - 1) / 2, col: (board.length - 1) / 2 }

  let bestScore = -Infinity
  let candidates: Coordinate[] = []

  for (const edge of edgeCells(board)) {
    const tile = board[edge.row][edge.col]
    if (tile !== null) {
      continue
    }

    if (edge.row === excluded.row && edge.col === excluded.col) {
      continue
    }

    let score = 0
    if (minorityCells.length > 0) {
      score = Math.min(...minorityCells.map((minorityCell) => manhattan(edge, minorityCell)))
    } else {
      score = manhattan(edge, center)
    }

    if (score > bestScore) {
      bestScore = score
      candidates = [edge]
    } else if (score === bestScore) {
      candidates.push(edge)
    }
  }

  if (candidates.length === 0) {
    return null
  }

  return candidates[Math.floor(Math.random() * candidates.length)]
}

const applyFlight = (board: Board, config: GameConfig): number => {
  const candidates = new Map<string, Coordinate>()

  for (const unit of unitsForTipping(board, config)) {
    const minorityShare = getMinorityShare(board, unit)
    if (minorityShare <= config.tippingThreshold) {
      continue
    }

    for (const cell of unit) {
      if (isMajority(board[cell.row][cell.col])) {
        const key = `${cell.row}:${cell.col}`
        candidates.set(key, cell)
      }
    }
  }

  const majorityTargets = Array.from(candidates.values())
  if (majorityTargets.length === 0) {
    return 0
  }

  let fleeing: Coordinate[] = []

  if (config.flightMode === 'deterministic') {
    const count = Math.floor(majorityTargets.length * 0.5)
    fleeing = shuffle(majorityTargets).slice(0, count)
  } else {
    fleeing = majorityTargets.filter(() => Math.random() < config.flightProbability)
  }

  if (fleeing.length === 0) {
    return 0
  }

  let events = 0

  for (const departure of fleeing) {
    const tile = board[departure.row][departure.col]
    if (!isMajority(tile)) {
      continue
    }

    board[departure.row][departure.col] = null
    events += 1

    if (config.flightBehavior === 'despawn') {
      continue
    }

    const minorityCells: Coordinate[] = []
    for (let row = 0; row < board.length; row += 1) {
      for (let col = 0; col < board.length; col += 1) {
        if (isMinority(board[row][col])) {
          minorityCells.push({ row, col })
        }
      }
    }

    const edgeTarget = findFarthestEdgeCell(board, minorityCells, departure)
    if (edgeTarget !== null) {
      board[edgeTarget.row][edgeTarget.col] = tile
    }
  }

  return events
}

const minorityShareForRow = (board: Board, row: number): number => {
  let households = 0
  let minority = 0

  for (let col = 0; col < board.length; col += 1) {
    const tile = board[row][col]
    if (!isHousehold(tile) || tile.color === null) {
      continue
    }

    households += 1
    if (tile.color === 'orange') {
      minority += 1
    }
  }

  if (households === 0) {
    return 0
  }

  return minority / households
}

const integrationRows = (board: Board, config: GameConfig): number => {
  let rows = 0

  for (let row = 0; row < board.length; row += 1) {
    const share = minorityShareForRow(board, row)
    if (share >= config.integrationBand.min && share <= config.integrationBand.max) {
      rows += 1
    }
  }

  return rows
}

const isBoardSegregated = (board: Board): boolean => {
  let hasBlue = false
  let hasOrange = false

  for (let row = 0; row < board.length; row += 1) {
    let rowHasBlue = false
    let rowHasOrange = false

    for (let col = 0; col < board.length; col += 1) {
      const tile = board[row][col]
      if (!isHousehold(tile) || tile.color === null) {
        continue
      }

      if (tile.color === 'blue') {
        rowHasBlue = true
        hasBlue = true
      }
      if (tile.color === 'orange') {
        rowHasOrange = true
        hasOrange = true
      }
    }

    if (rowHasBlue && rowHasOrange) {
      return false
    }
  }

  return hasBlue && hasOrange
}

const recomputeLocks = (board: Board): void => {
  const size = board.length

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const tile = board[row][col]
      if (!isHousehold(tile) || tile.color === null) {
        continue
      }

      let rowSameColor = 0
      let colSameColor = 0

      for (let index = 0; index < size; index += 1) {
        const rowTile = board[row][index]
        const colTile = board[index][col]

        if (isHousehold(rowTile) && rowTile.color === tile.color) {
          rowSameColor += 1
        }

        if (isHousehold(colTile) && colTile.color === tile.color) {
          colSameColor += 1
        }
      }

      tile.locked = rowSameColor === 1 && colSameColor === 1
    }
  }
}

const emptyCells = (board: Board): Coordinate[] => {
  const cells: Coordinate[] = []

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      if (board[row][col] === null) {
        cells.push({ row, col })
      }
    }
  }

  return cells
}

const spawnOrangeShare = (config: GameConfig, turn: number): number => {
  const base = config.spawnRatio.orange
  const shifted = base + config.spawnRatioShiftPerTurn * turn
  return clamp01(shifted)
}

const spawnOneHousehold = (board: Board, config: GameConfig, turn: number): boolean => {
  const empty = emptyCells(board)
  if (empty.length === 0) {
    return false
  }

  const target = empty[Math.floor(Math.random() * empty.length)]
  const orangeShare = spawnOrangeShare(config, turn)
  const color: HouseholdColor = Math.random() < orangeShare ? 'orange' : 'blue'
  board[target.row][target.col] = createHousehold(color)
  return true
}

const isFullyLocked = (board: Board): boolean => {
  let households = 0
  let locked = 0

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      const tile = board[row][col]
      if (!isHousehold(tile)) {
        continue
      }

      households += 1
      if (tile.locked) {
        locked += 1
      }
    }
  }

  return households > 0 && households === locked
}

const hasLegalMoves = (board: Board): boolean => {
  for (const direction of DIRECTIONS) {
    const probe = cloneBoard(board)
    const result = slideAndMerge(probe, direction)
    if (result.moved) {
      return true
    }
  }

  return false
}

export const createInitialState = (config: GameConfig): GameState => {
  const board = createEmptyBoard(config.size)

  for (let i = 0; i < config.initialTiles; i += 1) {
    const spawned = spawnOneHousehold(board, config, 0)
    if (!spawned) {
      break
    }
  }

  recomputeLocks(board)

  return {
    board,
    turn: 0,
    totalScore: 0,
    integrationTurnsSurvived: 0,
    gameOver: false,
    gameOverReason: null,
    summary: defaultSummary(),
  }
}

export const endSession = (state: GameState): GameState => ({
  ...state,
  gameOver: true,
  gameOverReason: 'manual_end',
})

export const applyTurn = (state: GameState, direction: Direction, config: GameConfig): GameState => {
  if (state.gameOver) {
    return state
  }

  const board = cloneBoard(state.board)
  const moveOutcome = slideAndMerge(board, direction)

  if (!moveOutcome.moved) {
    return {
      ...state,
      summary: {
        ...defaultSummary(),
        moved: false,
      },
    }
  }

  recomputeLocks(board)
  const flightCount = applyFlight(board, config)
  recomputeLocks(board)

  const turn = state.turn + 1
  const spawned = spawnOneHousehold(board, config, turn)
  recomputeLocks(board)

  const rowsIntegrated = integrationRows(board, config)
  const pointsGained = rowsIntegrated * config.integrationPointsPerRow
  const segregationWarning = isBoardSegregated(board)

  const fullyLocked = isFullyLocked(board)
  const noMoves = !hasLegalMoves(board)
  const gameOver = fullyLocked || noMoves

  return {
    board,
    turn,
    totalScore: state.totalScore + pointsGained,
    integrationTurnsSurvived: state.integrationTurnsSurvived + (rowsIntegrated > 0 ? 1 : 0),
    gameOver,
    gameOverReason: gameOver ? (fullyLocked ? 'fully_locked' : 'no_legal_moves') : null,
    summary: {
      moved: moveOutcome.moved,
      merges: moveOutcome.merges,
      flightCount,
      integrationRows: rowsIntegrated,
      pointsGained,
      segregationWarning,
      spawned,
    },
  }
}
