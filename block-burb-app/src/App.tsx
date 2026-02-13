import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TouchEvent } from 'react'
import {
  calculateIntegrationIndex,
  calculateSegregationIndex,
  countHouseholds,
  generateEquilibriumMap,
} from '@/game/debrief'
import { DEFAULT_CONFIG } from '@/game/config'
import { applyTurn, createInitialState, endSession } from '@/game/engine'
import type { Board, Coordinate, Direction, GameConfig, HouseholdColor, HouseholdTile } from '@/game/types'

interface TouchPoint {
  x: number
  y: number
}

interface OnboardingStep {
  title: string
  body: string
}

const ONBOARDING_STORAGE_KEY = 'block-burb-onboarding-level1-v1'

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: 'What This Level Shows',
    body: 'This level models one mild preference: households do not want to be the only one like them nearby.',
  },
  {
    title: 'How To Move',
    body: 'Tap a pulsing household (unhappy), then swipe or use the arrows. It moves to the nearest vacancy in that direction.',
  },
  {
    title: 'What Counts As Success',
    body: 'There is no score in Level 1. Reach equilibrium: zero unhappy households before the turn limit.',
  },
  {
    title: 'What To Watch',
    body: 'Track Integration and Segregation indexes. Small isolation fixes can still create large-scale clustering.',
  },
]

const DIRECTION_SYMBOL: Record<Direction, string> = {
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
}

const householdClasses = (tile: HouseholdTile): string =>
  tile.color === 'blue'
    ? 'bg-[#1f5ea8] text-[#e8f4ff] border-[#19467f]'
    : 'bg-[#d97a2f] text-[#fff0e4] border-[#b85f1e]'

const keyFor = (coordinate: Coordinate): string => `${coordinate.row}:${coordinate.col}`

const isSameCoordinate = (a: Coordinate | null, b: Coordinate): boolean =>
  a !== null && a.row === b.row && a.col === b.col

const gameOverMessage = (reason: string | null): string => {
  if (reason === 'equilibrium') {
    return 'Equilibrium reached: no unhappy households remain.'
  }

  if (reason === 'max_turns') {
    return 'Turn limit reached before full equilibrium.'
  }

  if (reason === 'manual_end') {
    return 'Session ended.'
  }

  return 'Session complete.'
}

const clampScenario = (config: GameConfig): GameConfig => ({
  size: 12,
  initialOccupancy: Math.max(0.7, Math.min(0.97, config.initialOccupancy)),
  minorityShare: Math.max(0.1, Math.min(0.2, config.minorityShare)),
  maxTurns: Math.max(12, Math.min(60, Math.round(config.maxTurns))),
})

const DirectionPad = ({ onMove }: { onMove: (direction: Direction) => void }) => (
  <div className="mx-auto mt-3 grid w-[220px] grid-cols-3 grid-rows-3 gap-2">
    <span />
    <button
      type="button"
      onClick={() => onMove('up')}
      className="rounded-xl border border-slate-300 bg-white py-3 text-xl text-slate-700 shadow-sm active:scale-95"
      aria-label="Move up"
    >
      ↑
    </button>
    <span />

    <button
      type="button"
      onClick={() => onMove('left')}
      className="rounded-xl border border-slate-300 bg-white py-3 text-xl text-slate-700 shadow-sm active:scale-95"
      aria-label="Move left"
    >
      ←
    </button>

    <button
      type="button"
      onClick={() => onMove('down')}
      className="rounded-xl border border-slate-300 bg-white py-3 text-xl text-slate-700 shadow-sm active:scale-95"
      aria-label="Move down"
    >
      ↓
    </button>

    <button
      type="button"
      onClick={() => onMove('right')}
      className="rounded-xl border border-slate-300 bg-white py-3 text-xl text-slate-700 shadow-sm active:scale-95"
      aria-label="Move right"
    >
      →
    </button>
  </div>
)

