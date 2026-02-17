import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type AgentColor = 'blue' | 'orange'
type Cell = AgentColor | null
type Board = Cell[][]

interface RoundConfig {
  id: number
  label: string
  size: number
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

interface PreferenceRule {
  minLike: number
  maxLike: number
}

const STEP_DELAY_MS = 360
const GITHUB_REPO_URL = 'https://github.com/professorcaren/block-burb'
const SCENE_ZERO_ID = 0
const SCENE_TWO_ID = 2
const SCENE_TWO_MIN_BIAS = 20
const SCENE_TWO_MAX_BIAS = 60
const SCENE_TWO_DEFAULT_BIAS = 33
const SCENE_THREE_ID = 3
const SCENE_THREE_MIN_DEFAULT = 10
const SCENE_THREE_MAX_DEFAULT = 80
const SCENE_THREE_MIN_GAP = 5
const SCENE_FOUR_ID = 4
const SCENE_FOUR_DEFAULT_BLUE_SHARE = 50
const SCENE_FOUR_DEFAULT_EMPTY_PERCENT = 20
const SCENE_FOUR_MIN_EMPTY_PERCENT = 5
const SCENE_FOUR_MAX_EMPTY_PERCENT = 45

const ROUNDS: RoundConfig[] = [
  { id: 0, label: 'Scene 0', size: 4, tolerance: 0.26, targetSegregation: 100, blueCount: 2, orangeCount: 4 },
  { id: 1, label: 'Scene 1', size: 8, tolerance: 0.26, targetSegregation: 60, blueCount: 24, orangeCount: 20 },
  { id: 2, label: 'Scene 2', size: 8, tolerance: 0.33, targetSegregation: 56, blueCount: 25, orangeCount: 21 },
  { id: 3, label: 'Scene 3', size: 8, tolerance: 0.56, targetSegregation: 52, blueCount: 26, orangeCount: 22 },
  { id: 4, label: 'Scene 4', size: 8, tolerance: 0.56, targetSegregation: 52, blueCount: 25, orangeCount: 25 },
]

const SCENE_INTRO_TEXT: Record<number, string> = {
  0: 'Blocks are unhappy when too few neighbors are similar. Drag blocks until everyone is happy.',
  1: 'Scene 1 adds auto-movement so mild local preferences can create citywide patterns.',
  2: 'Scene 2 adds an individual bias slider so you can test tipping points.',
  3: 'Scene 3 adds diversity preference, so too little or too much similarity can trigger moves.',
  4: 'Scene 4 adds population and vacancy controls on top of the diversity rule.',
}

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

const inBounds = (row: number, col: number, size: number): boolean =>
  row >= 0 && col >= 0 && row < size && col < size

const keyFor = (position: Position): string => `${position.row}:${position.col}`
const isDiversityScene = (sceneId: number): boolean => sceneId === SCENE_THREE_ID || sceneId === SCENE_FOUR_ID

const shuffle = <T,>(items: T[]): T[] => {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

const createRoundBoard = (round: RoundConfig): Board => {
  const board = Array.from({ length: round.size }, () =>
    Array.from({ length: round.size }, () => null as Cell),
  )

  const placements = shuffle([
    ...Array.from({ length: round.blueCount }, () => 'blue' as const),
    ...Array.from({ length: round.orangeCount }, () => 'orange' as const),
    ...Array.from({ length: round.size * round.size - round.blueCount - round.orangeCount }, () => null as Cell),
  ])

  let index = 0
  for (let row = 0; row < round.size; row += 1) {
    for (let col = 0; col < round.size; col += 1) {
      board[row][col] = placements[index]
      index += 1
    }
  }

  return board
}

const cloneBoard = (board: Board): Board => board.map((row) => [...row])

const analyzeBoard = (board: Board, preference: PreferenceRule): BoardAnalysis => {
  const size = board.length
  let unhappyCount = 0
  let totalAgents = 0
  let sameAdjacency = 0
  let mixedAdjacency = 0
  const unhappyKeys = new Set<string>()

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
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
        if (!inBounds(nextRow, nextCol, size)) {
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

      const sameRatio = occupiedNeighbors === 0 ? 0 : sameColorNeighbors / occupiedNeighbors
      if (
        occupiedNeighbors > 0
        && (sameRatio < preference.minLike || sameRatio > preference.maxLike)
      ) {
        unhappyCount += 1
        unhappyKeys.add(keyFor({ row, col }))
      }

      for (const offset of adjacencyOffsets) {
        const nextRow = row + offset.row
        const nextCol = col + offset.col
        if (!inBounds(nextRow, nextCol, size)) {
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

const minimumUnhappyForRound = (round: RoundConfig): number => {
  if (round.id === 1) {
    return 1
  }
  if (round.id === SCENE_TWO_ID) {
    return Math.max(6, Math.round((round.blueCount + round.orangeCount) * 0.12))
  }
  return Math.max(4, Math.round((round.blueCount + round.orangeCount) * 0.1))
}

const roundWithComposition = (
  round: RoundConfig,
  blueSharePercent: number,
  emptyPercent: number,
): RoundConfig => {
  if (round.id !== SCENE_FOUR_ID) {
    return round
  }

  const totalCells = round.size * round.size
  const targetOccupied = Math.max(2, Math.round(((100 - emptyPercent) / 100) * totalCells))
  const occupied = targetOccupied % 2 === 0 ? targetOccupied : targetOccupied - 1
  const blueCount = Math.max(1, Math.min(occupied - 1, Math.round((blueSharePercent / 100) * occupied)))
  const orangeCount = Math.max(1, occupied - blueCount)

  return {
    ...round,
    blueCount,
    orangeCount,
  }
}

const preferenceForRound = (
  round: RoundConfig,
  roundTwoBias: number,
  sceneThreeMinLike: number,
  sceneThreeMaxLike: number,
): PreferenceRule => {
  if (round.id === SCENE_TWO_ID) {
    return { minLike: roundTwoBias / 100, maxLike: 1 }
  }

  if (isDiversityScene(round.id)) {
    return { minLike: sceneThreeMinLike / 100, maxLike: sceneThreeMaxLike / 100 }
  }

  return { minLike: round.tolerance, maxLike: 1 }
}

const createSegregatedSceneBoard = (round: RoundConfig): Board => {
  const board = Array.from({ length: round.size }, () =>
    Array.from({ length: round.size }, () => null as Cell),
  )
  const leftZone: Position[] = []
  const rightZone: Position[] = []
  const split = Math.floor(round.size / 2)

  for (let row = 0; row < round.size; row += 1) {
    for (let col = 0; col < round.size; col += 1) {
      if (col < split) {
        leftZone.push({ row, col })
      } else {
        rightZone.push({ row, col })
      }
    }
  }

  const bluePrimary = shuffle(leftZone)
  const orangePrimary = shuffle(rightZone)
  const blueOverflow = shuffle(rightZone)
  const orangeOverflow = shuffle(leftZone)

  const fill = (positions: Position[], count: number, color: AgentColor): number => {
    let placed = 0
    for (let index = 0; index < positions.length && placed < count; index += 1) {
      const cell = positions[index]
      if (board[cell.row][cell.col] === null) {
        board[cell.row][cell.col] = color
        placed += 1
      }
    }
    return count - placed
  }

  const blueRemaining = fill(bluePrimary, round.blueCount, 'blue')
  fill(blueOverflow, blueRemaining, 'blue')

  const orangeRemaining = fill(orangePrimary, round.orangeCount, 'orange')
  fill(orangeOverflow, orangeRemaining, 'orange')

  return board
}

const createSceneZeroBoard = (round: RoundConfig): Board => {
  const board = Array.from({ length: round.size }, () =>
    Array.from({ length: round.size }, () => null as Cell),
  )
  const variants: Array<{ blues: Position[]; oranges: Position[] }> = [
    {
      blues: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
      ],
      oranges: [
        { row: 0, col: 2 },
        { row: 0, col: 1 },
        { row: 1, col: 0 },
        { row: 1, col: 1 },
        { row: 1, col: 2 },
      ],
    },
    {
      blues: [
        { row: 0, col: round.size - 1 },
        { row: 0, col: round.size - 2 },
      ],
      oranges: [
        { row: 0, col: round.size - 3 },
        { row: 1, col: round.size - 3 },
        { row: 1, col: round.size - 1 },
        { row: 1, col: round.size - 2 },
        { row: 0, col: round.size - 2 },
      ],
    },
    {
      blues: [
        { row: round.size - 1, col: 0 },
        { row: round.size - 1, col: 1 },
      ],
      oranges: [
        { row: round.size - 1, col: 2 },
        { row: round.size - 2, col: 2 },
        { row: round.size - 2, col: 0 },
        { row: round.size - 2, col: 1 },
        { row: round.size - 1, col: 1 },
      ],
    },
    {
      blues: [
        { row: round.size - 1, col: round.size - 1 },
        { row: round.size - 1, col: round.size - 2 },
      ],
      oranges: [
        { row: round.size - 1, col: round.size - 3 },
        { row: round.size - 2, col: round.size - 3 },
        { row: round.size - 2, col: round.size - 1 },
        { row: round.size - 2, col: round.size - 2 },
        { row: round.size - 1, col: round.size - 2 },
      ],
    },
  ]

  const variant = variants[Math.floor(Math.random() * variants.length)]
  for (const blue of variant.blues) {
    board[blue.row][blue.col] = 'blue'
  }
  for (const orange of variant.oranges) {
    if (board[orange.row][orange.col] === null) {
      board[orange.row][orange.col] = 'orange'
    }
  }

  return board
}

const createPlayableRoundBoard = (round: RoundConfig, preference: PreferenceRule): Board => {
  if (round.id === SCENE_ZERO_ID) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const candidate = createSceneZeroBoard(round)
      const analysis = analyzeBoard(candidate, preference)
      if (analysis.unhappyCount > 0) {
        return candidate
      }
    }
    return createSceneZeroBoard(round)
  }

  if (isDiversityScene(round.id)) {
    return createSegregatedSceneBoard(round)
  }

  let firstCandidate: Board | null = null
  let firstUnhappyCandidate: Board | null = null

  for (let attempt = 0; attempt < 120; attempt += 1) {
    const candidate = createRoundBoard(round)
    const analysis = analyzeBoard(candidate, preference)
    if (firstCandidate === null) {
      firstCandidate = candidate
    }

    if (analysis.unhappyCount > 0 && firstUnhappyCandidate === null) {
      firstUnhappyCandidate = candidate
    }

    if (analysis.unhappyCount >= minimumUnhappyForRound(round)) {
      return candidate
    }
  }

  return firstUnhappyCandidate ?? firstCandidate ?? createRoundBoard(round)
}

const collectVacancies = (board: Board): Position[] => {
  const vacancies: Position[] = []
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
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

const moveOneUnhappy = (board: Board, preference: PreferenceRule): StepResult => {
  const analysis = analyzeBoard(board, preference)
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
  round.id === SCENE_ZERO_ID
    ? analysis.unhappyCount === 0
    : analysis.unhappyCount === 0 && analysis.segregation <= round.targetSegregation

function App() {
  const [roundIndex, setRoundIndex] = useState(0)
  const [roundTwoBias, setRoundTwoBias] = useState(SCENE_TWO_DEFAULT_BIAS)
  const [sceneThreeMinLike, setSceneThreeMinLike] = useState(SCENE_THREE_MIN_DEFAULT)
  const [sceneThreeMaxLike, setSceneThreeMaxLike] = useState(SCENE_THREE_MAX_DEFAULT)
  const [sceneFourBlueShare, setSceneFourBlueShare] = useState(SCENE_FOUR_DEFAULT_BLUE_SHARE)
  const [sceneFourEmptyPercent, setSceneFourEmptyPercent] = useState(SCENE_FOUR_DEFAULT_EMPTY_PERCENT)
  const [board, setBoard] = useState<Board>(() =>
    createPlayableRoundBoard(
      ROUNDS[0],
      preferenceForRound(ROUNDS[0], SCENE_TWO_DEFAULT_BIAS, SCENE_THREE_MIN_DEFAULT, SCENE_THREE_MAX_DEFAULT),
    ),
  )
  const [running, setRunning] = useState(false)
  const [turns, setTurns] = useState(0)
  const [hint, setHint] = useState('Scene 0: drag the unhappy block to an empty home.')
  const [showWelcome, setShowWelcome] = useState(true)
  const [showSceneIntro, setShowSceneIntro] = useState(false)
  const [showRoundSummary, setShowRoundSummary] = useState(false)
  const [clearedRounds, setClearedRounds] = useState<boolean[]>(Array.from({ length: ROUNDS.length }, () => false))
  const [moveTrail, setMoveTrail] = useState<{ from: string; to: string } | null>(null)
  const [unhappyStreaks, setUnhappyStreaks] = useState<Record<string, number>>({})
  const [dragSource, setDragSource] = useState<Position | null>(null)
  const [dragTargetKey, setDragTargetKey] = useState<string | null>(null)

  const completionShownRef = useRef(false)
  const round = ROUNDS[roundIndex]
  const activeRound = useMemo(
    () => roundWithComposition(round, sceneFourBlueShare, sceneFourEmptyPercent),
    [round, sceneFourBlueShare, sceneFourEmptyPercent],
  )
  const effectivePreference = useMemo(
    () => preferenceForRound(activeRound, roundTwoBias, sceneThreeMinLike, sceneThreeMaxLike),
    [activeRound, roundTwoBias, sceneThreeMaxLike, sceneThreeMinLike],
  )
  const analysis = useMemo(() => analyzeBoard(board, effectivePreference), [board, effectivePreference])
  const completed = turns > 0 && isRoundCompleted(analysis, activeRound)
  const segregationAlert = analysis.segregation > activeRound.targetSegregation
  const segregationNeedleLeft = Math.max(2, Math.min(98, analysis.segregation))
  const targetMarkerLeft = Math.max(2, Math.min(98, activeRound.targetSegregation))
  const sceneZeroActive = round.id === SCENE_ZERO_ID
  const sceneFourOccupiedPercent = 100 - sceneFourEmptyPercent
  const sceneFourBluePercent = (sceneFourOccupiedPercent * sceneFourBlueShare) / 100
  const sceneFourOrangePercent = sceneFourOccupiedPercent - sceneFourBluePercent
  const sceneFourOrangeShare = 100 - sceneFourBlueShare
  const sceneIntroText = SCENE_INTRO_TEXT[round.id] ?? 'Watch what changes in this scene.'

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
    setBoard(createPlayableRoundBoard(activeRound, effectivePreference))
    if (activeRound.id === SCENE_ZERO_ID) {
      setHint('Drag the unhappy block to any empty home.')
    } else if (isDiversityScene(activeRound.id)) {
      setHint('Segregated start loaded. Press Start to watch reshuffling.')
    } else {
      setHint('Random start loaded. Watch the pulse, then move.')
    }
    setShowRoundSummary(false)
    setMoveTrail(null)
    setUnhappyStreaks({})
    setDragSource(null)
    setDragTargetKey(null)
    completionShownRef.current = false
  }, [activeRound, effectivePreference])

  const loadRound = useCallback((index: number): void => {
    const baseRound = ROUNDS[index]
    const nextRound = roundWithComposition(baseRound, sceneFourBlueShare, sceneFourEmptyPercent)
    const nextPreference = preferenceForRound(nextRound, roundTwoBias, sceneThreeMinLike, sceneThreeMaxLike)
    setRoundIndex(index)
    setRunning(false)
    setTurns(0)
    setBoard(createPlayableRoundBoard(nextRound, nextPreference))
    if (nextRound.id === SCENE_ZERO_ID) {
      setHint('Scene 0 ready. Drag the unhappy block to an empty home.')
    } else if (isDiversityScene(nextRound.id)) {
      setHint(`${nextRound.label} starts segregated. Press Start.`)
    } else {
      setHint(`${nextRound.label} ready.`)
    }
    setShowRoundSummary(false)
    setShowSceneIntro(true)
    setMoveTrail(null)
    setUnhappyStreaks({})
    setDragSource(null)
    setDragTargetKey(null)
    completionShownRef.current = false
  }, [roundTwoBias, sceneFourBlueShare, sceneFourEmptyPercent, sceneThreeMaxLike, sceneThreeMinLike])

  const handleSceneZeroDrop = useCallback((target: Position): void => {
    if (!sceneZeroActive || !dragSource) {
      return
    }

    if (dragSource.row === target.row && dragSource.col === target.col) {
      setDragSource(null)
      setDragTargetKey(null)
      return
    }

    if (board[target.row][target.col] !== null) {
      return
    }

    const next = cloneBoard(board)
    next[target.row][target.col] = next[dragSource.row][dragSource.col]
    next[dragSource.row][dragSource.col] = null
    setBoard(next)
    setTurns((value) => value + 1)
    setMoveTrail({ from: keyFor(dragSource), to: keyFor(target) })
    setRunning(false)
    setDragSource(null)
    setDragTargetKey(null)

    const nextAnalysis = analyzeBoard(next, effectivePreference)
    if (nextAnalysis.unhappyCount === 0) {
      setHint('All households are happy.')
    } else {
      setHint('Nice move. Keep dragging to an empty home.')
    }
  }, [board, dragSource, effectivePreference, sceneZeroActive])

  const handleSceneZeroCellPress = useCallback((position: Position): void => {
    if (!sceneZeroActive) {
      return
    }

    const cell = board[position.row][position.col]
    if (cell !== null) {
      setDragSource(position)
      setDragTargetKey(null)
      return
    }

    handleSceneZeroDrop(position)
  }, [board, handleSceneZeroDrop, sceneZeroActive])

  const runStep = useCallback(
    (fromAuto = false): boolean => {
      const step = moveOneUnhappy(board, effectivePreference)
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

      const nextAnalysis = analyzeBoard(step.board, effectivePreference)
      if (nextAnalysis.unhappyCount === 0) {
        if (nextAnalysis.segregation <= activeRound.targetSegregation) {
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
    [activeRound.targetSegregation, analysis.unhappyCount, board, effectivePreference, segregationAlert],
  )

  useEffect(() => {
    if (!running || showWelcome || showSceneIntro || showRoundSummary || sceneZeroActive) {
      return
    }

    const timer = window.setTimeout(() => {
      runStep(true)
    }, STEP_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [board, runStep, running, sceneZeroActive, showSceneIntro, showWelcome, showRoundSummary])

  const goToNextRound = (): void => {
    if (roundIndex >= ROUNDS.length - 1) {
      setShowRoundSummary(false)
      setHint('All scenes cleared. Remix or replay any scene.')
      return
    }
    loadRound(roundIndex + 1)
  }

  return (
    <main className="relative min-h-screen bg-[radial-gradient(circle_at_10%_10%,#d9edff_0%,transparent_42%),radial-gradient(circle_at_90%_90%,#ffe7d3_0%,transparent_36%),linear-gradient(180deg,#f9fbff_0%,#edf2f8_100%)] px-3 pb-10 pt-4">
      <section className="mx-auto w-full max-w-md rounded-2xl border border-white/80 bg-white/92 p-3 shadow-[0_18px_40px_rgba(16,24,40,0.12)] backdrop-blur">
        <header className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900">Block 'Burb</h1>
          <button
            type="button"
            onClick={() => {
              setShowSceneIntro(true)
              setRunning(false)
            }}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
          >
            How
          </button>
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

        <div className="mt-3 rounded-xl border border-slate-200 bg-[#f3f6fb] p-2">
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${board.length}, minmax(0, 1fr))` }}>
            {board.flatMap((row, rowIndex) =>
              row.map((cell, colIndex) => {
                const key = keyFor({ row: rowIndex, col: colIndex })
                const unhappy = analysis.unhappyKeys.has(key)
                const streak = unhappyStreaks[key] ?? 0
                const isSource = dragSource !== null && keyFor(dragSource) === key
                const isDragTarget = dragTargetKey === key
                const pulseClass = !unhappy
                  ? ''
                  : streak >= 7
                    ? 'unhappy-pulse-strong'
                    : streak >= 4
                      ? 'unhappy-pulse-medium'
                      : 'unhappy-pulse-light'
                const unhappyGlowClass = unhappy ? 'ring-2 ring-rose-400/70 ring-offset-1' : ''
                const trailClass = moveTrail && (moveTrail.from === key || moveTrail.to === key) ? 'trail-glow tile-pop' : ''
                const dragClass = isSource
                  ? 'ring-2 ring-slate-900 ring-offset-1'
                  : isDragTarget
                    ? 'ring-2 ring-slate-400 ring-offset-1'
                    : ''
                return (
                  <div
                    key={`cell-${rowIndex}-${colIndex}`}
                    className={`relative aspect-square rounded-md border ${cellClass(cell)} ${pulseClass} ${unhappyGlowClass} ${trailClass} ${dragClass}`}
                    onPointerDown={(event) => {
                      if (!sceneZeroActive) {
                        return
                      }
                      event.preventDefault()
                      handleSceneZeroCellPress({ row: rowIndex, col: colIndex })
                    }}
                    onPointerEnter={() => {
                      if (!sceneZeroActive || !dragSource) {
                        return
                      }
                      if (board[rowIndex][colIndex] === null) {
                        setDragTargetKey(key)
                      } else {
                        setDragTargetKey(null)
                      }
                    }}
                    onPointerUp={() => {
                      if (!sceneZeroActive || !dragSource) {
                        return
                      }
                      handleSceneZeroDrop({ row: rowIndex, col: colIndex })
                    }}
                    onPointerLeave={() => {
                      if (!sceneZeroActive || dragTargetKey !== key) {
                        return
                      }
                      setDragTargetKey(null)
                    }}
                  />
                )
              }),
            )}
          </div>
        </div>

        {round.id === SCENE_TWO_ID && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 px-2 py-2">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-800">
              <span>Bias Slider</span>
              <span>{roundTwoBias}%</span>
            </div>
            <input
              type="range"
              min={SCENE_TWO_MIN_BIAS}
              max={SCENE_TWO_MAX_BIAS}
              step={1}
              value={roundTwoBias}
              onChange={(event) => {
                const value = Number(event.target.value)
                setRoundTwoBias(value)
                setRunning(false)
                setHint(`Scene 2 bias set to ${value}%. Remix or press Start.`)
              }}
              className="mt-1 h-2 w-full cursor-pointer accent-amber-600"
            />
          </div>
        )}

        {isDiversityScene(round.id) && (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/70 px-2 py-2">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-800">
              <span>Diversity Range</span>
              <span>{sceneThreeMinLike}% - {sceneThreeMaxLike}% alike</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-800/90">
              <span>Minimum alike</span>
              <span>{sceneThreeMinLike}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={60}
              step={1}
              value={sceneThreeMinLike}
              onChange={(event) => {
                const value = Number(event.target.value)
                const bounded = Math.min(value, sceneThreeMaxLike - SCENE_THREE_MIN_GAP)
                setSceneThreeMinLike(bounded)
                setRunning(false)
                setHint(`${round.label} range: ${bounded}% to ${sceneThreeMaxLike}% alike.`)
              }}
              className="mt-1 h-2 w-full cursor-pointer accent-emerald-600"
            />
            <div className="mt-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-800/90">
              <span>Maximum alike</span>
              <span>{sceneThreeMaxLike}%</span>
            </div>
            <input
              type="range"
              min={40}
              max={100}
              step={1}
              value={sceneThreeMaxLike}
              onChange={(event) => {
                const value = Number(event.target.value)
                const bounded = Math.max(value, sceneThreeMinLike + SCENE_THREE_MIN_GAP)
                setSceneThreeMaxLike(bounded)
                setRunning(false)
                setHint(`${round.label} range: ${sceneThreeMinLike}% to ${bounded}% alike.`)
              }}
              className="mt-1 h-2 w-full cursor-pointer accent-emerald-600"
            />
            <div className="relative mt-2 h-2 rounded-full bg-slate-200">
              <span
                className="absolute inset-y-0 rounded-full bg-emerald-500/75"
                style={{
                  left: `${sceneThreeMinLike}%`,
                  right: `${100 - sceneThreeMaxLike}%`,
                }}
              />
            </div>
          </div>
        )}

        {round.id === SCENE_FOUR_ID && (
          <div className="mt-3 rounded-lg border border-slate-300 bg-slate-100/80 px-2 py-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-800">
              <span>orange:blue ratio {sceneFourOrangeShare}:{sceneFourBlueShare}</span>
              <span>empty {sceneFourEmptyPercent}%</span>
            </div>
            <div className="relative mt-2 h-3 overflow-hidden rounded-full border border-slate-300 bg-slate-200">
              <span
                className="absolute inset-y-0 left-0 bg-[#d97a2f]"
                style={{ width: `${sceneFourOrangePercent}%` }}
              />
              <span
                className="absolute inset-y-0 bg-[#1f5ea8]"
                style={{ left: `${sceneFourOrangePercent}%`, width: `${sceneFourBluePercent}%` }}
              />
              <span
                className="absolute inset-y-0 right-0 bg-slate-900"
                style={{ width: `${sceneFourEmptyPercent}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-700">
              <span>blue share</span>
              <span>{sceneFourBlueShare}%</span>
            </div>
            <input
              type="range"
              min={20}
              max={80}
              step={1}
              value={sceneFourBlueShare}
              onChange={(event) => {
                const value = Number(event.target.value)
                setSceneFourBlueShare(value)
                setRunning(false)
                setTurns(0)
                const nextRound = roundWithComposition(round, value, sceneFourEmptyPercent)
                const nextPreference = preferenceForRound(nextRound, roundTwoBias, sceneThreeMinLike, sceneThreeMaxLike)
                setBoard(createPlayableRoundBoard(nextRound, nextPreference))
                setShowRoundSummary(false)
                setMoveTrail(null)
                setUnhappyStreaks({})
                setDragSource(null)
                setDragTargetKey(null)
                completionShownRef.current = false
                setHint(`Scene 4 mix set to ${100 - value}:${value} with ${sceneFourEmptyPercent}% empty.`)
              }}
              className="mt-2 h-2 w-full cursor-pointer accent-slate-700"
            />
            <div className="mt-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-700">
              <span>empty homes</span>
              <span>{sceneFourEmptyPercent}%</span>
            </div>
            <input
              type="range"
              min={SCENE_FOUR_MIN_EMPTY_PERCENT}
              max={SCENE_FOUR_MAX_EMPTY_PERCENT}
              step={1}
              value={sceneFourEmptyPercent}
              onChange={(event) => {
                const value = Number(event.target.value)
                setSceneFourEmptyPercent(value)
                setRunning(false)
                setTurns(0)
                const nextRound = roundWithComposition(round, sceneFourBlueShare, value)
                const nextPreference = preferenceForRound(nextRound, roundTwoBias, sceneThreeMinLike, sceneThreeMaxLike)
                setBoard(createPlayableRoundBoard(nextRound, nextPreference))
                setShowRoundSummary(false)
                setMoveTrail(null)
                setUnhappyStreaks({})
                setDragSource(null)
                setDragTargetKey(null)
                completionShownRef.current = false
                setHint(`Scene 4 empty homes set to ${value}%.`)
              }}
              className="mt-1 h-2 w-full cursor-pointer accent-slate-700"
            />
          </div>
        )}

        {sceneZeroActive ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setDragSource(null)
                setDragTargetKey(null)
              }}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
            >
              Clear Drag
            </button>
            <button
              type="button"
              onClick={resetRound}
              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
            >
              Remix
            </button>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setRunning((value) => !value)}
              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
            >
              {running ? 'Pause' : 'Start'}
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
        )}

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

      {showWelcome && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/80 bg-white p-4 shadow-xl">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Welcome</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">Block 'Burb</h2>
            <p className="mt-2 text-sm text-slate-700">Block 'Burb lets you explore how neighborhood preferences shape city patterns.</p>
            <p className="mt-2 text-sm text-slate-700">Small local choices can produce big collective outcomes.</p>
            <button
              type="button"
              onClick={() => {
                setShowWelcome(false)
                setShowSceneIntro(true)
                setRunning(false)
              }}
              className="mt-3 w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
            >
              Start
            </button>
          </div>
        </div>
      )}

      {showSceneIntro && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/80 bg-white p-4 shadow-xl">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{round.label}</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">What&apos;s New</h2>
            <p className="mt-2 text-sm text-slate-700">{sceneIntroText}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowSceneIntro(false)
                  setRunning(false)
                  if (sceneZeroActive) {
                    setHint('Scene 0: drag the unhappy block to an empty home.')
                  } else {
                    setHint(`${round.label} ready.`)
                  }
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSceneIntro(false)
                  if (sceneZeroActive) {
                    setRunning(false)
                    setHint('Scene 0: drag the unhappy block to an empty home.')
                  } else {
                    setRunning(true)
                    setHint('Simulation running. Watch clusters form.')
                  }
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
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Scene Complete</p>
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
                {roundIndex >= ROUNDS.length - 1 ? 'Done' : 'Next Scene'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default App
