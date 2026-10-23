import type { Mock } from 'vitest'
import { PaceDB } from '../../db/db'
import { createAppStore } from '../../store/store'
import type { AppStore } from '../../store/store'
import { makeTask } from '../../test/factories'
import { createFocusStore, syncAcrossTabs } from './focusStore'
import type { FocusDeps, FocusStore } from './focusStore'
import { createTimer } from './timer'
import { TIMER_STORAGE_KEY, readTimer } from './timerStorage'
import type { TimerStorage } from './timerStorage'

const MIN = 60_000
const T0 = 1_700_000_000_000

let seq = 0
let db: PaceDB
let app: AppStore
let clock = T0
let storage: TimerStorage & { data: Map<string, string> }
let announce: Mock<FocusDeps['announce']>
let prime: Mock<FocusDeps['prime']>

function memoryStorage() {
  const data = new Map<string, string>()
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data }
}

function build(over: { storage?: TimerStorage | null } = {}): FocusStore {
  let n = 0
  return createFocusStore({
    app,
    storage: over.storage === undefined ? storage : over.storage,
    now: () => clock,
    newId: () => `fs-${++n}`,
    announce,
    prime,
  })
}

const sessions = () => Object.values(app.getState().entities.focusSessions)

beforeEach(async () => {
  clock = T0
  storage = memoryStorage()
  announce = vi.fn<FocusDeps['announce']>()
  prime = vi.fn<FocusDeps['prime']>()
  db = new PaceDB(`focus-test-${++seq}`)
  app = createAppStore(db, () => clock)
  await app.getState().load()
})

afterEach(async () => {
  db.close()
  await PaceDB.delete(db.name)
})

describe('focus store: lifecycle', () => {
  test('start runs the timer, primes audio and persists the state', () => {
    const focus = build()
    focus.getState().start()

    expect(focus.getState().timer.phase).toBe('running')
    expect(prime).toHaveBeenCalledOnce()
    expect(readTimer(storage)?.phase).toBe('running')
  })

  test('restores a running timer after a reload and keeps counting from timestamps', () => {
    build().getState().start()
    clock = T0 + 10 * MIN

    const reloaded = build()

    expect(reloaded.getState().timer.phase).toBe('running')
    expect(reloaded.getState().timer.startedAt).toBe(T0)
  })

  test('falls back to an idle timer when the stored value is corrupt', () => {
    storage.data.set(TIMER_STORAGE_KEY, '{"phase":"nope"}')
    expect(build().getState().timer).toEqual(createTimer())
  })

  test('works in memory only when storage is unavailable', () => {
    const focus = build({ storage: null })
    focus.getState().start()
    clock = T0 + MIN
    focus.getState().pause()
    expect(focus.getState().timer.phase).toBe('paused')
  })

  test('pause and resume go through the injected clock', () => {
    const focus = build()
    focus.getState().start()
    clock = T0 + 5 * MIN
    focus.getState().pause()
    clock = T0 + 60 * MIN
    focus.getState().resume()

    expect(focus.getState().timer).toMatchObject({ phase: 'running', accumulatedMs: 5 * MIN, runningSince: T0 + 60 * MIN })
  })

  test('mode cannot change while running but can change when idle', () => {
    const focus = build()
    focus.getState().setMode('stopwatch')
    expect(focus.getState().timer.kind).toBe('stopwatch')
    focus.getState().start()
    focus.getState().setMode('pomodoro')
    expect(focus.getState().timer.kind).toBe('stopwatch')
  })
})