const MiniMap = ({ board }: { board: Board }) => (
  <div
    className="grid gap-1 rounded-xl border border-slate-200 bg-slate-100/70 p-2"
    style={{ gridTemplateColumns: `repeat(${board.length}, minmax(0, 1fr))` }}
  >
    {board.flatMap((row, rowIndex) =>
      row.map((cell, colIndex) => (
        <div
          key={`final-${rowIndex}-${colIndex}`}
          className={`aspect-square rounded-sm ${
            cell === null ? 'bg-white/70' : cell.color === 'blue' ? 'bg-[#1f5ea8]' : 'bg-[#d97a2f]'
          }`}
        />
      )),
    )}
  </div>
)

const EquilibriumPreview = ({ map }: { map: (HouseholdColor | null)[][] }) => (
  <div
    className="grid gap-1 rounded-xl border border-slate-200 bg-slate-100/70 p-2"
    style={{ gridTemplateColumns: `repeat(${map.length}, minmax(0, 1fr))` }}
  >
    {map.flatMap((row, rowIndex) =>
      row.map((cell, colIndex) => (
        <div
          key={`equilibrium-${rowIndex}-${colIndex}`}
          className={`aspect-square rounded-sm ${
            cell === null ? 'bg-white/70' : cell === 'blue' ? 'bg-[#1f5ea8]' : 'bg-[#d97a2f]'
          }`}
        />
      )),
    )}
  </div>
)

