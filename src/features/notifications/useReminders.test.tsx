import { act, renderHook } from '@testing-library/react'
import { vi } from 'vitest'
import { makeTask } from '../../test/factories'
import { useApp } from '../../store/app'
import { emptyEntityState } from '../../store/changes'
import { defaultSettings } from '../../store/defaults'
import { emptyState, STORAGE_KEY } from './reminderState'
import { createReminderStore, useReminderStore } from './reminderStore'
import type { StorageLike } from './reminderState'
import { runReminderCheck, useReminders, CHECK_INTERVAL_MS } from './useReminders'
import type { CheckInput } from './useReminders'

const local = (h: number, min = 0): number => new Date(2026, 9, 24, h, min).getTime()

const task = makeTask({
  id: 't1',
  title: '보고서 제출',
  startDate: '2026-10-24',
  startTime: '15:00',
  reminders: [{ id: 'r1', kind: 'relative', offsetMin: 0 }],
})
const input: CheckInput = { tasks: [task], workStart: '09:00', timeFormat: '24h' }

function memoryStorage(): StorageLike {
  const data: Record<string, string> = {}
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) }
}

describe('runReminderCheck', () => {
  test('raises a card and a browser notification once for a due reminder', () => {
    const store = createReminderStore(memoryStorage())
    const notify = vi.fn(() => 1)
    store.getState().ingest([], local(14, 59))

    const first = runReminderCheck(input, local(15, 0), { store, notify })
    const second = runReminderCheck(input, local(15, 1), { store, notify })

    expect(first.map((d) => d.key)).toEqual(['t1|r1|2026-10-24'])
    expect(second).toEqual([])
    expect(notify).toHaveBeenCalledTimes(1)
    expect(store.getState().cards).toHaveLength(1)
  })

  test('does not notify again after a reload that restores the saved state', () => {
    const storage = memoryStorage()
    const notify = vi.fn(() => 1)
    runReminderCheck(input, local(15, 0), { store: createReminderStore(storage), notify })

    const reloaded = createReminderStore(storage)
    const due = runReminderCheck(input, local(15, 5), { store: reloaded, notify })

    expect(due).toEqual([])
    expect(notify).toHaveBeenCalledTimes(1)
  })

  test('catches a reminder missed while the app was closed', () => {
    const storage = memoryStorage()
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...emptyState(), lastCheck: local(14, 0) }))
    const notify = vi.fn(() => 1)

    const due = runReminderCheck(input, local(18, 0), { store: createReminderStore(storage), notify })

    expect(due).toHaveLength(1)
  })

  test('respects a snooze saved by another tab', () => {
    const storage = memoryStorage()
    const notify = vi.fn(() => 1)
    storage.setItem(STORAGE_KEY, JSON.stringify({ lastCheck: local(14, 59), fired: {}, snoozed: { 't1|r1|2026-10-24': local(15, 30) } }))

    const due = runReminderCheck(input, local(15, 5), { store: createReminderStore(storage), notify })

    expect(due).toEqual([])
    expect(notify).not.toHaveBeenCalled()
  })
})

describe('useReminders', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(local(14, 59))
    localStorage.clear()
    useReminderStore.setState({ cards: [], state: emptyState() })
  })

  afterEach(() => {
    vi.useRealTimers()
    useApp.setState({ ready: false, entities: emptyEntityState(), settings: defaultSettings() })
  })

  function loadApp(): void {
    useApp.setState({ ready: true, entities: { ...emptyEntityState(), tasks: { t1: task } }, settings: defaultSettings() })
  }

  test('waits for the data to be ready before checking', () => {
    renderHook(() => useReminders())

    act(() => {
      vi.advanceTimersByTime(CHECK_INTERVAL_MS * 3)
    })

    expect(useReminderStore.getState().state.lastCheck).toBe(0)
  })

  test('checks every 30 seconds once ready', () => {
    loadApp()
    renderHook(() => useReminders())
    expect(useReminderStore.getState().cards).toHaveLength(0)

    act(() => {
      vi.advanceTimersByTime(CHECK_INTERVAL_MS * 3)
    })

    expect(useReminderStore.getState().cards.map((c) => c.taskId)).toEqual(['t1'])
  })

  test('checks again when the tab becomes visible', () => {
    loadApp()
    renderHook(() => useReminders())
    vi.setSystemTime(local(15, 10))

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(useReminderStore.getState().cards).toHaveLength(1)
  })

  test('stops checking after unmount', () => {
    loadApp()
    const { unmount } = renderHook(() => useReminders())
    unmount()

    act(() => {
      vi.advanceTimersByTime(CHECK_INTERVAL_MS * 10)
    })

    expect(useReminderStore.getState().cards).toHaveLength(0)
  })

  test('does not re-render its host when tasks or settings change', () => {
    loadApp()
    let renders = 0
    renderHook(() => {
      renders += 1
      useReminders()
    })
    const afterMount = renders

    act(() => {
      useApp.setState({ entities: { ...emptyEntityState(), tasks: { t1: task, t2: { ...task, id: 't2' } } } })
      useApp.setState({ settings: { ...defaultSettings(), timeFormat: '12h' } })
    })

    expect(renders).toBe(afterMount)
  })

  test('uses the latest tasks at check time, including ones added after mount', () => {
    useApp.setState({ ready: true, entities: emptyEntityState(), settings: defaultSettings() })
    renderHook(() => useReminders())
    act(() => {
      useApp.setState({ entities: { ...emptyEntityState(), tasks: { t1: task } } })
      vi.advanceTimersByTime(CHECK_INTERVAL_MS * 3)
    })

    expect(useReminderStore.getState().cards.map((c) => c.taskId)).toEqual(['t1'])
  })

  test('stops alerting for a task that was removed before the next check', () => {
    loadApp()
    renderHook(() => useReminders())
    act(() => {
      useApp.setState({ entities: emptyEntityState() })
      vi.advanceTimersByTime(CHECK_INTERVAL_MS * 3)
    })

    expect(useReminderStore.getState().cards).toHaveLength(0)
  })
})
