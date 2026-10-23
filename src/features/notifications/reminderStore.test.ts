import { createReminderStore } from './reminderStore'
import { loadState, STORAGE_KEY } from './reminderState'
import type { StorageLike } from './reminderState'
import type { DueReminder } from './schedule'

function memoryStorage(): StorageLike & { data: Record<string, string> } {
  const data: Record<string, string> = {}
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value
    },
  }
}

const due = (key: string, at = 1000): DueReminder => ({ key, taskId: key.split('|')[0], title: '제목', at, body: '' })

describe('reminder store', () => {
  test('ingest shows cards and persists fired keys and lastCheck', () => {
    const storage = memoryStorage()
    const store = createReminderStore(storage)

    store.getState().ingest([due('t1|r1|2026-10-24')], 5000)

    expect(store.getState().cards.map((c) => c.key)).toEqual(['t1|r1|2026-10-24'])
    expect(loadState(storage)).toMatchObject({ lastCheck: 5000, fired: { 't1|r1|2026-10-24': 5000 } })
  })

  test('a repeated persistent round replaces the earlier card of the same reminder', () => {
    const store = createReminderStore(memoryStorage())
    store.getState().ingest([due('t1|r1|2026-10-24'), due('t2|r1|2026-10-24')], 1)

    store.getState().ingest([due('t1|r1|2026-10-24|1')], 2)

    expect(store.getState().cards.map((c) => c.key)).toEqual(['t2|r1|2026-10-24', 't1|r1|2026-10-24|1'])
  })

  test('snooze removes the card and saves the snooze time', () => {
    const storage = memoryStorage()
    const store = createReminderStore(storage)
    store.getState().ingest([due('t1|r1|2026-10-24')], 1)

    store.getState().snooze('t1|r1|2026-10-24', 99_000)

    expect(store.getState().cards).toEqual([])
    expect(loadState(storage).snoozed).toEqual({ 't1|r1|2026-10-24': 99_000 })
  })

  test('dismiss only removes the card', () => {
    const store = createReminderStore(memoryStorage())
    store.getState().ingest([due('t1|r1|2026-10-24'), due('t2|r1|2026-10-24')], 1)

    store.getState().dismiss('t1|r1|2026-10-24')

    expect(store.getState().cards.map((c) => c.taskId)).toEqual(['t2'])
  })

  test('dismissAll clears every card', () => {
    const store = createReminderStore(memoryStorage())
    store.getState().ingest([due('t1|r1|2026-10-24'), due('t2|r1|2026-10-24')], 1)

    store.getState().dismissAll()

    expect(store.getState().cards).toEqual([])
  })

  test('refresh picks up state written by another tab', () => {
    const storage = memoryStorage()
    const store = createReminderStore(storage)
    storage.setItem(STORAGE_KEY, JSON.stringify({ lastCheck: 42, fired: { x: 1 }, snoozed: {} }))

    store.getState().refresh()

    expect(store.getState().state).toEqual({ lastCheck: 42, fired: { x: 1 }, snoozed: {} })
  })

  test('keeps working in memory when storage is unavailable', () => {
    const store = createReminderStore(null)

    store.getState().ingest([due('t1|r1|2026-10-24')], 1)

    expect(store.getState().cards).toHaveLength(1)
    expect(store.getState().state.lastCheck).toBe(1)
  })
})
