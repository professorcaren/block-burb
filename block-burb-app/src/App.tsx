import { useEffect, useMemo, useState } from 'react'
import AdvancedGame from './AdvancedGame'

type Mode = 'core' | 'advanced'
type AgentColor = 'blue' | 'orange'
type Cell = AgentColor | null
type Board = Cell[][]

interface RoundConfig {
  id: number
  title: string
  tolerance: number
  targetSegregation: number
  maxMoves: number
  blueCount: number
  orangeCount: number
}

interface Position {
  row: number
  col: number
}

interface BoardAnalysis {
  unhappyCount: number
  totalAgents: number
  segregation: number
  integration: number
  unhappyKeys: Set<string>
}

interface StepResult {
  board: Board
  moved: boolean
}

interface RunResult {
  board: Board
  moves: number
}

const BOARD_SIZE = 8

const ROUNDS: RoundConfig[] = [
  {
    id: 1,
    title: 'Round 1: Mild Preferences',
    tolerance: 0.25,
    targetSegregation: 62,
    maxMoves: 45,
    blueCount: 24,
    orangeCount: 20,
  },
  {
    id: 2,
    title: 'Round 2: Moderate Preferences',
    tolerance: 0.4,
    targetSegregation: 58,
    maxMoves: 65,
    blueCount: 25,
    orangeCount: 21,
  },
  {
    id: 3,
    title: 'Round 3: Tight Preferences',
    tolerance: 0.55,
    targetSegregation: 55,
    maxMoves: 85,
    blueCount: 26,
    orangeCount: 22,
  },
]

const neighborOffsets: Position[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
  { row: -1, col: -1 },
  { row: -1, col: 1 },
  { row: 1, col: -1 },
  { row: 1, col: 1 },
]

const adjacencyOffsets: Position[] = [
  { row: 0, col: 1 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
  { row: 1, col: -1 },
]

const inBounds = (row: number, col: number): boolean =>
  row >= 0 && col >= 0 && row < BOARD_SIZE && col < BOARD_SIZE

const keyFor = (position: Position): string => `${position.row}:${position.col}`

const shuffle = <T,>(items: T[]): T[] => {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

const createRoundBoard = (round: RoundConfig): Board => {
  const board = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null as Cell),
  )

  const placements = shuffle([
    ...Array.from({ length: round.blueCount }, () => 'blue' as const),
    ...Array.from({ length: round.orangeCount }, () => 'orange' as const),
    ...Array.from({ length: BOARD_SIZE * BOARD_SIZE - round.blueCount - round.orangeCount }, () => null as Cell),
  ])

  let index = 0
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      board[row][col] = placements[index]
      index += 1
    }
  }

  return board
}

const cloneBoard = (board: Board): Board => board.map((row) => [...row])

const analyzeBoard = (board: Board, tolerance: number): BoardAnalysis => {
  let unhappyCount = 0
  let totalAgents = 0
  let sameAdjacency = 0
  let mixedAdjacency = 0
  const unhappyKeys = new Set<string>()

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const current = board[row][col]
      if (current === null) {
        continue
      }

      totalAgents += 1

      let occupiedNeighbors = 0
      let sameColorNeighbors = 0
      for (const offset of neighborOffsets) {
        const nextRow = row + offset.row
        const nextCol = col + offset.col
        if (!inBounds(nextRow, nextCol)) {
          continue
        }

        const neighbor = board[nextRow][nextCol]
        if (neighbor === null) {
          continue
        }

        occupiedNeighbors += 1
        if (neighbor === current) {
          sameColorNeighbors += 1
        }
      }

      if (occupiedNeighbors > 0 && sameColorNeighbors / occupiedNeighbors < tolerance) {
        unhappyCount += 1
        unhappyKeys.add(keyFor({ row, col }))
      }

      for (const offset of adjacencyOffsets) {
        const nextRow = row + offset.row
        const nextCol = col + offset.col
        if (!inBounds(nextRow, nextCol)) {
          continue
        }

        const neighbor = board[nextRow][nextCol]
        if (neighbor === null) {
          continue
        }

        if (neighbor === current) {
          sameAdjacency += 1
        } else {
          mixedAdjacency += 1
        }
      }
    }
  }

  const totalAdjacency = sameAdjacency + mixedAdjacency
  const segregation = totalAdjacency === 0 ? 0 : Math.round((sameAdjacency / totalAdjacency) * 100)

  return {
    unhappyCount,
    totalAgents,
    segregation,
    integration: 100 - segregation,
    unhappyKeys,
  }
}

const collectVacancies = (board: Board): Position[] => {
  const vacancies: Position[] = []
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (board[row][col] === null) {
        vacancies.push({ row, col })
      }
    }
  }
  return vacancies
}

