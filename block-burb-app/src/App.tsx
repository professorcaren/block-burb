import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TouchEvent } from 'react'
import { calculateSegregationIndex, countHouseholds, generateEquilibriumMap } from '@/game/debrief'
import { DEFAULT_CONFIG } from '@/game/config'
import { applyTurn, createInitialState, endSession } from '@/game/engine'
import type { Board, Cell, Direction, GameConfig, HouseholdColor, Tile } from '@/game/types'

interface TouchPoint {
  x: number
  y: number
}

const lockIcon = '\uD83D\uDD12'

const householdStyle = (color: HouseholdColor): string =>
  color === 'blue'
    ? 'bg-[#1f5ea8] text-[#e8f4ff] border-[#1a4f8f]'
    : 'bg-[#d97a2f] text-[#fff1e6] border-[#be6822]'

const tileDisplay = (tile: Tile): { label: string; classes: string } => {
  if (tile.kind === 'household' && tile.color !== null) {
    return {
      label: tile.color === 'blue' ? 'B' : 'O',
      classes: householdStyle(tile.color),
    }
  }

  if (tile.kind === 'gated_community') {
    return {
      label: 'G',
      classes: 'bg-[#1a2f57] text-[#d9e7ff] border-[#11213e]',
    }
  }

  return {
    label: 'C',
    classes: 'bg-[#6f3a8a] text-[#f4e5ff] border-[#552b6a]',
  }
}

const mapColorFromCell = (cell: Cell): string => {
  if (cell === null) {
    return 'bg-white/70'
  }

  if (cell.kind === 'household' && cell.color !== null) {
    return cell.color === 'blue' ? 'bg-[#1f5ea8]' : 'bg-[#d97a2f]'
  }

  if (cell.kind === 'gated_community') {
    return 'bg-[#1a2f57]'
  }

  return 'bg-[#6f3a8a]'
}

const mapColorFromHousehold = (color: HouseholdColor | null): string => {
  if (color === 'blue') {
    return 'bg-[#1f5ea8]'
  }

  if (color === 'orange') {
    return 'bg-[#d97a2f]'
  }

  return 'bg-white/70'
}

const gameOverMessage = (reason: string | null): string => {
  if (reason === 'fully_locked') {
    return 'Board fully locked'
  }

  if (reason === 'no_legal_moves') {
    return 'No legal moves remain'
  }

  if (reason === 'manual_end') {
    return 'Session ended'
  }

  return 'Session complete'
}

const sanitizeConfig = (config: GameConfig): GameConfig => {
  const size = Math.max(4, Math.min(7, Math.round(config.size)))
  const maxTiles = size * size - 1
  const initialTiles = Math.max(4, Math.min(maxTiles, Math.round(config.initialTiles)))

  const orange = Math.max(0.02, Math.min(0.98, config.spawnRatio.orange))

  return {
    ...config,
    size,
    initialTiles,
    spawnRatio: {
      orange,
      blue: 1 - orange,
    },
  }
}

