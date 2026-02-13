import type { Board, HouseholdColor } from '@/game/types'

interface Counts {
  blue: number
  orange: number
}

const isHousehold = (color: HouseholdColor | null): color is HouseholdColor => color !== null

const adjacencyStats = (board: Board): { same: number; mixed: number } => {
  let same = 0
  let mixed = 0

  const uniquePairOffsets = [
    { row: 0, col: 1 },
    { row: 1, col: 0 },
    { row: 1, col: 1 },
    { row: 1, col: -1 },
  ]

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      const current = board[row][col]
      if (current === null) {
        continue
      }

      for (const offset of uniquePairOffsets) {
        const nextRow = row + offset.row
        const nextCol = col + offset.col
        if (nextRow < 0 || nextCol < 0 || nextRow >= board.length || nextCol >= board.length) {
          continue
        }

        const neighbor = board[nextRow][nextCol]
        if (neighbor === null) {
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

export const calculateSegregationIndex = (board: Board): number => {
  const { same, mixed } = adjacencyStats(board)
  const total = same + mixed
  if (total === 0) {
    return 0
  }
  return Math.round((same / total) * 100)
}

export const calculateIntegrationIndex = (board: Board): number => {
  const { same, mixed } = adjacencyStats(board)
  const total = same + mixed
  if (total === 0) {
    return 0
  }
  return Math.round((mixed / total) * 100)
}

export const countHouseholds = (board: Board): Counts => {
  const counts: Counts = { blue: 0, orange: 0 }

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      const tile = board[row][col]
      const color = tile === null ? null : tile.color
      if (!isHousehold(color)) {
        continue
      }

      if (color === 'blue') {
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
