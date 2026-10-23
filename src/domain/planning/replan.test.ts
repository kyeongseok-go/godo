import { describe, expect, it } from 'vitest'
import { makeTask } from '../../test/factories'
import { INBOX_ID } from '../types'
import type { EngineContext, Task } from '../types'
import { applyReplanDecision, replanCandidates, shouldSuggestArchive } from './replan'

const TODAY = '2026-03-10'
const NOW = 1_800_000_000_000

function ctxOf(tasks: Task[]): EngineContext {
  return { today: TODAY, now: new Date(2026, 2, 10, 9, 0), weekStartsOn: 1, projects: [], sections: [], labels: [], tasks }
}

describe('replanCandidates', () => {
  it('returns open tasks with a past start date, oldest first', () => {
    const newer = makeTask({ startDate: '2026-03-09' })
    const older = makeTask({ startDate: '2026-02-20' })
    const child = makeTask({ startDate: '2026-03-05', parentId: newer.id })
    const recurring = makeTask({
      startDate: '2026-03-01',
      recurrence: { freq: 'daily', interval: 1, anchor: 'due', end: { type: 'never' }, resetSubtasks: false },
    })
    const result = replanCandidates(ctxOf([newer, older, child, recurring]))
    expect(result.map((t) => t.id)).toEqual([older.id, recurring.id, child.id, newer.id])
  })

  it('excludes today, future, undated, finished, deleted, held and someday tasks', () => {
    const tasks = [
      makeTask({ startDate: TODAY }),
      makeTask({ startDate: '2026-03-11' }),
      makeTask({ dueDate: '2026-03-01' }),
      makeTask({ startDate: '2026-03-01', status: 'done' }),
      makeTask({ startDate: '2026-03-01', status: 'canceled' }),
      makeTask({ startDate: '2026-03-01', deletedAt: 1 }),
      makeTask({ startDate: '2026-03-01', onHold: true }),
      makeTask({ startDate: '2026-03-01', someday: true }),
    ]
    expect(replanCandidates(ctxOf(tasks))).toEqual([])
  })

  it('breaks ties on the same date by pinned, priority, order', () => {
    const low = makeTask({ startDate: '2026-03-01', priority: 4 })
    const high = makeTask({ startDate: '2026-03-01', priority: 1 })
    const pinned = makeTask({ startDate: '2026-03-01', priority: 4, pinned: true })
    const ids = replanCandidates(ctxOf([low, high, pinned])).map((t) => t.id)
    expect(ids).toEqual([pinned.id, high.id, low.id])
  })
})

describe('applyReplanDecision', () => {
  const base = makeTask({
    startDate: '2026-03-05',
    startTime: '14:00',
    dayPart: 'afternoon',
    projectId: 'work',
    sectionId: 'sec1',
    postponeCount: 2,
    updatedAt: 1,
  })

  it('reschedule moves the start date, keeps the time and bumps the postpone count', () => {
    const next = applyReplanDecision(base, { type: 'reschedule', date: '2026-03-12' }, NOW)
    expect(next).toMatchObject({
      startDate: '2026-03-12',
      startTime: '14:00',
      dayPart: 'afternoon',
      postponeCount: 3,
      updatedAt: NOW,
    })
  })

  it('inbox clears scheduling and moves the task to the inbox', () => {
    const next = applyReplanDecision(base, { type: 'inbox' }, NOW)
    expect(next).toMatchObject({
      startDate: null,
      startTime: null,
      dayPart: null,
      projectId: INBOX_ID,
      sectionId: null,
      postponeCount: 2,
    })
  })

  it('done marks the task finished at the given time', () => {
    expect(applyReplanDecision(base, { type: 'done' }, NOW)).toMatchObject({
      status: 'done',
      completedAt: NOW,
    })
  })

  it('delete moves the task to the trash', () => {
    expect(applyReplanDecision(base, { type: 'delete' }, NOW).deletedAt).toBe(NOW)
  })

  it('someday parks the task without a date', () => {
    expect(applyReplanDecision(base, { type: 'someday' }, NOW)).toMatchObject({
      someday: true,
      startDate: null,
      startTime: null,
      dayPart: null,
    })
  })

  it('never mutates the original task', () => {
    const frozen = Object.freeze({ ...base })
    const decisions = [
      { type: 'reschedule', date: '2026-03-12' },
      { type: 'inbox' },
      { type: 'done' },
      { type: 'delete' },
      { type: 'someday' },
    ] as const
    for (const decision of decisions) {
      const next = applyReplanDecision(frozen, decision, NOW)
      expect(next).not.toBe(frozen)
    }
    expect(frozen.startDate).toBe('2026-03-05')
  })
})

describe('shouldSuggestArchive', () => {
  it('is true once the start date is archiveDays or more in the past', () => {
    const task = makeTask({ startDate: '2026-03-01' })
    expect(shouldSuggestArchive(task, TODAY, 9)).toBe(true)
    expect(shouldSuggestArchive(task, TODAY, 10)).toBe(false)
  })

  it('is true when the task was postponed five times or more', () => {
    expect(shouldSuggestArchive(makeTask({ postponeCount: 5 }), TODAY, 30)).toBe(true)
    expect(shouldSuggestArchive(makeTask({ postponeCount: 4 }), TODAY, 30)).toBe(false)
  })

  it('is false for finished tasks and for undated ones', () => {
    expect(shouldSuggestArchive(makeTask({ postponeCount: 9, status: 'done' }), TODAY, 30)).toBe(false)
    expect(shouldSuggestArchive(makeTask({ postponeCount: 9, deletedAt: 1 }), TODAY, 30)).toBe(false)
    expect(shouldSuggestArchive(makeTask(), TODAY, 1)).toBe(false)
  })

  it('treats archiveDays of zero or less as disabled', () => {
    expect(shouldSuggestArchive(makeTask({ startDate: '2026-01-01' }), TODAY, 0)).toBe(false)
  })

  it('works across a year boundary', () => {
    expect(shouldSuggestArchive(makeTask({ startDate: '2025-12-31' }), '2026-01-05', 5)).toBe(true)
    expect(shouldSuggestArchive(makeTask({ startDate: '2025-12-31' }), '2026-01-05', 6)).toBe(false)
  })
})
