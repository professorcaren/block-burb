import { useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  calculateIntegrationIndex,
  calculateSegregationIndex,
  countHouseholds,
} from '@/game/debrief'
import { LEVEL_ORDER, configForLevel, DEFAULT_CONFIG } from '@/game/config'
import { applyTurn, createInitialState, endSession } from '@/game/engine'
import type { Board, Coordinate, GameConfig, HouseholdTile, LevelId } from '@/game/types'

const householdClasses = (tile: HouseholdTile): string =>
  tile.color === 'blue'
    ? 'bg-[#1f5ea8] border-[#19467f]'
    : 'bg-[#d97a2f] border-[#b85f1e]'

const pulseClass = (tile: HouseholdTile): string => {
  if (!tile.unhappy) {
    return ''
  }

  if (tile.unhappyTurns >= 6) {
    return 'unhappy-pulse-strong'
  }

  if (tile.unhappyTurns >= 3) {
    return 'unhappy-pulse-medium'
  }

  return 'unhappy-pulse-light'
}

const gameOverMessage = (reason: string | null): string => {
  if (reason === 'all_happy') {
    return 'All households are now happy.'
  }

  if (reason === 'max_turns') {
    return 'Turn limit reached.'
  }

  if (reason === 'manual_end') {
    return 'Session ended.'
  }

  return 'Session complete.'
}

const keyFor = (coordinate: Coordinate): string => `${coordinate.row}:${coordinate.col}`

const isSameCoordinate = (a: Coordinate | null, b: Coordinate): boolean =>
  a !== null && a.row === b.row && a.col === b.col

const equilibriumType = (integrationIndex: number, segregationIndex: number): string => {
  if (integrationIndex >= 45) {
    return 'Integrated equilibrium'
  }

  if (segregationIndex >= 80) {
    return 'Segregated equilibrium'
  }

  return 'Mixed equilibrium'
}

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

const levelBadge = (active: boolean): string =>
  active
    ? 'border-slate-900 bg-slate-900 text-white'
    : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500'