describe('focus store: saving sessions', () => {
  test('a finished focus is saved once and adds time to the linked task in one change set', () => {
    const task = makeTask({ id: 'a', title: '보고서' })
    app.getState().commit({ puts: { tasks: [task] }, deletes: {} }, '추가', { history: false })
    const focus = build()
    focus.getState().setTask('a')
    focus.getState().start()

    clock = T0 + 25 * MIN - 1
    focus.getState().tick()
    expect(sessions()).toHaveLength(0)

    clock = T0 + 25 * MIN
    focus.getState().tick()
    focus.getState().tick()

    expect(sessions()).toEqual([
      { id: 'fs-1', taskId: 'a', kind: 'pomodoro', startedAt: T0, durationSec: 1500, completed: true },
    ])
    expect(Object.values(app.getState().entities.tasks['a'].actualMin)).toEqual([25])
    expect(app.getState().entities.tasks['a'].updatedAt).toBe(clock)
    expect(focus.getState().timer.phase).toBe('finished')
  })

  test('saves an unlinked session as well', () => {
    const focus = build()
    focus.getState().start()
    clock = T0 + 25 * MIN
    focus.getState().tick()

    expect(sessions()).toHaveLength(1)
    expect(sessions()[0].taskId).toBeNull()
  })

  test('does not clutter the undo history', () => {
    const focus = build()
    focus.getState().start()
    clock = T0 + 25 * MIN
    focus.getState().tick()

    expect(app.getState().undoStack).toHaveLength(0)
  })

  test('drops the link when the task no longer exists', () => {
    const focus = build()
    focus.getState().setTask('ghost')
    focus.getState().start()
    clock = T0 + 25 * MIN
    focus.getState().tick()

    expect(sessions()[0].taskId).toBeNull()
  })

  test('stopping a focus early keeps an incomplete record without touching the task', () => {
    const task = makeTask({ id: 'a' })
    app.getState().commit({ puts: { tasks: [task] }, deletes: {} }, '추가', { history: false })
    const focus = build()
    focus.getState().setTask('a')
    focus.getState().start()
    clock = T0 + 10 * MIN
    focus.getState().stop()

    expect(sessions()).toMatchObject([{ completed: false, durationSec: 600 }])
    expect(app.getState().entities.tasks['a'].actualMin).toEqual({})
    expect(focus.getState().timer.phase).toBe('idle')
    expect(announce).not.toHaveBeenCalled()
  })

  test('stopping the stopwatch records its time on the task', () => {
    const task = makeTask({ id: 'a' })
    app.getState().commit({ puts: { tasks: [task] }, deletes: {} }, '추가', { history: false })
    const focus = build()
    focus.getState().setMode('stopwatch')
    focus.getState().setTask('a')
    focus.getState().start()
    clock = T0 + 42 * MIN
    focus.getState().stop()

    expect(sessions()).toMatchObject([{ kind: 'stopwatch', completed: true, durationSec: 2520 }])
    expect(Object.values(app.getState().entities.tasks['a'].actualMin)).toEqual([42])
  })

  test('skipping a focus saves the partial time and offers a break', () => {
    const focus = build()
    focus.getState().start()
    clock = T0 + 12 * MIN
    focus.getState().skip()

    expect(sessions()).toMatchObject([{ completed: false, durationSec: 720 }])
    expect(focus.getState().timer.next).toBe('shortBreak')
  })

  test('a break saves nothing', () => {
    const focus = build()
    focus.getState().start()
    clock = T0 + 25 * MIN
    focus.getState().tick()
    focus.getState().start()
    clock = T0 + 30 * MIN
    focus.getState().tick()

    expect(sessions()).toHaveLength(1)
    expect(focus.getState().timer.next).toBe('focus')
  })
})

describe('focus store: alerts and settings', () => {
  test('announces when a session runs out, with the sound setting and next hint', () => {
    app.getState().commit({ puts: { tasks: [makeTask({ id: 'a', title: '보고서' })] }, deletes: {} }, '추가', { history: false })
    const focus = build()
    focus.getState().setTask('a')
    focus.getState().start()
    clock = T0 + 25 * MIN
    focus.getState().tick()

    expect(announce).toHaveBeenCalledWith({ title: '집중 끝', body: '보고서 · 다음: 짧은 휴식' }, true)
  })

  test('passes the sound-off setting through', () => {
    app.getState().updateSettings({ pomodoro: { ...app.getState().settings.pomodoro, sound: false } })
    const focus = build()
    focus.getState().start()
    clock = T0 + 25 * MIN
    focus.getState().tick()

    expect(announce).toHaveBeenCalledWith(expect.anything(), false)
  })

  test('uses the latest pomodoro settings when starting', () => {
    app.getState().updateSettings({ pomodoro: { ...app.getState().settings.pomodoro, focusMin: 10 } })
    const focus = build()
    focus.getState().start()

    expect(focus.getState().timer.targetMs).toBe(10 * MIN)
  })

  test('auto start keeps going into the break', () => {
    app.getState().updateSettings({ pomodoro: { ...app.getState().settings.pomodoro, autoStart: true } })
    const focus = build()
    focus.getState().start()
    clock = T0 + 25 * MIN
    focus.getState().tick()

    expect(focus.getState().timer).toMatchObject({ phase: 'running', kind: 'shortBreak' })
  })
})

describe('syncAcrossTabs', () => {
  test('adopts a valid state written by another tab and ignores unrelated keys', () => {
    const focus = build()
    const stop = syncAcrossTabs(focus, window)
    const other = { ...createTimer(), phase: 'running', startedAt: T0, runningSince: T0, targetMs: 5 * MIN } as const

    window.dispatchEvent(new StorageEvent('storage', { key: 'other', newValue: JSON.stringify(other) }))
    expect(focus.getState().timer.phase).toBe('idle')

    window.dispatchEvent(new StorageEvent('storage', { key: TIMER_STORAGE_KEY, newValue: JSON.stringify(other) }))
    expect(focus.getState().timer.phase).toBe('running')

    window.dispatchEvent(new StorageEvent('storage', { key: TIMER_STORAGE_KEY, newValue: '{bad' }))
    expect(focus.getState().timer.phase).toBe('running')
    stop()
  })
})
