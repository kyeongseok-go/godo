import { describe, expect, it } from 'vitest'
import { makeTask } from '../../test/factories'
import type { EngineContext, Task } from '../types'
import { isActionable, isHiddenUntilStart, makeActionableChecker } from './actionable'

const TODAY = '2026-03-10'

function ctxOf(tasks: Task[], today = TODAY): EngineContext {
  return { today, now: new Date(2026, 2, 10, 9, 0), weekStartsOn: 1, projects: [], sections: [], labels: [], tasks }
}

function actionable(task: Task, others: Task[] = []): boolean {
  return isActionable(task, ctxOf([task, ...others]))
}

describe('isActionable', () => {
  it('returns true for a plain todo task without dates', () => {
    expect(actionable(makeTask())).toBe(true)
  })

  it('returns true for an active task', () => {
    expect(actionable(makeTask({ status: 'active' }))).toBe(true)
  })

  it('returns false for done and canceled tasks', () => {
    expect(actionable(makeTask({ status: 'done' }))).toBe(false)
    expect(actionable(makeTask({ status: 'canceled' }))).toBe(false)
  })

  it('returns false for deleted, on-hold and someday tasks', () => {
    expect(actionable(makeTask({ deletedAt: 1 }))).toBe(false)
    expect(actionable(makeTask({ onHold: true }))).toBe(false)
    expect(actionable(makeTask({ someday: true }))).toBe(false)
  })

  it('returns false when the start date is in the future', () => {
    expect(actionable(makeTask({ startDate: '2026-03-11' }))).toBe(false)
  })

  it('returns true when the start date is today or earlier', () => {
    expect(actionable(makeTask({ startDate: TODAY }))).toBe(true)
    expect(actionable(makeTask({ startDate: '2026-03-01' }))).toBe(true)
  })

  it('ignores the due date when judging actionability', () => {
    expect(actionable(makeTask({ dueDate: '2026-04-01' }))).toBe(true)
  })

  it('returns false while a blocker is still todo or active', () => {
    const blocker = makeTask({ status: 'todo' })
    const active = makeTask({ status: 'active' })
    expect(actionable(makeTask({ blockedBy: [blocker.id] }), [blocker])).toBe(false)
    expect(actionable(makeTask({ blockedBy: [active.id] }), [active])).toBe(false)
  })

  it('returns true when every blocker is done, canceled, deleted or unknown', () => {
    const done = makeTask({ status: 'done' })
    const canceled = makeTask({ status: 'canceled' })
    const deleted = makeTask({ status: 'todo', deletedAt: 5 })
    const task = makeTask({ blockedBy: [done.id, canceled.id, deleted.id, 'ghost'] })
    expect(actionable(task, [done, canceled, deleted])).toBe(true)
  })

  it('returns false when only one of several blockers is unresolved', () => {
    const done = makeTask({ status: 'done' })
    const open = makeTask()
    expect(actionable(makeTask({ blockedBy: [done.id, open.id] }), [done, open])).toBe(false)
  })

  it('returns false when the parent is on hold or someday', () => {
    const held = makeTask({ onHold: true })
    const someday = makeTask({ someday: true })
    expect(actionable(makeTask({ parentId: held.id }), [held])).toBe(false)
    expect(actionable(makeTask({ parentId: someday.id }), [someday])).toBe(false)
  })

  it('returns false when a grandparent is on hold', () => {
    const grand = makeTask({ onHold: true })
    const parent = makeTask({ parentId: grand.id })
    expect(actionable(makeTask({ parentId: parent.id }), [grand, parent])).toBe(false)
  })

  it('returns true when the parent is a normal task or missing', () => {
    const parent = makeTask()
    expect(actionable(makeTask({ parentId: parent.id }), [parent])).toBe(true)
    expect(actionable(makeTask({ parentId: 'ghost' }))).toBe(true)
  })

  it('does not loop forever on cyclic parent links', () => {
    const a = makeTask({ id: 'cyc-a', parentId: 'cyc-b' })
    const b = makeTask({ id: 'cyc-b', parentId: 'cyc-a' })
    expect(isActionable(a, ctxOf([a, b]))).toBe(true)
  })
})

describe('isHiddenUntilStart', () => {
  it('is true only when the start date is after today', () => {
    expect(isHiddenUntilStart(makeTask({ startDate: '2026-03-11' }), TODAY)).toBe(true)
    expect(isHiddenUntilStart(makeTask({ startDate: TODAY }), TODAY)).toBe(false)
    expect(isHiddenUntilStart(makeTask({ startDate: '2026-03-09' }), TODAY)).toBe(false)
    expect(isHiddenUntilStart(makeTask(), TODAY)).toBe(false)
  })
})

describe('makeActionableChecker', () => {
  it('agrees with isActionable for every task, including blockers, parked ancestors and cycles', () => {
    const blocker = makeTask({ id: 'blocker' })
    const parked = makeTask({ id: 'parked', someday: true })
    const tasks = [
      blocker,
      parked,
      makeTask({ id: 'blocked', blockedBy: ['blocker'] }),
      makeTask({ id: 'under-parked', parentId: 'parked' }),
      makeTask({ id: 'future', startDate: '2026-03-11' }),
      makeTask({ id: 'done', status: 'done' }),
      makeTask({ id: 'cyc-a', parentId: 'cyc-b' }),
      makeTask({ id: 'cyc-b', parentId: 'cyc-a' }),
      makeTask({ id: 'orphan', parentId: 'ghost', blockedBy: ['ghost'] }),
    ]
    const ctx = ctxOf(tasks)

    const check = makeActionableChecker(ctx)

    for (const task of tasks) expect(check(task)).toBe(isActionable(task, ctx))
    expect(tasks.filter(check).map((t) => t.id)).toEqual(['blocker', 'cyc-a', 'cyc-b', 'orphan'])
  })

  it('returns a checker that rejects everything when the task list is empty', () => {
    const check = makeActionableChecker(ctxOf([]))

    expect(check(makeTask({ status: 'done' }))).toBe(false)
    expect(check(makeTask())).toBe(true)
  })

  it('uses the snapshot taken when the checker was made', () => {
    const blocker = makeTask({ id: 'b1' })
    const child = makeTask({ id: 'c1', blockedBy: ['b1'] })
    const tasks = [blocker, child]
    const check = makeActionableChecker(ctxOf(tasks))

    tasks[0] = { ...blocker, status: 'done' }

    expect(check(child)).toBe(false)
  })
})
