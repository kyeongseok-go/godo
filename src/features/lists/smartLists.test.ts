import { INBOX_ID } from '../../domain/types'
import type { EngineContext, Task } from '../../domain/types'
import { makeProject, makeTask } from '../../test/factories'
import { projectOpenCount, smartListCounts, smartListGroups } from './smartLists'

const TODAY = '2026-10-23'
const ctxOf = (tasks: Task[]): EngineContext => ({
  today: TODAY,
  now: new Date(2026, 9, 23, 12),
  weekStartsOn: 1,
  projects: [makeProject({ id: 'p', name: '업무' })],
  sections: [],
  labels: [],
  tasks,
})
const ids = (groups: { tasks: Task[] }[]) => groups.flatMap((g) => g.tasks.map((t) => t.id))

describe('inbox', () => {
  test('lists open inbox tasks only, excluding someday and other projects', () => {
    const tasks = [
      makeTask({ id: 'in', projectId: INBOX_ID }),
      makeTask({ id: 'someday', projectId: INBOX_ID, someday: true }),
      makeTask({ id: 'other', projectId: 'p' }),
      makeTask({ id: 'done', projectId: INBOX_ID, status: 'done' }),
      makeTask({ id: 'trashed', projectId: INBOX_ID, deletedAt: 1 }),
    ]

    expect(ids(smartListGroups('inbox', ctxOf(tasks)))).toEqual(['in'])
  })
})

describe('today', () => {
  test('separates overdue and today, and drops future tasks', () => {
    const tasks = [
      makeTask({ id: 'late', startDate: '2026-10-20' }),
      makeTask({ id: 'now', startDate: TODAY }),
      makeTask({ id: 'future', startDate: '2026-10-30' }),
    ]

    const groups = smartListGroups('today', ctxOf(tasks))

    expect(groups.find((g) => g.key === 'overdue')?.tasks.map((t) => t.id)).toEqual(['late'])
    expect(ids(groups)).toContain('now')
    expect(ids(groups)).not.toContain('future')
  })

  test('puts timed tasks in their own group sorted by time', () => {
    const tasks = [
      makeTask({ id: 'late', startDate: TODAY, startTime: '15:00' }),
      makeTask({ id: 'early', startDate: TODAY, startTime: '09:00' }),
    ]

    const timed = smartListGroups('today', ctxOf(tasks)).find((g) => g.key === 'timed')

    expect(timed?.tasks.map((t) => t.id)).toEqual(['early', 'late'])
  })
})

describe('upcoming', () => {
  test('groups the next 7 days by date, excluding today and further out', () => {
    const tasks = [
      makeTask({ id: 'tomorrow', startDate: '2026-10-24' }),
      makeTask({ id: 'week', startDate: '2026-10-30' }),
      makeTask({ id: 'today', startDate: TODAY }),
      makeTask({ id: 'far', startDate: '2026-11-15' }),
    ]

    const groups = smartListGroups('upcoming', ctxOf(tasks))

    expect(groups.map((g) => g.key)).toEqual(['2026-10-24', '2026-10-30'])
    expect(groups[0].title).toBe('내일')
  })

  test('a deadline-only task shows on its deadline', () => {
    const groups = smartListGroups('upcoming', ctxOf([makeTask({ id: 'd', dueDate: '2026-10-26' })]))

    expect(ids(groups)).toEqual(['d'])
  })
})

describe('now (actionable)', () => {
  test('excludes future, held, someday, and blocked tasks', () => {
    const blocker = makeTask({ id: 'blocker' })
    const tasks = [
      blocker,
      makeTask({ id: 'ready' }),
      makeTask({ id: 'future', startDate: '2026-11-01' }),
      makeTask({ id: 'held', onHold: true }),
      makeTask({ id: 'someday', someday: true }),
      makeTask({ id: 'blocked', blockedBy: ['blocker'] }),
    ]

    const result = ids(smartListGroups('now', ctxOf(tasks)))

    expect(result.sort()).toEqual(['blocker', 'ready'])
  })

  test('a task becomes actionable once its blocker is done', () => {
    const tasks = [makeTask({ id: 'blocker', status: 'done' }), makeTask({ id: 'next', blockedBy: ['blocker'] })]

    expect(ids(smartListGroups('now', ctxOf(tasks)))).toEqual(['next'])
  })
})

describe('completed, canceled, trash', () => {
  test('completed groups by completion day, newest first', () => {
    const day = (d: number) => new Date(2026, 9, d, 12).getTime()
    const tasks = [
      makeTask({ id: 'old', status: 'done', completedAt: day(20) }),
      makeTask({ id: 'new', status: 'done', completedAt: day(22) }),
    ]

    const groups = smartListGroups('completed', ctxOf(tasks))

    expect(groups.map((g) => g.key)).toEqual(['2026-10-22', '2026-10-20'])
  })

  test('trash shows only the top of a deleted subtree', () => {
    const tasks = [
      makeTask({ id: 'p', deletedAt: 5 }),
      makeTask({ id: 'c', parentId: 'p', deletedAt: 5 }),
      makeTask({ id: 'live' }),
    ]

    expect(ids(smartListGroups('trash', ctxOf(tasks)))).toEqual(['p'])
  })

  test('canceled lists canceled tasks that are not deleted', () => {
    const tasks = [makeTask({ id: 'c', status: 'canceled' }), makeTask({ id: 'd', status: 'canceled', deletedAt: 1 })]

    expect(ids(smartListGroups('canceled', ctxOf(tasks)))).toEqual(['c'])
  })
})

describe('counts', () => {
  test('smartListCounts matches what each list shows', () => {
    const tasks = [
      makeTask({ projectId: INBOX_ID }),
      makeTask({ startDate: TODAY, projectId: 'p' }),
      makeTask({ startDate: '2026-10-25', projectId: 'p' }),
    ]

    expect(smartListCounts(ctxOf(tasks))).toEqual({ inbox: 1, today: 1, upcoming: 1, now: 2 })
  })

  test('projectOpenCount counts open tasks of one project', () => {
    const tasks = [makeTask({ projectId: 'p' }), makeTask({ projectId: 'p', status: 'done' }), makeTask({ projectId: 'q' })]

    expect(projectOpenCount(ctxOf(tasks), 'p')).toBe(1)
  })
})
