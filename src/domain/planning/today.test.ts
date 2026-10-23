import { describe, expect, it } from 'vitest'
import { makeTask } from '../../test/factories'
import type { EngineContext, Task } from '../types'
import { buildToday } from './today'

const TODAY = '2026-03-10'

function ctxOf(tasks: Task[]): EngineContext {
  return { today: TODAY, now: new Date(2026, 2, 10, 9, 0), weekStartsOn: 1, projects: [], sections: [], labels: [], tasks }
}

const ids = (tasks: Task[]): string[] => tasks.map((t) => t.id)

describe('buildToday', () => {
  it('returns empty groups for no tasks', () => {
    expect(buildToday(ctxOf([]))).toEqual({
      overdue: [],
      morning: [],
      afternoon: [],
      evening: [],
      anytime: [],
      timed: [],
    })
  })

  it('puts tasks with startDate today into anytime by default', () => {
    const t = makeTask({ startDate: TODAY })
    expect(ids(buildToday(ctxOf([t])).anytime)).toEqual([t.id])
  })

  it('uses the due date when there is no start date', () => {
    const today = makeTask({ dueDate: TODAY })
    const future = makeTask({ dueDate: '2026-03-11' })
    const plan = buildToday(ctxOf([today, future]))
    expect(ids(plan.anytime)).toEqual([today.id])
  })

  it('does not show a task whose start date is today-later than its due date logic', () => {
    const t = makeTask({ startDate: '2026-03-12', dueDate: TODAY })
    const plan = buildToday(ctxOf([t]))
    expect(ids(plan.anytime)).toEqual([])
    expect(plan.overdue).toEqual([])
  })

  it('sorts overdue tasks oldest first using startDate before dueDate', () => {
    const a = makeTask({ startDate: '2026-03-08' })
    const b = makeTask({ dueDate: '2026-03-02' })
    const c = makeTask({ startDate: '2026-03-09', dueDate: '2026-03-30' })
    const plan = buildToday(ctxOf([a, b, c]))
    expect(ids(plan.overdue)).toEqual([b.id, a.id, c.id])
  })

  it('shows an overdue task only once, not again in today groups', () => {
    const t = makeTask({ startDate: '2026-03-09', dueDate: TODAY })
    const plan = buildToday(ctxOf([t]))
    expect(ids(plan.overdue)).toEqual([t.id])
    expect(plan.anytime).toEqual([])
  })

  it('groups by dayPart and keeps unspecified ones in anytime', () => {
    const m = makeTask({ startDate: TODAY, dayPart: 'morning' })
    const a = makeTask({ startDate: TODAY, dayPart: 'afternoon' })
    const e = makeTask({ startDate: TODAY, dayPart: 'evening' })
    const any = makeTask({ startDate: TODAY })
    const plan = buildToday(ctxOf([any, e, a, m]))
    expect(ids(plan.morning)).toEqual([m.id])
    expect(ids(plan.afternoon)).toEqual([a.id])
    expect(ids(plan.evening)).toEqual([e.id])
    expect(ids(plan.anytime)).toEqual([any.id])
  })

  it('puts tasks with a start time into timed, sorted by time', () => {
    const late = makeTask({ startDate: TODAY, startTime: '15:00', dayPart: 'afternoon' })
    const early = makeTask({ startDate: TODAY, startTime: '08:30' })
    const plan = buildToday(ctxOf([late, early]))
    expect(ids(plan.timed)).toEqual([early.id, late.id])
    expect(plan.afternoon).toEqual([])
  })

  it('orders each group by pinned, then priority, then order', () => {
    const plain = makeTask({ startDate: TODAY, priority: 4, order: 1 })
    const p1 = makeTask({ startDate: TODAY, priority: 1, order: 5 })
    const pinned = makeTask({ startDate: TODAY, priority: 4, order: 9, pinned: true })
    const p1First = makeTask({ startDate: TODAY, priority: 1, order: 2 })
    const plan = buildToday(ctxOf([plain, p1, pinned, p1First]))
    expect(ids(plan.anytime)).toEqual([pinned.id, p1First.id, p1.id, plain.id])
  })

  it('excludes blocked, on-hold, someday, deleted and finished tasks', () => {
    const blocker = makeTask({ startDate: TODAY })
    const blocked = makeTask({ startDate: TODAY, blockedBy: [blocker.id] })
    const held = makeTask({ startDate: TODAY, onHold: true })
    const someday = makeTask({ dueDate: TODAY, someday: true })
    const deleted = makeTask({ startDate: TODAY, deletedAt: 1 })
    const done = makeTask({ startDate: TODAY, status: 'done' })
    const oldHeld = makeTask({ startDate: '2026-03-01', onHold: true })
    const plan = buildToday(ctxOf([blocker, blocked, held, someday, deleted, done, oldHeld]))
    expect(ids(plan.anytime)).toEqual([blocker.id])
    expect(plan.overdue).toEqual([])
  })

  it('includes a subtask on its own date independent of the parent date', () => {
    const parent = makeTask({ startDate: '2026-03-20' })
    const child = makeTask({ parentId: parent.id, startDate: TODAY })
    const plan = buildToday(ctxOf([parent, child]))
    expect(ids(plan.anytime)).toEqual([child.id])
  })

  it('excludes subtasks of an on-hold parent', () => {
    const parent = makeTask({ onHold: true })
    const child = makeTask({ parentId: parent.id, startDate: TODAY })
    expect(ids(buildToday(ctxOf([parent, child])).anytime)).toEqual([])
  })

  it('does not mutate the input', () => {
    const tasks = [makeTask({ startDate: '2026-03-01' }), makeTask({ startDate: TODAY })]
    const frozen = Object.freeze(tasks.map((t) => Object.freeze(t)))
    expect(() => buildToday(ctxOf([...frozen]))).not.toThrow()
  })
})
