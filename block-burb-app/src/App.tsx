import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AdvancedGame from './AdvancedGame'

type Mode = 'core' | 'advanced'
type AgentColor = 'blue' | 'orange'
type Cell = AgentColor | null
type Board = Cell[][]

interface RoundConfig {
  id: number
  label: string
  tolerance: number
  targetSegregation: number
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
  unhappyKeys: Set<string>
}

interface StepResult {
  board: Board
  moved: boolean
  source?: Position
  target?: Position
}

const BOARD_SIZE = 8
const STEP_DELAY_MS = 360
const GITHUB_REPO_URL = 'https://github.com/professorcaren/block-burb'

const ROUNDS: RoundConfig[] = [
  { id: 1, label: 'Easy', tolerance: 0.26, targetSegregation: 60, blueCount: 24, orangeCount: 20 },
  { id: 2, label: 'Mid', tolerance: 0.42, targetSegregation: 56, blueCount: 25, orangeCount: 21 },
  { id: 3, label: 'Hard', tolerance: 0.56, targetSegregation: 52, blueCount: 26, orangeCount: 22 },
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

  return { unhappyCount, totalAgents, segregation, unhappyKeys }
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

  return { board: next, moved: true, source, target }
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
  const [running, setRunning] = useState(false)
  const [turns, setTurns] = useState(0)
  const [hint, setHint] = useState('Unhappy households pulse. Press Play to watch movement.')
  const [showIntro, setShowIntro] = useState(true)
  const [showRoundSummary, setShowRoundSummary] = useState(false)
  const [clearedRounds, setClearedRounds] = useState<boolean[]>(Array.from({ length: ROUNDS.length }, () => false))
  const [moveTrail, setMoveTrail] = useState<{ from: string; to: string } | null>(null)
  const [unhappyStreaks, setUnhappyStreaks] = useState<Record<string, number>>({})

  const completionShownRef = useRef(false)
  const round = ROUNDS[roundIndex]
  const analysis = useMemo(() => analyzeBoard(board, round.tolerance), [board, round.tolerance])
  const completed = isRoundCompleted(analysis, round)
  const segregationAlert = analysis.segregation > round.targetSegregation
  const segregationNeedleLeft = Math.max(2, Math.min(98, analysis.segregation))
  const targetMarkerLeft = Math.max(2, Math.min(98, round.targetSegregation))

  useEffect(() => {
    setUnhappyStreaks((previous) => {
      const next: Record<string, number> = {}
      for (const key of analysis.unhappyKeys) {
        next[key] = (previous[key] ?? 0) + 1
      }
      return next
    })
  }, [analysis.unhappyKeys])

  useEffect(() => {
    if (!moveTrail) {
      return
    }
    const timeout = window.setTimeout(() => setMoveTrail(null), 260)
    return () => window.clearTimeout(timeout)
  }, [moveTrail])

  useEffect(() => {
    if (!completed) {
      completionShownRef.current = false
      return
    }

    if (completionShownRef.current) {
      return
    }

    completionShownRef.current = true
    setRunning(false)
    setShowRoundSummary(true)
    setClearedRounds((previous) => {
      if (previous[roundIndex]) {
        return previous
      }
      const next = [...previous]
      next[roundIndex] = true
      return next
    })
  }, [completed, roundIndex])

  const resetRound = useCallback((): void => {
    setRunning(false)
    setTurns(0)
    setBoard(createRoundBoard(round))
    setHint('Random start loaded. Watch the pulse, then move.')
    setShowRoundSummary(false)
    setMoveTrail(null)
    setUnhappyStreaks({})
    completionShownRef.current = false
  }, [round])

  const loadRound = useCallback((index: number): void => {
    const nextRound = ROUNDS[index]
    setRoundIndex(index)
    setRunning(false)
    setTurns(0)
    setBoard(createRoundBoard(nextRound))
    setHint(`${nextRound.label} layout ready.`)
    setShowRoundSummary(false)
    setMoveTrail(null)
    setUnhappyStreaks({})
    completionShownRef.current = false
  }, [])

  const runStep = useCallback(
    (fromAuto = false): boolean => {
      const step = moveOneUnhappy(board, round.tolerance)
      if (!step.moved || !step.source || !step.target) {
        setRunning(false)
        if (analysis.unhappyCount === 0) {
          setHint(segregationAlert ? 'Everyone is happy, but segregation is too high.' : 'Stable and integrated.')
        } else {
          setHint('No valid moves left. Remix to try a new random start.')
        }
        return false
      }

      setBoard(step.board)
      setTurns((value) => value + 1)
      setMoveTrail({ from: keyFor(step.source), to: keyFor(step.target) })

      const nextAnalysis = analyzeBoard(step.board, round.tolerance)
      if (nextAnalysis.unhappyCount === 0) {
        if (nextAnalysis.segregation <= round.targetSegregation) {
          setHint('Everyone is happy and segregation stayed low.')
        } else {
          setHint('Everyone is happy, but segregation is still high.')
        }
        if (fromAuto) {
          setRunning(false)
        }
      } else if (!fromAuto) {
        setHint('One unhappy household moved.')
      }

      return true
    },
    [analysis.unhappyCount, board, round.targetSegregation, round.tolerance, segregationAlert],
  )

  useEffect(() => {
    if (!running || showIntro || showRoundSummary) {
      return
    }

    const timer = window.setTimeout(() => {
      runStep(true)
    }, STEP_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [board, runStep, running, showIntro, showRoundSummary])

  const goToNextRound = (): void => {
    if (roundIndex >= ROUNDS.length - 1) {
      setShowRoundSummary(false)
      setHint('All rounds cleared. Remix or replay any round.')
      return
    }
    loadRound(roundIndex + 1)
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
    <main className="relative min-h-screen bg-[radial-gradient(circle_at_10%_10%,#d9edff_0%,transparent_42%),radial-gradient(circle_at_90%_90%,#ffe7d3_0%,transparent_36%),linear-gradient(180deg,#f9fbff_0%,#edf2f8_100%)] px-3 pb-10 pt-4">
      <section className="mx-auto w-full max-w-md rounded-2xl border border-white/80 bg-white/92 p-3 shadow-[0_18px_40px_rgba(16,24,40,0.12)] backdrop-blur">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Core Lab</p>
            <h1 className="text-xl font-semibold text-slate-900">Block 'Burb</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowIntro(true)
                setRunning(false)
              }}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
            >
              How
            </button>
            <button
              type="button"
              onClick={() => setMode('advanced')}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
            >
              Advanced
            </button>
          </div>
        </header>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-slate-100 px-2 py-2 text-center">
            <p className="text-[10px] uppercase text-slate-500">Turns</p>
            <p className="text-base font-semibold text-slate-900">{turns}</p>
          </div>
          <div className="rounded-lg bg-slate-100 px-2 py-2 text-center">
            <p className="text-[10px] uppercase text-slate-500">Unhappy</p>
            <p className="text-base font-semibold text-rose-700">{analysis.unhappyCount}</p>
          </div>
          <div className="rounded-lg bg-slate-100 px-2 py-2">
            <p className="text-[10px] uppercase text-slate-500">Segregation</p>
            <p className={`text-sm font-semibold ${segregationAlert ? 'text-rose-700' : 'text-emerald-700'}`}>
              {analysis.segregation}%
            </p>
            <div className="relative mt-1 h-2 rounded-full bg-gradient-to-r from-emerald-400 via-amber-300 to-rose-500">
              <span
                className="absolute -top-[3px] h-3 w-[2px] rounded bg-slate-900"
                style={{ left: `calc(${segregationNeedleLeft}% - 1px)` }}
              />
              <span
                className="absolute -top-[2px] h-2.5 w-[2px] rounded bg-white/95 shadow"
                style={{ left: `calc(${targetMarkerLeft}% - 1px)` }}
              />
            </div>
          </div>
        </div>

        <p className="mt-2 text-center text-[11px] text-slate-600">
          Round {round.id}: {round.label} • tolerance {Math.round(round.tolerance * 100)}% • target ≤ {round.targetSegregation}%
        </p>

        <div className="mt-3 rounded-xl border border-slate-200 bg-[#f3f6fb] p-2">
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))` }}>
            {board.flatMap((row, rowIndex) =>
              row.map((cell, colIndex) => {
                const key = keyFor({ row: rowIndex, col: colIndex })
                const unhappy = analysis.unhappyKeys.has(key)
                const streak = unhappyStreaks[key] ?? 0
                const pulseClass = !unhappy
                  ? ''
                  : streak >= 7
                    ? 'unhappy-pulse-strong'
                    : streak >= 4
                      ? 'unhappy-pulse-medium'
                      : 'unhappy-pulse-light'
                const trailClass = moveTrail && (moveTrail.from === key || moveTrail.to === key) ? 'trail-glow tile-pop' : ''
                return (
                  <div
                    key={`cell-${rowIndex}-${colIndex}`}
                    className={`relative aspect-square rounded-md border ${cellClass(cell)} ${pulseClass} ${trailClass}`}
                  />
                )
              }),
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setRunning((value) => !value)}
            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
          >
            {running ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            onClick={() => runStep(false)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
          >
            Step
          </button>
          <button
            type="button"
            onClick={resetRound}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
          >
            Remix
          </button>
        </div>

        <div className="mt-3 flex items-center justify-center gap-2">
          {ROUNDS.map((item, index) => {
            const active = index === roundIndex
            const cleared = clearedRounds[index]
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => loadRound(index)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  active
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : cleared
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-slate-300 bg-white text-slate-600'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        <p className="mt-2 text-center text-xs text-slate-600">{hint}</p>

        <div className="mt-2 text-center text-[11px] text-slate-500">
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-sky-700 underline underline-offset-2"
          >
            About / Repository
          </a>
        </div>
      </section>

      {showIntro && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/80 bg-white p-4 shadow-xl">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">How It Works</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">Watch Sorting Happen</h2>
            <p className="mt-2 text-sm text-slate-700">The board starts random. Unhappy households pulse, then relocate into empty homes.</p>
            <p className="mt-2 text-sm text-slate-700">Keep segregation at or below the target while getting unhappy households to 0.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowIntro(false)
                  setRunning(false)
                  setHint('Use Play to watch movement unfold.')
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowIntro(false)
                  setRunning(true)
                  setHint('Simulation running. Watch clusters form.')
                }}
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
              >
                Start
              </button>
            </div>
          </div>
        </div>
      )}

      {showRoundSummary && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/80 bg-white p-4 shadow-xl">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Round Complete</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">{round.label} cleared in {turns} turns</h2>
            <p className="mt-2 text-sm text-slate-700">
              Final segregation: <span className={segregationAlert ? 'font-semibold text-rose-700' : 'font-semibold text-emerald-700'}>{analysis.segregation}%</span>
              {' '}with {analysis.totalAgents} households.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowRoundSummary(false)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
              >
                Keep Exploring
              </button>
              <button
                type="button"
                onClick={goToNextRound}
                className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
              >
                {roundIndex >= ROUNDS.length - 1 ? 'Done' : 'Next Round'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default App
