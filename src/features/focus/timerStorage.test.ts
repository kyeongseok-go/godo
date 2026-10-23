import { createTimer } from './timer'
import type { TimerState } from './timer'
import { TIMER_STORAGE_KEY, parseTimerState, readTimer, writeTimer } from './timerStorage'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  }
}

const RUNNING: TimerState = {
  ...createTimer(),
  phase: 'running',
  taskId: 't1',
  startedAt: 1_000,
  runningSince: 1_000,
  targetMs: 1_500_000,
  focusDone: 2,
}

describe('parseTimerState', () => {
  test('accepts a valid running state', () => {
    expect(parseTimerState(RUNNING)).toEqual(RUNNING)
  })

  test('rejects wrong shapes and values', () => {
    expect(parseTimerState(null)).toBeNull()
    expect(parseTimerState('x')).toBeNull()
    expect(parseTimerState({ ...RUNNING, phase: 'flying' })).toBeNull()
    expect(parseTimerState({ ...RUNNING, accumulatedMs: -1 })).toBeNull()
    expect(parseTimerState({ ...RUNNING, targetMs: Number.NaN })).toBeNull()
  })

  test('rejects a running state with no start time', () => {
    expect(parseTimerState({ ...RUNNING, runningSince: null })).toBeNull()
    expect(parseTimerState({ ...RUNNING, startedAt: null })).toBeNull()
  })

  test('rejects a finished state that has nothing queued', () => {
    expect(parseTimerState({ ...createTimer(), phase: 'finished', next: null })).toBeNull()
  })
})

describe('readTimer and writeTimer', () => {
  test('round-trips a state through storage', () => {
    const storage = memoryStorage()
    writeTimer(storage, RUNNING)
    expect(readTimer(storage)).toEqual(RUNNING)
  })

  test('returns null for missing, corrupt or invalid data', () => {
    expect(readTimer(memoryStorage())).toBeNull()
    expect(readTimer(memoryStorage({ [TIMER_STORAGE_KEY]: '{oops' }))).toBeNull()
    expect(readTimer(memoryStorage({ [TIMER_STORAGE_KEY]: '{"phase":"zzz"}' }))).toBeNull()
  })

  test('works without storage', () => {
    expect(readTimer(null)).toBeNull()
    expect(writeTimer(null, RUNNING)).toBe(false)
  })

  test('reports failure when storage throws instead of crashing', () => {
    const blocked = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('quota')
      },
    }
    expect(readTimer(blocked)).toBeNull()
    expect(writeTimer(blocked, RUNNING)).toBe(false)
  })
})
