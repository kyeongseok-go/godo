import { describe, expect, it } from 'vitest'
import { makeTask } from '../../test/factories'
import type { EngineContext, Task } from '../types'
import { reviewCandidates } from './review'

const TODAY = '2026-03-10'
const NOW = new Date(2026, 2, 10, 9, 0)
const DAY_MS = 86_400_000
const OPTS = { staleDays: 14, postponeThreshold: 3 }

function ctxOf(tasks: Task[]): EngineContext {
  return { today: TODAY, now: NOW, weekStartsOn: 1, projects: [], sections: [], labels: [], tasks }
}

const ago = (days: number): number => NOW.getTime() - days * DAY_MS
const fresh = (overrides: Partial<Task> = {}): Task => makeTask({ updatedAt: NOW.getTime(), ...overrides })

describe('reviewCandidates', () => {
  it('flags undated open tasks untouched for staleDays or more', () => {
    const stale = makeTask({ updatedAt: ago(14) })
    const recent = makeTask({ updatedAt: ago(13) })
    const dated = makeTask({ updatedAt: ago(30), startDate: '2026-03-20' })
    const items = reviewCandidates(ctxOf([stale, recent, dated]), OPTS)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ reason: 'stale' })
    expect(items[0].task.id).toBe(stale.id)
    expect(items[0].detail).toContain('14')
  })

  it('flags tasks postponed at least postponeThreshold times', () => {
    const items = reviewCandidates(
      ctxOf([fresh({ postponeCount: 3, startDate: '2026-03-12' }), fresh({ postponeCount: 2 })]),
      OPTS,
    )
    expect(items).toHaveLength(1)
    expect(items[0].reason).toBe('postponed')
    expect(items[0].detail).toContain('3')
  })

  it('flags tasks whose due date has passed', () => {
    const items = reviewCandidates(ctxOf([fresh({ dueDate: '2026-03-07' }), fresh({ dueDate: TODAY })]), OPTS)
    expect(items).toHaveLength(1)
    expect(items[0].reason).toBe('overdueDeadline')
    expect(items[0].detail).toContain('3')
  })

  it('reports only the highest-priority reason per task', () => {
    const all = makeTask({ updatedAt: ago(40), postponeCount: 9, dueDate: '2026-03-01' })
    const postponedStale = makeTask({ updatedAt: ago(40), postponeCount: 9 })
    const items = reviewCandidates(ctxOf([all, postponedStale]), OPTS)
    expect(items.map((i) => i.reason)).toEqual(['overdueDeadline', 'postponed'])
  })

  it('flags a parent whose open subtasks have no actionable one', () => {
    const parent = fresh()
    const blocker = fresh({ parentId: 'elsewhere' })
    const stuck = fresh({ parentId: parent.id, blockedBy: [blocker.id] })
    const items = reviewCandidates(ctxOf([parent, stuck, blocker]), OPTS)
    expect(items.map((i) => [i.task.id, i.reason])).toEqual([[parent.id, 'noNextAction']])
  })

  it('does not flag a parent that has an actionable subtask, no subtasks, or only finished ones', () => {
    const withNext = fresh()
    const nextChild = fresh({ parentId: withNext.id })
    const lone = fresh()
    const allDone = fresh()
    const doneChild = fresh({ parentId: allDone.id, status: 'done' })
    expect(reviewCandidates(ctxOf([withNext, nextChild, lone, allDone, doneChild]), OPTS)).toEqual([])
  })

  it('ignores finished, deleted, on-hold and someday tasks', () => {
    const old = { updatedAt: ago(90), dueDate: '2026-01-01', postponeCount: 9 }
    const tasks = [
      makeTask({ ...old, status: 'done' }),
      makeTask({ ...old, status: 'canceled' }),
      makeTask({ ...old, deletedAt: 1 }),
      makeTask({ ...old, onHold: true }),
      makeTask({ ...old, someday: true }),
    ]
    expect(reviewCandidates(ctxOf(tasks), OPTS)).toEqual([])
  })

  it('returns an empty list for no tasks', () => {
    expect(reviewCandidates(ctxOf([]), OPTS)).toEqual([])
  })
})