const collectUnhappy = (analysis: BoardAnalysis): Position[] =>
  Array.from(analysis.unhappyKeys).map((key) => {
    const [row, col] = key.split(':').map(Number)
    return { row, col }
  })

const moveOneUnhappy = (board: Board, tolerance: number): StepResult => {
  const analysis = analyzeBoard(board, tolerance)
  const unhappy = collectUnhappy(analysis)
  const vacancies = collectVacancies(board)

  if (unhappy.length === 0 || vacancies.length === 0) {
    return { board, moved: false }
  }

  const source = unhappy[Math.floor(Math.random() * unhappy.length)]
  const target = vacancies[Math.floor(Math.random() * vacancies.length)]
  const next = cloneBoard(board)
  next[target.row][target.col] = next[source.row][source.col]
  next[source.row][source.col] = null

  return { board: next, moved: true }
}

const runSimulationRound = (board: Board, tolerance: number, maxMoves: number): RunResult => {
  let workingBoard = board
  let moves = 0

  for (let index = 0; index < maxMoves; index += 1) {
    const step = moveOneUnhappy(workingBoard, tolerance)
    if (!step.moved) {
      break
    }

    workingBoard = step.board
    moves += 1

    const check = analyzeBoard(workingBoard, tolerance)
    if (check.unhappyCount === 0) {
      break
    }
  }

  return { board: workingBoard, moves }
}

const cellClass = (cell: Cell): string => {
  if (cell === null) {
    return 'border-slate-200 bg-white/85'
  }

  return cell === 'blue'
    ? 'border-[#19467f] bg-[#1f5ea8]'
    : 'border-[#b85f1e] bg-[#d97a2f]'
}

const isRoundCompleted = (analysis: BoardAnalysis, round: RoundConfig): boolean =>
  analysis.unhappyCount === 0 && analysis.segregation <= round.targetSegregation

