import type { Board, HouseholdColor, Tile } from '@/game/types'

interface Counts {
  blue: number
  orange: number
}

const isHousehold = (tile: Tile | null): tile is Tile => tile !== null && tile.kind === 'household'

export const calculateSegregationIndex = (board: Board): number => {
  let sameColorAdjacency = 0
  let totalAdjacency = 0

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      const current = board[row][col]
      if (!isHousehold(current) || current.color === null) {
        continue
      }

      const right = col + 1 < board.length ? board[row][col + 1] : null
      const down = row + 1 < board.length ? board[row + 1][col] : null

      if (isHousehold(right) && right.color !== null) {
        totalAdjacency += 1
        if (right.color === current.color) {
          sameColorAdjacency += 1
        }
      }

      if (isHousehold(down) && down.color !== null) {
        totalAdjacency += 1
        if (down.color === current.color) {
          sameColorAdjacency += 1
        }
      }
    }
  }

  if (totalAdjacency === 0) {
    return 0
  }

  return Math.round((sameColorAdjacency / totalAdjacency) * 100)
}

export const countHouseholds = (board: Board): Counts => {
  const counts: Counts = { blue: 0, orange: 0 }

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      const tile = board[row][col]
      if (!isHousehold(tile) || tile.color === null) {
        continue
      }

      if (tile.color === 'blue') {
        counts.blue += 1
      } else {
        counts.orange += 1
      }
    }
  }

  return counts
}

export const generateEquilibriumMap = (size: number, blue: number, orange: number): (HouseholdColor | null)[][] => {
  const map: (HouseholdColor | null)[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null),
  )

  const positions = Array.from({ length: size * size }, (_, index) => ({
    row: Math.floor(index / size),
    col: index % size,
  }))

  let blueRemaining = blue
  for (let i = 0; i < positions.length && blueRemaining > 0; i += 1) {
    const target = positions[i]
    map[target.row][target.col] = 'blue'
    blueRemaining -= 1
  }

  let orangeRemaining = orange
  for (let i = positions.length - 1; i >= 0 && orangeRemaining > 0; i -= 1) {
    const target = positions[i]
    if (map[target.row][target.col] !== null) {
      continue
    }

    map[target.row][target.col] = 'orange'
    orangeRemaining -= 1
  }

  return map
}