function App() {
  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG)
  const [game, setGame] = useState(() => createInitialState(DEFAULT_CONFIG))
  const [statusMessage, setStatusMessage] = useState('Drag any household to an empty lot.')
  const [dragOrigin, setDragOrigin] = useState<Coordinate | null>(null)
  const [dragTarget, setDragTarget] = useState<Coordinate | null>(null)

  const boardRef = useRef<HTMLDivElement | null>(null)

  const switchLevel = (levelId: LevelId): void => {
    const nextConfig = configForLevel(levelId)
    setConfig(nextConfig)
    setGame(createInitialState(nextConfig))
    setStatusMessage('New level loaded. Drag any household to an empty lot.')
    setDragOrigin(null)
    setDragTarget(null)
  }

  const restart = (): void => {
    setGame(createInitialState(config))
    setStatusMessage('Board reset. Drag any household to an empty lot.')
    setDragOrigin(null)
    setDragTarget(null)
  }

  const endNow = (): void => {
    setGame((previous) => endSession(previous))
    setDragOrigin(null)
    setDragTarget(null)
  }

  const coordinateFromPoint = (clientX: number, clientY: number): Coordinate | null => {
    const element = document.elementFromPoint(clientX, clientY)
    if (!(element instanceof HTMLElement)) {
      return null
    }

    const cell = element.closest('[data-cell="true"]')
    if (!(cell instanceof HTMLElement)) {
      return null
    }

    const row = Number(cell.dataset.row)
    const col = Number(cell.dataset.col)

    if (Number.isNaN(row) || Number.isNaN(col)) {
      return null
    }

    return { row, col }
  }

  const onCellPointerDown = (row: number, col: number, event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (game.gameOver) {
      return
    }

    const cell = game.board[row][col]
    if (cell === null) {
      setStatusMessage('Start the drag from a household, not from a vacancy.')
      return
    }

    setDragOrigin({ row, col })
    setDragTarget(null)
    setStatusMessage('Now drag this household to an empty lot and release.')
    boardRef.current?.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  const onBoardPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (dragOrigin === null) {
      return
    }

    const coordinate = coordinateFromPoint(event.clientX, event.clientY)
    if (coordinate === null) {
      setDragTarget(null)
      return
    }

    if (game.board[coordinate.row][coordinate.col] === null) {
      setDragTarget(coordinate)
      return
    }

    setDragTarget(null)
  }

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (dragOrigin === null) {
      return
    }

    const fallbackTarget = coordinateFromPoint(event.clientX, event.clientY)
    const resolvedTarget =
      dragTarget ??
      (fallbackTarget !== null && game.board[fallbackTarget.row][fallbackTarget.col] === null ? fallbackTarget : null)

    if (resolvedTarget === null) {
      setStatusMessage('Drop on an empty lot to move that household.')
      setDragOrigin(null)
      setDragTarget(null)
      try {
        boardRef.current?.releasePointerCapture(event.pointerId)
      } catch {
        // Ignore release errors when capture is already gone.
      }
      return
    }

    const next = applyTurn(game, dragOrigin, resolvedTarget, config)
    setGame(next)

    if (!next.summary.validMove) {
      setStatusMessage('That move was not valid. Move a household into a vacancy.')
    } else if (next.summary.moved) {
      setStatusMessage(
        `Moved. Unhappy households: ${next.summary.unhappyBefore} -> ${next.summary.unhappyAfter}.`,
      )
    }

    if (next.gameOver) {
      setStatusMessage(gameOverMessage(next.gameOverReason))
    }

    setDragOrigin(null)
    setDragTarget(null)

    try {
      boardRef.current?.releasePointerCapture(event.pointerId)
    } catch {
      // Ignore release errors when capture is already gone.
    }
  }

  const cancelDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (dragOrigin === null) {
      return
    }

    setDragOrigin(null)
    setDragTarget(null)

    try {
      boardRef.current?.releasePointerCapture(event.pointerId)
    } catch {
      // Ignore release errors when capture is already gone.
    }
  }

  const segregationIndex = useMemo(() => calculateSegregationIndex(game.board), [game.board])
  const integrationIndex = useMemo(() => calculateIntegrationIndex(game.board), [game.board])
  const unhappyCount = useMemo(
    () => game.board.flat().filter((cell) => cell !== null && cell.unhappy).length,
    [game.board],
  )
  const counts = useMemo(() => countHouseholds(game.board), [game.board])

  const lastMoveTrail = useMemo(() => {
    const trail = game.summary.lastMove?.trail ?? []
    return new Set(trail.map((coordinate) => keyFor(coordinate)))
  }, [game.summary.lastMove])

  if (game.gameOver) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_10%_10%,#d9edff_0%,transparent_40%),radial-gradient(circle_at_90%_90%,#ffe7d3_0%,transparent_35%),linear-gradient(180deg,#f9fbff_0%,#edf2f8_100%)] px-4 pb-10 pt-5 sm:px-6">
        <section className="mx-auto w-full max-w-xl rounded-2xl border border-white/70 bg-white/90 p-4 shadow-[0_18px_40px_rgba(16,24,40,0.12)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Debrief</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{config.levelName}</h1>
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

          {game.gameOverReason === 'all_happy' ? (
            <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Outcome type: <span className="font-semibold">{equilibriumType(integrationIndex, segregationIndex)}</span>
              {config.levelId === 'level0'
                ? ' — replay to find the other happy pattern (integrated vs segregated).'
                : '.'}
            </p>
          ) : null}

          <div className="mt-5">
            <p className="mb-2 text-sm font-medium text-slate-700">Final map</p>
            <MiniMap board={game.board} />
          </div>

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              className="w-1/2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
              onClick={restart}
            >
              Replay Level
            </button>
            <button
              type="button"
              className="w-1/2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
              onClick={() => switchLevel(config.levelId === 'level0' ? 'level1' : 'level0')}
            >
              {config.levelId === 'level0' ? 'Go To Level 1' : 'Go To Level 0'}
            </button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_10%_10%,#d9edff_0%,transparent_40%),radial-gradient(circle_at_90%_90%,#ffe7d3_0%,transparent_35%),linear-gradient(180deg,#f9fbff_0%,#edf2f8_100%)] px-4 pb-12 pt-4 sm:px-6">
      <section className="mx-auto w-full max-w-xl rounded-2xl border border-white/80 bg-white/90 p-4 shadow-[0_18px_40px_rgba(16,24,40,0.12)] backdrop-blur">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Classroom Simulation</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Block 'Burb</h1>
            <p className="mt-1 text-xs text-slate-600">Drag households into empty lots.</p>
          </div>

          <div className="flex flex-col gap-2">
            {LEVEL_ORDER.map((levelId) => (
              <button
                key={levelId}
                type="button"
                onClick={() => switchLevel(levelId)}
                className={`rounded-xl border px-3 py-2 text-xs font-medium shadow-sm ${levelBadge(
                  config.levelId === levelId,
                )}`}
              >
                {configForLevel(levelId).levelName}
              </button>
            ))}
          </div>
        </header>

        <section className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Current Goal</p>
          <p className="mt-1 text-xs text-slate-700">{config.levelNote}</p>
        </section>

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

        <p className="mt-2 text-xs text-slate-600">
          Composition: {counts.blue} blue / {counts.orange} orange / {game.summary.vacancyCount} vacancies.
        </p>

        <div
          ref={boardRef}
          className="mt-3 w-full rounded-xl border border-slate-200 bg-[#f3f6fb] p-2"
          onPointerMove={onBoardPointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={cancelDrag}
          style={{ touchAction: 'none' }}
        >
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${game.board.length}, minmax(0, 1fr))` }}>
            {game.board.flatMap((row, rowIndex) =>
              row.map((cell, colIndex) => {
                const coordinate = { row: rowIndex, col: colIndex }
                const cellKey = keyFor(coordinate)
                const originClass = isSameCoordinate(dragOrigin, coordinate) ? 'ring-2 ring-sky-300' : ''
                const targetClass = isSameCoordinate(dragTarget, coordinate) ? 'ring-2 ring-emerald-400' : ''
                const trailClass = lastMoveTrail.has(cellKey) ? 'trail-glow' : ''

                if (cell === null) {
                  return (
                    <button
                      key={`vacancy-${rowIndex}-${colIndex}`}
                      type="button"
                      data-cell="true"
                      data-row={rowIndex}
                      data-col={colIndex}
                      className={`relative aspect-square rounded-md border border-slate-200 bg-white/75 ${originClass} ${targetClass} ${trailClass}`}
                      aria-label="Vacancy"
                    />
                  )
                }

                return (
                  <button
                    key={cell.id}
                    type="button"
                    data-cell="true"
                    data-row={rowIndex}
                    data-col={colIndex}
                    onPointerDown={(event) => onCellPointerDown(rowIndex, colIndex, event)}
                    className={`relative aspect-square rounded-md border ${householdClasses(cell)} ${pulseClass(cell)} ${originClass} ${targetClass} ${trailClass}`}
                    aria-label={cell.unhappy ? 'Unhappy household' : 'Happy household'}
                  />
                )
              }),
            )}
          </div>
        </div>

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

        <footer className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Legend</p>
          <p>
            Blue and orange squares are households. White squares are vacancies.
          </p>
          <p>
            A pulse means the household is unhappy; stronger pulsing means it has stayed unhappy longer.
          </p>
          <p>
            You can move any household by dragging it onto a vacancy.
          </p>
        </footer>
      </section>
    </main>
  )
}

export default App