function App() {
  const [mode, setMode] = useState<Mode>('core')
  const [roundIndex, setRoundIndex] = useState(0)
  const [board, setBoard] = useState<Board>(() => createRoundBoard(ROUNDS[0]))
  const [lastMoveCount, setLastMoveCount] = useState(0)
  const [status, setStatus] = useState('Tap Run to watch unhappy households relocate.')
  const [clearedRounds, setClearedRounds] = useState<boolean[]>(Array.from({ length: ROUNDS.length }, () => false))

  const round = ROUNDS[roundIndex]

  const analysis = useMemo(() => analyzeBoard(board, round.tolerance), [board, round.tolerance])
  const completed = isRoundCompleted(analysis, round)

  useEffect(() => {
    if (!completed) {
      return
    }

    setClearedRounds((previous) => {
      if (previous[roundIndex]) {
        return previous
      }
      const next = [...previous]
      next[roundIndex] = true
      return next
    })
  }, [completed, roundIndex])

  const resetRound = (): void => {
    setBoard(createRoundBoard(round))
    setLastMoveCount(0)
    setStatus('Round reset. Tap Run to simulate movement.')
  }

  const advanceRound = (): void => {
    if (roundIndex >= ROUNDS.length - 1) {
      setStatus('All rounds completed. You can rerun any round or open Advanced mode.')
      return
    }

    const nextIndex = roundIndex + 1
    setRoundIndex(nextIndex)
    setBoard(createRoundBoard(ROUNDS[nextIndex]))
    setLastMoveCount(0)
    setStatus(`Loaded ${ROUNDS[nextIndex].title}.`)
  }

  const runOneMove = (): void => {
    const step = moveOneUnhappy(board, round.tolerance)
    if (!step.moved) {
      setStatus('No unhappy households can move right now.')
      return
    }

    setBoard(step.board)
    setLastMoveCount(1)

    const nextAnalysis = analyzeBoard(step.board, round.tolerance)
    if (isRoundCompleted(nextAnalysis, round)) {
      setStatus('Round objective complete: everyone is happy and segregation stayed low.')
      return
    }

    if (nextAnalysis.unhappyCount === 0) {
      setStatus(`Everyone is happy, but segregation is ${nextAnalysis.segregation}% (target <= ${round.targetSegregation}%).`)
      return
    }

    setStatus('One relocation applied.')
  }

  const runRound = (): void => {
    const result = runSimulationRound(board, round.tolerance, round.maxMoves)
    setBoard(result.board)
    setLastMoveCount(result.moves)

    const nextAnalysis = analyzeBoard(result.board, round.tolerance)
    if (isRoundCompleted(nextAnalysis, round)) {
      setStatus(`Objective complete in ${result.moves} moves.`)
      return
    }

    if (nextAnalysis.unhappyCount === 0) {
      setStatus(`Everyone became happy, but segregation is ${nextAnalysis.segregation}% (target <= ${round.targetSegregation}%).`)
      return
    }

    if (result.moves === 0) {
      setStatus('No moves available from this layout. Try Reset.')
      return
    }

    setStatus(`Simulation stopped after ${result.moves} moves with ${nextAnalysis.unhappyCount} unhappy households left.`)
  }

  if (mode === 'advanced') {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setMode('core')}
          className="fixed left-4 top-4 z-50 rounded-xl border border-slate-300 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-800 shadow"
        >
          Back To Core Lab
        </button>
        <AdvancedGame />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_10%_10%,#d9edff_0%,transparent_40%),radial-gradient(circle_at_90%_90%,#ffe7d3_0%,transparent_35%),linear-gradient(180deg,#f9fbff_0%,#edf2f8_100%)] px-4 pb-12 pt-4 sm:px-6">
      <section className="mx-auto w-full max-w-xl rounded-2xl border border-white/80 bg-white/90 p-4 shadow-[0_18px_40px_rgba(16,24,40,0.12)] backdrop-blur">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Core Interactive Lab</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Block 'Burb Core</h1>
            <p className="mt-1 text-xs text-slate-600">Mobile-friendly rounds inspired by the key dynamics in Parable of the Polygons.</p>
          </div>
          <button
            type="button"
            onClick={() => setMode('advanced')}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm"
          >
            Open Advanced
          </button>
        </header>

        <section className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{round.title}</p>
            <p className="text-xs text-slate-600">Tolerance {Math.round(round.tolerance * 100)}%</p>
          </div>
          <p className="mt-1 text-xs text-slate-700">
            Goal: end with 0 unhappy households and segregation at or below {round.targetSegregation}%.
          </p>

          <div className="mt-2 grid grid-cols-3 gap-2">
            {ROUNDS.map((item, index) => {
              const active = index === roundIndex
              const cleared = clearedRounds[index]
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setRoundIndex(index)
                    setBoard(createRoundBoard(item))
                    setLastMoveCount(0)
                    setStatus(`Loaded ${item.title}.`)
                  }}
                  className={`rounded-lg border px-2 py-2 text-xs font-medium ${
                    active
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : cleared
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                        : 'border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  R{item.id}
                </button>
              )
            })}
          </div>
        </section>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-slate-100 px-2 py-2">
            <p className="text-[10px] uppercase text-slate-500">Round</p>
            <p className="text-base font-semibold text-slate-800">{roundIndex + 1}/{ROUNDS.length}</p>
          </div>
          <div className="rounded-lg bg-slate-100 px-2 py-2">
            <p className="text-[10px] uppercase text-slate-500">Unhappy</p>
            <p className="text-base font-semibold text-rose-700">{analysis.unhappyCount}</p>
          </div>
          <div className="rounded-lg bg-slate-100 px-2 py-2">
            <p className="text-[10px] uppercase text-slate-500">Segregation</p>
            <p className={`text-base font-semibold ${analysis.segregation > round.targetSegregation ? 'text-rose-700' : 'text-emerald-700'}`}>
              {analysis.segregation}%
            </p>
          </div>
        </div>

        <p className="mt-2 text-xs text-slate-600">
          Integration {analysis.integration}% • Agents {analysis.totalAgents} • Last run {lastMoveCount} move{lastMoveCount === 1 ? '' : 's'}
        </p>

        <div className="mt-3 w-full rounded-xl border border-slate-200 bg-[#f3f6fb] p-2">
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))` }}>
            {board.flatMap((row, rowIndex) =>
              row.map((cell, colIndex) => {
                const unhappy = analysis.unhappyKeys.has(keyFor({ row: rowIndex, col: colIndex }))
                return (
                  <div
                    key={`cell-${rowIndex}-${colIndex}`}
                    className={`relative aspect-square rounded-md border ${cellClass(cell)} ${unhappy ? 'unhappy-pulse-medium' : ''}`}
                  />
                )
              }),
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={runOneMove}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
          >
            Step
          </button>
          <button
            type="button"
            onClick={runRound}
            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
          >
            Run
          </button>
          <button
            type="button"
            onClick={resetRound}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
          >
            Reset
          </button>
        </div>

        <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">{status}</p>

        <button
          type="button"
          onClick={advanceRound}
          className="mt-3 w-full rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!completed && roundIndex < ROUNDS.length - 1}
        >
          {roundIndex >= ROUNDS.length - 1 ? 'All Rounds Loaded' : completed ? 'Next Round' : 'Complete Objective To Unlock Next Round'}
        </button>
      </section>
    </main>
  )
}

export default App
