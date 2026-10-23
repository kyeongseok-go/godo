import { reviewCandidates } from '../../domain/planning'
import type { EngineContext, Task } from '../../domain/types'
import { applyChangeSet, emptyEntityState, isEmptyChangeSet } from '../../store/changes'
import type { ChangeSet, EntityState } from '../../store/changes'
import { makeTask } from '../../test/factories'
import {
  countHandled,
  groupByReason,
  REVIEW_ACTIONS,
  reviewActionForKey,
  reviewChangeSet,
  reviewDoneMessage,
  visibleItems,
} from './actions'
import type { ReviewActionContext } from './actions'

const DAY = 86_400_000
const NOW = new Date(2026, 9, 23, 12).getTime() // 2026-10-23 금요일
const ctx: ReviewActionContext = { today: '2026-10-23', weekStartsOn: 1, nowMs: NOW }

const stateWith = (tasks: Task[]): EntityState =>
  applyChangeSet(emptyEntityState(), { puts: { tasks }, deletes: {} }).next
const run = (state: EntityState, cs: ChangeSet): EntityState => applyChangeSet(state, cs).next
const engine = (state: EntityState): EngineContext => ({
  today: ctx.today,
  now: new Date(NOW),
  weekStartsOn: 1,
  projects: [],
  sections: [],
  labels: [],
  tasks: Object.values(state.tasks),
})
const OPTS = { staleDays: 14, postponeThreshold: 3 }
const stale = (overrides: Partial<Task> = {}) => makeTask({ id: 'a', title: '묵은 일', updatedAt: NOW - 20 * DAY, ...overrides })

describe('reviewChangeSet', () => {
  test('keep refreshes only the modified time', () => {
    const state = stateWith([stale({ priority: 2 })])

    const task = run(state, reviewChangeSet(state, 'a', 'keep', ctx)).tasks.a

    expect(task).toEqual({ ...state.tasks.a, updatedAt: NOW })
  })

  test('keep removes a stale task from the next review', () => {
    const state = stateWith([stale()])
    expect(reviewCandidates(engine(state), OPTS)).toHaveLength(1)

    const next = run(state, reviewChangeSet(state, 'a', 'keep', ctx))

    expect(reviewCandidates(engine(next), OPTS)).toHaveLength(0)
  })

  test('today schedules the task for today without counting as a postponement', () => {
    const state = stateWith([stale({ postponeCount: 4 })])

    const task = run(state, reviewChangeSet(state, 'a', 'today', ctx)).tasks.a

    expect(task.startDate).toBe('2026-10-23')
    expect(task.postponeCount).toBe(4)
    expect(task.updatedAt).toBe(NOW)
  })

  test('nextWeek moves the start to the first day of next week and counts the postponement', () => {
    const state = stateWith([stale({ startDate: '2026-10-20', postponeCount: 1 })])

    const changes = reviewChangeSet(state, 'a', 'nextWeek', ctx)
    const task = run(state, changes).tasks.a

    expect(task.startDate).toBe('2026-10-26')
    expect(task.postponeCount).toBe(2)
    expect(changes.puts.activity?.[0].type).toBe('postponed')
  })

  test('nextWeek respects a Sunday week start', () => {
    const state = stateWith([stale()])

    const task = run(state, reviewChangeSet(state, 'a', 'nextWeek', { ...ctx, weekStartsOn: 0 })).tasks.a

    expect(task.startDate).toBe('2026-10-25')
  })

  test('someday parks the task and clears its date', () => {
    const state = stateWith([stale({ startDate: '2026-10-20' })])

    const next = run(state, reviewChangeSet(state, 'a', 'someday', ctx))

    expect(next.tasks.a.someday).toBe(true)
    expect(next.tasks.a.startDate).toBeNull()
    expect(reviewCandidates(engine(next), OPTS)).toHaveLength(0)
  })

  test('cancel closes the task and its open subtasks', () => {
    const state = stateWith([stale(), makeTask({ id: 'b', parentId: 'a' })])

    const next = run(state, reviewChangeSet(state, 'a', 'cancel', ctx))

    expect(next.tasks.a.status).toBe('canceled')
    expect(next.tasks.b.status).toBe('canceled')
  })

  test('delete moves the task to the trash', () => {
    const state = stateWith([stale()])

    const next = run(state, reviewChangeSet(state, 'a', 'delete', ctx))

    expect(next.tasks.a.deletedAt).toBe(NOW)
  })

  test('every action is a no-op for a task that no longer exists', () => {
    const state = stateWith([])

    for (const { kind } of REVIEW_ACTIONS) {
      expect(isEmptyChangeSet(reviewChangeSet(state, 'gone', kind, ctx))).toBe(true)
    }
  })

  test('never mutates the state it was given', () => {
    const state = stateWith([stale()])
    const before = structuredClone(state)

    for (const { kind } of REVIEW_ACTIONS) reviewChangeSet(state, 'a', kind, ctx)

    expect(state).toEqual(before)
  })
})

