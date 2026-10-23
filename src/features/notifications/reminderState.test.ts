import { emptyState, firedKeys, loadState, parseState, pruneState, recordFired, saveState, snoozeReminder, STORAGE_KEY } from './reminderState'
import type { StorageLike } from './reminderState'
import type { DueReminder } from './schedule'

const HOUR = 3_600_000

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value
    },
  }
}

const due = (key: string, at = 1000): DueReminder => ({ key, taskId: 't1', title: '제목', at, body: '' })

describe('parseState', () => {
  test('returns an empty state for non-object input', () => {
    expect(parseState(null)).toEqual(emptyState())
    expect(parseState('x')).toEqual(emptyState())
    expect(parseState([1, 2])).toEqual(emptyState())
  })

  test('keeps valid entries and drops malformed ones', () => {
    const parsed = parseState({
      lastCheck: 500,
      fired: { a: 1, b: 'x', c: Number.NaN },
      snoozed: { s: 9, t: null },
    })

    expect(parsed).toEqual({ lastCheck: 500, fired: { a: 1 }, snoozed: { s: 9 } })
  })

  test('falls back to zero for a bad lastCheck', () => {
    expect(parseState({ lastCheck: 'soon', fired: {}, snoozed: {} }).lastCheck).toBe(0)
  })
})

describe('loadState / saveState', () => {
  test('round-trips through storage', () => {
    const storage = memoryStorage()
    const state = { lastCheck: 7, fired: { a: 1 }, snoozed: { b: 2 } }

    expect(saveState(storage, state)).toBe(true)

    expect(loadState(storage)).toEqual(state)
  })

  test('returns an empty state when nothing is stored', () => {
    expect(loadState(memoryStorage())).toEqual(emptyState())
  })

  test('returns an empty state when the stored text is not JSON', () => {
    expect(loadState(memoryStorage({ [STORAGE_KEY]: '{깨짐' }))).toEqual(emptyState())
  })

  test('returns an empty state when storage is unavailable or throws', () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }

    expect(loadState(null)).toEqual(emptyState())
    expect(loadState(throwing)).toEqual(emptyState())
    expect(saveState(null, emptyState())).toBe(false)
    expect(saveState(throwing, emptyState())).toBe(false)
  })
})

describe('recordFired', () => {
  test('marks keys as fired and advances lastCheck without mutating the input', () => {
    const state = emptyState()

    const next = recordFired(state, [due('a'), due('b')], 5000)

    expect(next.fired).toEqual({ a: 5000, b: 5000 })
    expect(next.lastCheck).toBe(5000)
    expect(state).toEqual(emptyState())
  })

  test('still advances lastCheck when nothing fired', () => {
    expect(recordFired(emptyState(), [], 9000).lastCheck).toBe(9000)
  })

  test('exposes fired keys as a set', () => {
    const next = recordFired(emptyState(), [due('a')], 1)

    expect(firedKeys(next)).toEqual(new Set(['a']))
  })
})

describe('snoozeReminder', () => {
  test('stores the snooze time under the base key', () => {
    const next = snoozeReminder(emptyState(), 't1|r1|2026-10-24|3', 8000)

    expect(next.snoozed).toEqual({ 't1|r1|2026-10-24': 8000 })
  })

  test('replaces an earlier snooze of the same reminder', () => {
    const first = snoozeReminder(emptyState(), 't1|r1|2026-10-24', 8000)

    const second = snoozeReminder(first, 't1|r1|2026-10-24|z8000', 9000)

    expect(second.snoozed).toEqual({ 't1|r1|2026-10-24': 9000 })
    expect(first.snoozed['t1|r1|2026-10-24']).toBe(8000)
  })
})

describe('pruneState', () => {
  test('drops fired keys and snoozes older than 48 hours', () => {
    const now = 100 * HOUR
    const state = {
      lastCheck: now,
      fired: { old: now - 49 * HOUR, fresh: now - 47 * HOUR },
      snoozed: { oldS: now - 49 * HOUR, freshS: now + HOUR },
    }

    const next = pruneState(state, now)

    expect(next.fired).toEqual({ fresh: now - 47 * HOUR })
    expect(next.snoozed).toEqual({ freshS: now + HOUR })
  })

  test('returns the same object when there is nothing to prune', () => {
    const state = { lastCheck: 1, fired: { a: 1 }, snoozed: {} }

    expect(pruneState(state, 2)).toBe(state)
  })
})