const DirectionPad = ({ onMove }: { onMove: (direction: Direction) => void }) => (
  <div className="mx-auto mt-3 grid w-[180px] grid-cols-3 grid-rows-3 gap-2 sm:w-[220px]">
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

const MapPreview = ({ board }: { board: Board }) => (
  <div
    className="grid gap-1 rounded-xl border border-slate-200 bg-slate-100/70 p-2"
    style={{ gridTemplateColumns: `repeat(${board.length}, minmax(0, 1fr))` }}
  >
    {board.flatMap((row, rowIndex) =>
      row.map((cell, colIndex) => (
        <div
          key={`final-${rowIndex}-${colIndex}`}
          className={`aspect-square rounded-sm ${mapColorFromCell(cell)}`}
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
          className={`aspect-square rounded-sm ${mapColorFromHousehold(cell)}`}
        />
      )),
    )}
  </div>
)

function App() {
  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG)
  const [draftConfig, setDraftConfig] = useState<GameConfig>(DEFAULT_CONFIG)
  const [game, setGame] = useState(() => createInitialState(DEFAULT_CONFIG))
  const [showSettings, setShowSettings] = useState(false)
  const [showLockHelp, setShowLockHelp] = useState(false)
  const touchStartRef = useRef<TouchPoint | null>(null)

  const handleMove = useCallback(
    (direction: Direction) => {
      setGame((previous) => applyTurn(previous, direction, config))
    },
    [config],
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
    } else {
      handleMove(deltaY > 0 ? 'down' : 'up')
    }
  }

  const applySettings = (): void => {
    const next = sanitizeConfig(draftConfig)
    setConfig(next)
    setDraftConfig(next)
    setGame(createInitialState(next))
    setShowSettings(false)
  }

  const restart = (): void => {
    setGame(createInitialState(config))
  }

  const endNow = (): void => {
    setGame((previous) => endSession(previous))
  }

  const segregationIndex = useMemo(() => calculateSegregationIndex(game.board), [game.board])
  const counts = useMemo(() => countHouseholds(game.board), [game.board])
  const equilibriumMap = useMemo(
    () => generateEquilibriumMap(game.board.length, counts.blue, counts.orange),
    [counts.blue, counts.orange, game.board.length],
  )
  const lockedHouseholds = useMemo(
    () =>
      game.board.flat().filter((tile) => tile !== null && tile.kind === 'household' && tile.locked).length,
    [game.board],
  )

  const activeBoardClass = game.summary.flightCount > 0 ? 'board-flash' : ''

  if (game.gameOver) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_10%_10%,#d9edff_0%,transparent_40%),radial-gradient(circle_at_90%_90%,#ffe7d3_0%,transparent_35%),linear-gradient(180deg,#f9fbff_0%,#edf2f8_100%)] px-4 pb-10 pt-5 sm:px-6">
        <section className="mx-auto w-full max-w-xl rounded-2xl border border-white/70 bg-white/85 p-4 shadow-[0_18px_40px_rgba(16,24,40,0.12)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Debrief</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Block 'Burb Session Summary</h1>
          <p className="mt-1 text-sm text-slate-600">{gameOverMessage(game.gameOverReason)}</p>

          <div className="mt-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
            <div className="rounded-xl bg-slate-100 px-2 py-3">
              <p className="text-xs uppercase text-slate-500">Turns</p>
              <p className="text-xl font-semibold text-slate-800">{game.turn}</p>
            </div>
            <div className="rounded-xl bg-slate-100 px-2 py-3">
              <p className="text-xs uppercase text-slate-500">Score</p>
              <p className="text-xl font-semibold text-slate-800">{game.totalScore}</p>
            </div>
            <div className="rounded-xl bg-slate-100 px-2 py-3">
              <p className="text-xs uppercase text-slate-500">Segregation</p>
              <p className="text-xl font-semibold text-slate-800">{segregationIndex}%</p>
            </div>
            <div className="rounded-xl bg-slate-100 px-2 py-3">
              <p className="text-xs uppercase text-slate-500">Integration Turns</p>
              <p className="text-xl font-semibold text-slate-800">{game.integrationTurnsSurvived}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Final map</p>
              <MapPreview board={game.board} />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Natural equilibrium map</p>
              <EquilibriumPreview map={equilibriumMap} />
            </div>
          </div>

          <p className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">
            Segregation emerges from mild preferences plus movement rules, even without explicit prejudice.
          </p>

          <button
            type="button"
            className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm active:scale-[0.99]"
            onClick={restart}
          >
            Start New Session
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_10%_10%,#d9edff_0%,transparent_40%),radial-gradient(circle_at_90%_90%,#ffe7d3_0%,transparent_35%),linear-gradient(180deg,#f9fbff_0%,#edf2f8_100%)] px-4 pb-12 pt-4 sm:px-6">
      <section className="mx-auto w-full max-w-xl rounded-2xl border border-white/80 bg-white/85 p-4 shadow-[0_18px_40px_rgba(16,24,40,0.12)] backdrop-blur">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Classroom Simulation</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Block 'Burb</h1>
            <p className="mt-1 text-xs text-slate-600">Swipe on the board or use arrow controls.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowSettings((previous) => !previous)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm"
          >
            {showSettings ? 'Close' : 'Settings'}
          </button>
        </header>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-slate-100 px-2 py-2">
            <p className="text-[10px] uppercase text-slate-500">Turn</p>
            <p className="text-base font-semibold text-slate-800">{game.turn}</p>
          </div>
          <div className="rounded-lg bg-slate-100 px-2 py-2">
            <p className="text-[10px] uppercase text-slate-500">Total Score</p>
            <p className="text-base font-semibold text-slate-800">{game.totalScore}</p>
          </div>
          <div className="rounded-lg bg-slate-100 px-2 py-2">
            <p className="text-[10px] uppercase text-slate-500">This Turn</p>
            <p className="text-base font-semibold text-emerald-700">+{game.summary.pointsGained}</p>
          </div>
          <div className="rounded-lg bg-slate-100 px-2 py-2">
            <p className="text-[10px] uppercase text-slate-500">Flight</p>
            <p className="text-base font-semibold text-slate-800">{game.summary.flightCount}</p>
          </div>
          <div className="rounded-lg bg-slate-100 px-2 py-2">
            <p className="text-[10px] uppercase text-slate-500">Integrated Rows</p>
            <p className="text-base font-semibold text-slate-800">{game.summary.integrationRows}</p>
          </div>
          <div className="rounded-lg bg-slate-100 px-2 py-2">
            <p className="text-[10px] uppercase text-slate-500">Locked Tiles</p>
            <p className="text-base font-semibold text-slate-800">{lockedHouseholds}</p>
          </div>
        </div>

        {game.summary.segregationWarning ? (
          <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Warning: board currently segregated. Play can continue.
          </p>
        ) : null}

        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-700">
            Scoring band: keep row minority share between {Math.round(config.integrationBand.min * 100)}% and{' '}
            {Math.round(config.integrationBand.max * 100)}%.
          </p>
          <button
            type="button"
            onClick={() => setShowLockHelp((previous) => !previous)}
            className="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700"
          >
            {showLockHelp ? 'Hide Lock Rule' : 'Why Locks?'}
          </button>
        </div>

        {showLockHelp ? (
          <p className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
            {lockIcon} A household locks when it is the only tile of its color in both its row and column. Locked
            tiles do not move until a same-color household enters that row or column.
          </p>
        ) : null}

        <div
          className={`mt-3 w-full rounded-xl border border-slate-200 bg-[#f3f6fb] p-2 ${activeBoardClass}`}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={{ touchAction: 'none' }}
        >
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${game.board.length}, minmax(0, 1fr))` }}
          >
            {game.board.flatMap((row, rowIndex) =>
              row.map((cell, colIndex) => {
                if (cell === null) {
                  return (
                    <div
                      key={`cell-${rowIndex}-${colIndex}`}
                      className="aspect-square rounded-lg border border-slate-200 bg-white/70"
                    />
                  )
                }

                const visual = tileDisplay(cell)
                return (
                  <div
                    key={cell.id}
                    className={`tile-pop relative flex aspect-square items-center justify-center rounded-lg border text-sm font-bold ${visual.classes}`}
                    aria-label={
                      cell.kind === 'household' && cell.locked
                        ? 'Locked household. It cannot move until a same-color tile enters this row or column.'
                        : undefined
                    }
                  >
                    <span>{visual.label}</span>
                    {cell.locked ? (
                      <span className="absolute bottom-1 right-1 text-[10px] text-white/90">{lockIcon}</span>
                    ) : null}
                  </div>
                )
              }),
            )}
          </div>
        </div>

        <DirectionPad onMove={handleMove} />

        <div className="mt-2 text-center text-[11px] text-slate-500">
          Last move: {game.summary.moved ? `${game.summary.merges} merges` : 'no change'} •{' '}
          {game.summary.spawned ? 'spawned' : 'no spawn'} • +{game.summary.pointsGained} points
        </div>

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

        {showSettings ? (
          <section className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
            <h2 className="text-sm font-semibold text-slate-800">Class Scenario Controls</h2>

            <div className="mt-3 space-y-3 text-xs text-slate-700">
              <label className="block">
                Grid Size: <span className="font-semibold">{draftConfig.size}</span>
                <input
                  type="range"
                  min={4}
                  max={7}
                  value={draftConfig.size}
                  onChange={(event) => {
                    const size = Number(event.target.value)
                    setDraftConfig((previous) => {
                      const nextTiles = Math.min(previous.initialTiles, size * size - 1)
                      return {
                        ...previous,
                        size,
                        initialTiles: Math.max(4, nextTiles),
                      }
                    })
                  }}
                  className="mt-1 w-full"
                />
              </label>

              <label className="block">
                Initial Tiles: <span className="font-semibold">{draftConfig.initialTiles}</span>
                <input
                  type="range"
                  min={4}
                  max={Math.max(8, draftConfig.size * draftConfig.size - 1)}
                  value={draftConfig.initialTiles}
                  onChange={(event) =>
                    setDraftConfig((previous) => ({
                      ...previous,
                      initialTiles: Number(event.target.value),
                    }))
                  }
                  className="mt-1 w-full"
                />
              </label>

              <label className="block">
                Minority Spawn Share: <span className="font-semibold">{Math.round(draftConfig.spawnRatio.orange * 100)}%</span>
                <input
                  type="range"
                  min={5}
                  max={50}
                  value={Math.round(draftConfig.spawnRatio.orange * 100)}
                  onChange={(event) => {
                    const orangeShare = Number(event.target.value) / 100
                    setDraftConfig((previous) => ({
                      ...previous,
                      spawnRatio: {
                        orange: orangeShare,
                        blue: 1 - orangeShare,
                      },
                    }))
                  }}
                  className="mt-1 w-full"
                />
              </label>

              <label className="block">
                Minority Shift / Turn: <span className="font-semibold">{draftConfig.spawnRatioShiftPerTurn.toFixed(2)}</span>
                <input
                  type="range"
                  min={-0.02}
                  max={0.02}
                  step={0.005}
                  value={draftConfig.spawnRatioShiftPerTurn}
                  onChange={(event) =>
                    setDraftConfig((previous) => ({
                      ...previous,
                      spawnRatioShiftPerTurn: Number(event.target.value),
                    }))
                  }
                  className="mt-1 w-full"
                />
              </label>

              <label className="block">
                Tipping Threshold: <span className="font-semibold">{draftConfig.tippingThreshold.toFixed(2)}</span>
                <input
                  type="range"
                  min={0.1}
                  max={0.6}
                  step={0.01}
                  value={draftConfig.tippingThreshold}
                  onChange={(event) =>
                    setDraftConfig((previous) => ({
                      ...previous,
                      tippingThreshold: Number(event.target.value),
                    }))
                  }
                  className="mt-1 w-full"
                />
              </label>

              <label className="block">
                Tipping Unit
                <select
                  value={draftConfig.tippingUnit}
                  onChange={(event) =>
                    setDraftConfig((previous) => ({
                      ...previous,
                      tippingUnit: event.target.value as GameConfig['tippingUnit'],
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1"
                >
                  <option value="row">Row</option>
                  <option value="column">Column</option>
                  <option value="sector2x2">2x2 Sector</option>
                </select>
              </label>

              <label className="block">
                Flight Mode
                <select
                  value={draftConfig.flightMode}
                  onChange={(event) =>
                    setDraftConfig((previous) => ({
                      ...previous,
                      flightMode: event.target.value as GameConfig['flightMode'],
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1"
                >
                  <option value="probabilistic">Probabilistic</option>
                  <option value="deterministic">Deterministic (50%)</option>
                </select>
              </label>

              <label className="block">
                Flight Behavior
                <select
                  value={draftConfig.flightBehavior}
                  onChange={(event) =>
                    setDraftConfig((previous) => ({
                      ...previous,
                      flightBehavior: event.target.value as GameConfig['flightBehavior'],
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1"
                >
                  <option value="edge-relocate">Relocate to edge</option>
                  <option value="despawn">Despawn</option>
                </select>
              </label>

              <label className="block">
                Flight Probability: <span className="font-semibold">{Math.round(draftConfig.flightProbability * 100)}%</span>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={draftConfig.flightProbability}
                  onChange={(event) =>
                    setDraftConfig((previous) => ({
                      ...previous,
                      flightProbability: Number(event.target.value),
                    }))
                  }
                  className="mt-1 w-full"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={applySettings}
              className="mt-4 w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
            >
              Apply Scenario + Restart
            </button>
          </section>
        ) : null}

        <footer className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Legend + Rules</p>
          <p>
            <span className="font-semibold text-[#1f5ea8]">B</span> Majority household |{' '}
            <span className="font-semibold text-[#d97a2f]">O</span> Minority household
          </p>
          <p>
            <span className="font-semibold text-[#1a2f57]">G</span> Gated community (stable, low reward) |{' '}
            <span className="font-semibold text-[#6f3a8a]">C</span> Community center
          </p>
          <p>
            {lockIcon} Locked = isolated in row and column. Cannot move until same-color support appears.
          </p>
          <p>
            Score each turn: +{config.integrationPointsPerRow} for every row in the integration band.
          </p>
        </footer>
      </section>
    </main>
  )
}

export default App