describe('reviewActionForKey', () => {
  const key = (k: string, mods: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean }> = {}) =>
    reviewActionForKey({ key: k, metaKey: false, ctrlKey: false, altKey: false, ...mods })

  test('maps the five review letters', () => {
    expect([key('k'), key('t'), key('w'), key('s'), key('x')]).toEqual(['keep', 'today', 'nextWeek', 'someday', 'cancel'])
  })

  test('ignores letter case', () => {
    expect(key('K')).toBe('keep')
  })

  test('leaves modified chords and other keys alone', () => {
    expect(key('k', { metaKey: true })).toBeNull()
    expect(key('t', { ctrlKey: true })).toBeNull()
    expect(key('x', { altKey: true })).toBeNull()
    expect(key('Enter')).toBeNull()
    expect(key('j')).toBeNull()
  })

  test('has no shortcut for delete so it cannot happen by accident', () => {
    expect(REVIEW_ACTIONS.find((a) => a.kind === 'delete')?.key).toBeNull()
  })
})

describe('reviewDoneMessage', () => {
  test('quotes the title after a short verb phrase', () => {
    expect(reviewDoneMessage('today', '보고서')).toBe('오늘로 옮겼어요: "보고서"')
  })

  test('shortens long titles', () => {
    const message = reviewDoneMessage('keep', '가'.repeat(60))

    expect(message.length).toBeLessThan(50)
    expect(message).toContain('…')
  })
})

describe('groupByReason', () => {
  const item = (task: Task, reason: 'stale' | 'postponed' | 'noNextAction' | 'overdueDeadline') => ({ task, reason, detail: '' })

  test('orders groups overdue, postponed, stale, then no-next-action and drops empty ones', () => {
    const groups = groupByReason([
      item(makeTask({ id: 's' }), 'stale'),
      item(makeTask({ id: 'o' }), 'overdueDeadline'),
      item(makeTask({ id: 'n' }), 'noNextAction'),
    ])

    expect(groups.map((g) => g.reason)).toEqual(['overdueDeadline', 'stale', 'noNextAction'])
  })

  test('sorts inside groups: most overdue, most postponed, longest idle first', () => {
    const groups = groupByReason([
      item(makeTask({ id: 'o2', dueDate: '2026-10-22' }), 'overdueDeadline'),
      item(makeTask({ id: 'o1', dueDate: '2026-10-01' }), 'overdueDeadline'),
      item(makeTask({ id: 'p3', postponeCount: 3 }), 'postponed'),
      item(makeTask({ id: 'p9', postponeCount: 9 }), 'postponed'),
      item(makeTask({ id: 's2', updatedAt: 200 }), 'stale'),
      item(makeTask({ id: 's1', updatedAt: 100 }), 'stale'),
    ])

    const ids = (reason: string) => groups.find((g) => g.reason === reason)?.items.map((i) => i.task.id)
    expect(ids('overdueDeadline')).toEqual(['o1', 'o2'])
    expect(ids('postponed')).toEqual(['p9', 'p3'])
    expect(ids('stale')).toEqual(['s1', 's2'])
  })

  test('returns nothing for no items', () => {
    expect(groupByReason([])).toEqual([])
  })
})

describe('visibleItems', () => {
  const items = [
    { task: makeTask({ id: 'a', updatedAt: 10 }), reason: 'stale' as const, detail: '' },
    { task: makeTask({ id: 'b', updatedAt: 20 }), reason: 'stale' as const, detail: '' },
  ]

  test('hides items handled in this session', () => {
    expect(visibleItems(items, { a: 10 }).map((i) => i.task.id)).toEqual(['b'])
  })

  test('shows an item again once its record changed after handling (undo or another edit)', () => {
    expect(visibleItems(items, { a: 5 }).map((i) => i.task.id)).toEqual(['a', 'b'])
  })
})

describe('countHandled', () => {
  const tasks = { a: makeTask({ id: 'a', updatedAt: 10 }), b: makeTask({ id: 'b', updatedAt: 20 }) }

  test('counts handled tasks whose record is unchanged since', () => {
    expect(countHandled({ a: 10, b: 20 }, tasks)).toBe(2)
  })

  test('skips undone, re-edited and missing tasks', () => {
    expect(countHandled({ a: 99, gone: 1 }, tasks)).toBe(0)
  })

  test('is zero when nothing was handled', () => {
    expect(countHandled({}, tasks)).toBe(0)
  })
})