function App() {
  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG)
  const [draftConfig, setDraftConfig] = useState<GameConfig>(DEFAULT_CONFIG)
  const [game, setGame] = useState(() => createInitialState(DEFAULT_CONFIG))
  const [selected, setSelected] = useState<Coordinate | null>(null)
  const [statusMessage, setStatusMessage] = useState('Select a pulsing household, then swipe to relocate it.')
  const [showScenario, setShowScenario] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingStepIndex, setOnboardingStepIndex] = useState(0)
  const touchStartRef = useRef<TouchPoint | null>(null)

  useEffect(() => {
    const hasSeen = window.localStorage.getItem(ONBOARDING_STORAGE_KEY)
    if (!hasSeen) {
      setShowOnboarding(true)
    }
  }, [])

  const closeOnboarding = (): void => {
    setShowOnboarding(false)
    setOnboardingStepIndex(0)
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, '1')
  }

  const openOnboarding = (): void => {
    setOnboardingStepIndex(0)
    setShowOnboarding(true)
  }

  const handleMove = useCallback(
    (direction: Direction) => {
      if (selected === null || game.gameOver) {
        setStatusMessage('Select an unhappy household first.')
        return
      }

      const next = applyTurn(game, selected, direction, config)
      setGame(next)

      if (!next.summary.selectedValid) {
        setSelected(null)
        setStatusMessage('Selected tile is no longer unhappy. Pick another pulsing household.')
        return
      }

      if (!next.summary.moved) {
        setStatusMessage(`No vacancy ${direction}. Try another direction.`)
        return
      }

      if (next.summary.lastMove !== null) {
        setSelected(next.summary.lastMove.to)
      }

      setStatusMessage(
        `Moved ${DIRECTION_SYMBOL[direction]}. Unhappy households: ${next.summary.unhappyBefore} -> ${next.summary.unhappyAfter}.`,
      )

      if (next.gameOver) {
        setSelected(null)
      }
    },
    [config, game, selected],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'ArrowUp') {
        handleMove('up')
      }
      if (event.key === 'ArrowDown') {
        handleMove('down')
      }
      if (event.key === 'ArrowLeft') {
        handleMove('left')
      }
      if (event.key === 'ArrowRight') {
        handleMove('right')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleMove])

  const onTouchStart = (event: TouchEvent<HTMLDivElement>): void => {
    const touch = event.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>): void => {
    if (touchStartRef.current === null) {
      return
    }

    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - touchStartRef.current.x
    const deltaY = touch.clientY - touchStartRef.current.y
    const threshold = 24

    if (Math.abs(deltaX) < threshold && Math.abs(deltaY) < threshold) {
      return
    }

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      handleMove(deltaX > 0 ? 'right' : 'left')
      return
    }

    handleMove(deltaY > 0 ? 'down' : 'up')
  }

  const selectCell = (row: number, col: number): void => {
    if (game.gameOver) {
      return
    }

    const cell = game.board[row][col]
    if (cell === null) {
      setSelected(null)
      setStatusMessage('That is a vacancy. Select a pulsing household instead.')
      return
    }

    if (!cell.unhappy) {
      setSelected(null)
      setStatusMessage('This household already has same-group support nearby.')
      return
    }

    setSelected({ row, col })
    setStatusMessage('Household selected. Swipe or press an arrow direction to move it.')
  }

  const restart = (): void => {
    setGame(createInitialState(config))
    setSelected(null)
    setStatusMessage('New board ready. Select a pulsing household to start.')
  }

  const endNow = (): void => {
    setGame((previous) => endSession(previous))
    setSelected(null)
  }

  const applyScenario = (): void => {
    const next = clampScenario(draftConfig)
    setConfig(next)
    setDraftConfig(next)
    setGame(createInitialState(next))
    setSelected(null)
    setShowScenario(false)
    setStatusMessage('Scenario updated. New board generated.')
  }

  const segregationIndex = useMemo(() => calculateSegregationIndex(game.board), [game.board])
  const integrationIndex = useMemo(() => calculateIntegrationIndex(game.board), [game.board])
  const unhappyCount = useMemo(
    () => game.board.flat().filter((cell) => cell !== null && cell.unhappy).length,
    [game.board],
  )
  const counts = useMemo(() => countHouseholds(game.board), [game.board])
  const minorityShare = useMemo(() => {
    const total = counts.blue + counts.orange
    if (total === 0) {
      return 0
    }
    return Math.round((counts.orange / total) * 100)
  }, [counts.blue, counts.orange])

  const equilibriumMap = useMemo(
    () => generateEquilibriumMap(game.board.length, counts.blue, counts.orange),
    [counts.blue, counts.orange, game.board.length],
  )

  const activeStep = ONBOARDING_STEPS[onboardingStepIndex]

  const lastMoveTrail = useMemo(() => {
    const trail = game.summary.lastMove?.trail ?? []
    return new Set(trail.map((coordinate) => keyFor(coordinate)))
  }, [game.summary.lastMove])

  const onboardingModal = showOnboarding ? (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/60 bg-white p-4 shadow-2xl">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
          Level 1 Guide ({onboardingStepIndex + 1}/{ONBOARDING_STEPS.length})
        </p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">{activeStep.title}</h2>
        <p className="mt-2 text-sm text-slate-700">{activeStep.body}</p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={closeOnboarding}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700"
          >
            Skip
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOnboardingStepIndex((previous) => Math.max(previous - 1, 0))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-40"
              disabled={onboardingStepIndex === 0}
            >
              Back
            </button>
            {onboardingStepIndex < ONBOARDING_STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setOnboardingStepIndex((previous) => Math.min(previous + 1, ONBOARDING_STEPS.length - 1))}
                className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={closeOnboarding}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
              >
                Start
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  ) : null

  if (game.gameOver) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_10%_10%,#d9edff_0%,transparent_40%),radial-gradient(circle_at_90%_90%,#ffe7d3_0%,transparent_35%),linear-gradient(180deg,#f9fbff_0%,#edf2f8_100%)] px-4 pb-10 pt-5 sm:px-6">
        <section className="mx-auto w-full max-w-xl rounded-2xl border border-white/70 bg-white/90 p-4 shadow-[0_18px_40px_rgba(16,24,40,0.12)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Debrief</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Block 'Burb Level 1</h1>
          <p className="mt-1 text-sm text-slate-600">{gameOverMessage(game.gameOverReason)}</p>

          <div className="mt-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
            <div className="rounded-xl bg-slate-100 px-2 py-3">
              <p className="text-xs uppercase text-slate-500">Turns</p>
              <p className="text-xl font-semibold text-slate-800">{game.turn}</p>
            </div>
            <div className="rounded-xl bg-slate-100 px-2 py-3">
              <p className="text-xs uppercase text-slate-500">Unhappy Left</p>
              <p className="text-xl font-semibold text-slate-800">{unhappyCount}</p>
            </div>
            <div className="rounded-xl bg-slate-100 px-2 py-3">
              <p className="text-xs uppercase text-slate-500">Integration</p>
              <p className="text-xl font-semibold text-emerald-700">{integrationIndex}%</p>
            </div>
            <div className="rounded-xl bg-slate-100 px-2 py-3">
              <p className="text-xs uppercase text-slate-500">Segregation</p>
              <p className="text-xl font-semibold text-amber-700">{segregationIndex}%</p>
            </div>
          </div>

          <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Same local rule, new global pattern: even "don’t be alone" preferences can sort neighborhoods.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Final map</p>
              <MiniMap board={game.board} />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Reference equilibrium map</p>
              <EquilibriumPreview map={equilibriumMap} />
            </div>
          </div>

          <button
            type="button"
            className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm active:scale-[0.99]"
            onClick={restart}
          >
            Start New Session
          </button>
        </section>
        {onboardingModal}
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_10%_10%,#d9edff_0%,transparent_40%),radial-gradient(circle_at_90%_90%,#ffe7d3_0%,transparent_35%),linear-gradient(180deg,#f9fbff_0%,#edf2f8_100%)] px-4 pb-12 pt-4 sm:px-6">
      <section className="mx-auto w-full max-w-xl rounded-2xl border border-white/80 bg-white/90 p-4 shadow-[0_18px_40px_rgba(16,24,40,0.12)] backdrop-blur">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Classroom Simulation</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Block 'Burb Level 1</h1>
            <p className="mt-1 text-xs text-slate-600">Tap a pulsing tile, then swipe the board.</p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={openOnboarding}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm"
            >
              How To Play
            </button>
            <button
              type="button"
              onClick={() => setShowScenario((previous) => !previous)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm"
            >
              {showScenario ? 'Close' : 'Scenario'}
            </button>
          </div>
        </header>

        <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          <div className="rounded-lg bg-slate-100 px-2 py-2">
            <p className="text-[10px] uppercase text-slate-500">Turn</p>
            <p className="text-base font-semibold text-slate-800">
              {game.turn}/{config.maxTurns}
            </p>
          </div>
          <div className="rounded-lg bg-slate-100 px-2 py-2">
            <p className="text-[10px] uppercase text-slate-500">Unhappy</p>
            <p className="text-base font-semibold text-rose-700">{unhappyCount}</p>
          </div>
          <div className="rounded-lg bg-slate-100 px-2 py-2">
            <p className="text-[10px] uppercase text-slate-500">Integration</p>
            <p className="text-base font-semibold text-emerald-700">{integrationIndex}%</p>
          </div>
          <div className="rounded-lg bg-slate-100 px-2 py-2">
            <p className="text-[10px] uppercase text-slate-500">Segregation</p>
            <p className="text-base font-semibold text-amber-700">{segregationIndex}%</p>
          </div>
        </div>

        <section className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Level Goal</p>
          <p className="mt-1 text-xs text-slate-700">
            Reach equilibrium (0 unhappy households). There are no points here; this level is about observing emergent
            segregation.
          </p>
          <p className="mt-1 text-[11px] text-slate-600">
            Current composition: {counts.blue} blue / {counts.orange} orange ({minorityShare}% minority).
          </p>
        </section>

        <div
          className="mt-3 w-full rounded-xl border border-slate-200 bg-[#f3f6fb] p-2"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={{ touchAction: 'none' }}
        >
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${game.board.length}, minmax(0, 1fr))` }}>
            {game.board.flatMap((row, rowIndex) =>
              row.map((cell, colIndex) => {
                const coordinate = { row: rowIndex, col: colIndex }
                const cellKey = keyFor(coordinate)
                const selectedClass = isSameCoordinate(selected, coordinate) ? 'ring-2 ring-sky-300' : ''
                const trailClass = lastMoveTrail.has(cellKey) ? 'trail-glow' : ''
                const destination =
                  game.summary.lastMove !== null &&
                  game.summary.lastMove.to.row === rowIndex &&
                  game.summary.lastMove.to.col === colIndex

                if (cell === null) {
                  return (
                    <button
                      key={`vacancy-${rowIndex}-${colIndex}`}
                      type="button"
                      className={`relative aspect-square rounded-md border border-slate-200 bg-white/75 ${selectedClass} ${trailClass}`}
                      onClick={() => selectCell(rowIndex, colIndex)}
                      aria-label="Vacancy"
                    />
                  )
                }

                return (
                  <button
                    key={cell.id}
                    type="button"
                    onClick={() => selectCell(rowIndex, colIndex)}
                    className={`relative flex aspect-square items-center justify-center rounded-md border text-xs font-bold ${householdClasses(cell)} ${selectedClass} ${trailClass} ${
                      cell.unhappy ? 'unhappy-pulse' : ''
                    }`}
                    aria-label={cell.unhappy ? 'Unhappy household. Select and move.' : 'Happy household.'}
                  >
                    {cell.color === 'blue' ? 'B' : 'O'}
                    {cell.unhappy ? <span className="absolute left-1 top-1 text-[10px] text-white">!</span> : null}
                    {destination && game.summary.lastMove !== null ? (
                      <span className="absolute bottom-1 right-1 text-[10px] text-white/90">
                        {DIRECTION_SYMBOL[game.summary.lastMove.direction]}
                      </span>
                    ) : null}
                  </button>
                )
              }),
            )}
          </div>
        </div>

        <DirectionPad onMove={handleMove} />

        <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          {statusMessage}
        </p>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={restart}
            className="w-1/2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
          >
            Restart
          </button>
          <button
            type="button"
            onClick={endNow}
            className="w-1/2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
          >
            End Session
          </button>
        </div>

        {showScenario ? (
          <section className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
            <h2 className="text-sm font-semibold text-slate-800">Scenario Controls</h2>
            <p className="mt-1 text-xs text-slate-600">Keep this level simple: composition and vacancy pressure only.</p>

            <div className="mt-3 space-y-3 text-xs text-slate-700">
              <label className="block">
                Minority Share: <span className="font-semibold">{Math.round(draftConfig.minorityShare * 100)}%</span>
                <input
                  type="range"
                  min={10}
                  max={20}
                  value={Math.round(draftConfig.minorityShare * 100)}
                  onChange={(event) =>
                    setDraftConfig((previous) => ({
                      ...previous,
                      minorityShare: Number(event.target.value) / 100,
                    }))
                  }
                  className="mt-1 w-full"
                />
              </label>

              <label className="block">
                Occupancy: <span className="font-semibold">{Math.round(draftConfig.initialOccupancy * 100)}%</span>
                <input
                  type="range"
                  min={70}
                  max={97}
                  value={Math.round(draftConfig.initialOccupancy * 100)}
                  onChange={(event) =>
                    setDraftConfig((previous) => ({
                      ...previous,
                      initialOccupancy: Number(event.target.value) / 100,
                    }))
                  }
                  className="mt-1 w-full"
                />
              </label>

              <label className="block">
                Max Turns: <span className="font-semibold">{draftConfig.maxTurns}</span>
                <input
                  type="range"
                  min={12}
                  max={60}
                  value={draftConfig.maxTurns}
                  onChange={(event) =>
                    setDraftConfig((previous) => ({
                      ...previous,
                      maxTurns: Number(event.target.value),
                    }))
                  }
                  className="mt-1 w-full"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={applyScenario}
              className="mt-4 w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
            >
              Apply Scenario + Restart
            </button>
          </section>
        ) : null}

        <footer className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Legend</p>
          <p>
            <span className="font-semibold text-[#1f5ea8]">B</span> Blue household |{' '}
            <span className="font-semibold text-[#d97a2f]">O</span> Orange household
          </p>
          <p>Pulsing + ! = unhappy (isolated). Only these households can move.</p>
          <p>Vacant lots are white squares. Swipes choose relocation direction.</p>
        </footer>
      </section>
      {onboardingModal}
    </main>
  )
}

export default App
