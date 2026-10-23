import { makeTask } from '../../test/factories'
import type { FocusSession } from '../types'
import { applyFocusToTask, focusSummary } from './focus'

const at = (month: number, day: number, hour = 12, minute = 0): number =>
  new Date(2026, month - 1, day, hour, minute).getTime()

let seq = 0
function makeSession(overrides: Partial<FocusSession> = {}): FocusSession {
  seq += 1
  return {
    id: `f${seq}`,
    taskId: null,
    kind: 'pomodoro',
    startedAt: at(10, 23),
    durationSec: 25 * 60,
    completed: true,
    ...overrides,
  }
}

describe('focusSummary', () => {
  test('returns zeros and empty lists for no sessions', () => {
    expect(focusSummary([], '2026-10-23')).toEqual({
      todayMin: 0,
      todayCount: 0,
      totalMin: 0,
      totalCount: 0,
      byDay: [],
      byTask: [],
    })
  })

  test('counts only completed sessions', () => {
    const sessions = [makeSession(), makeSession({ completed: false, durationSec: 600 })]
    const s = focusSummary(sessions, '2026-10-23')
    expect(s.totalCount).toBe(1)
    expect(s.totalMin).toBe(25)
  })

  test('splits today from the total by local start date', () => {
    const sessions = [
      makeSession({ startedAt: at(10, 23, 9) }),
      makeSession({ startedAt: at(10, 23, 15), durationSec: 15 * 60 }),
      makeSession({ startedAt: at(10, 22, 15) }),
    ]
    const s = focusSummary(sessions, '2026-10-23')
    expect(s.todayCount).toBe(2)
    expect(s.todayMin).toBe(40)
    expect(s.totalCount).toBe(3)
    expect(s.totalMin).toBe(65)
  })

  test('attributes a session that crosses midnight to its start day', () => {
    const late = makeSession({ startedAt: at(10, 22, 23, 50), durationSec: 30 * 60 })
    const s = focusSummary([late], '2026-10-23')
    expect(s.todayMin).toBe(0)
    expect(s.byDay).toEqual([{ date: '2026-10-22', min: 30 }])
  })

  test('byDay is sorted ascending and merges the same day', () => {
    const sessions = [
      makeSession({ startedAt: at(10, 23) }),
      makeSession({ startedAt: at(10, 21) }),
      makeSession({ startedAt: at(10, 23, 18) }),
    ]
    expect(focusSummary(sessions, '2026-10-23').byDay).toEqual([
      { date: '2026-10-21', min: 25 },
      { date: '2026-10-23', min: 50 },
    ])
  })

  test('byTask sums per task, keeps unlinked sessions, and sorts by minutes', () => {
    const sessions = [
      makeSession({ taskId: 'a', durationSec: 10 * 60 }),
      makeSession({ taskId: null, durationSec: 30 * 60 }),
      makeSession({ taskId: 'b', durationSec: 20 * 60 }),
      makeSession({ taskId: 'a', durationSec: 10 * 60 }),
    ]
    expect(focusSummary(sessions, '2026-10-23').byTask).toEqual([
      { taskId: null, min: 30 },
      { taskId: 'a', min: 20 },
      { taskId: 'b', min: 20 },
    ])
  })

  test('rounds each session to whole minutes (30 seconds rounds up)', () => {
    const sessions = [
      makeSession({ durationSec: 89 }), // 1분
      makeSession({ durationSec: 29 }), // 0분이지만 횟수에는 들어간다
      makeSession({ durationSec: 30 }), // 1분
    ]
    const s = focusSummary(sessions, '2026-10-23')
    expect(s.totalMin).toBe(2)
    expect(s.totalCount).toBe(3)
  })

  test('does not mutate the input', () => {
    const sessions = [makeSession({ startedAt: at(10, 23) }), makeSession({ startedAt: at(10, 21) })]
    const snapshot = JSON.stringify(sessions)
    focusSummary(sessions, '2026-10-23')
    expect(JSON.stringify(sessions)).toBe(snapshot)
  })
})

describe('applyFocusToTask', () => {
  test('adds the minutes to the day the session started', () => {
    const task = makeTask({ actualMin: { '2026-10-22': 10 } })
    const next = applyFocusToTask(task, makeSession({ startedAt: at(10, 23), durationSec: 25 * 60 }))
    expect(next.actualMin).toEqual({ '2026-10-22': 10, '2026-10-23': 25 })
  })

  test('accumulates onto an existing day', () => {
    const task = makeTask({ actualMin: { '2026-10-23': 5 } })
    const next = applyFocusToTask(task, makeSession({ durationSec: 25 * 60 }))
    expect(next.actualMin['2026-10-23']).toBe(30)
  })

  test('rounds to the nearest minute', () => {
    const task = makeTask()
    expect(applyFocusToTask(task, makeSession({ durationSec: 89 })).actualMin).toEqual({ '2026-10-23': 1 })
    expect(applyFocusToTask(task, makeSession({ durationSec: 150 })).actualMin).toEqual({ '2026-10-23': 3 })
  })

  test('adds nothing when the session is shorter than half a minute', () => {
    const task = makeTask({ actualMin: { '2026-10-23': 5 } })
    const next = applyFocusToTask(task, makeSession({ durationSec: 29 }))
    expect(next.actualMin).toEqual({ '2026-10-23': 5 })
    expect(applyFocusToTask(makeTask(), makeSession({ durationSec: 0 })).actualMin).toEqual({})
  })

  test('uses the local start day even just after midnight', () => {
    const next = applyFocusToTask(makeTask(), makeSession({ startedAt: at(10, 24, 0, 5), durationSec: 600 }))
    expect(next.actualMin).toEqual({ '2026-10-24': 10 })
  })

  test('does not mutate the original task', () => {
    const task = makeTask({ actualMin: { '2026-10-22': 1 } })
    const next = applyFocusToTask(task, makeSession())
    expect(task.actualMin).toEqual({ '2026-10-22': 1 })
    expect(next).not.toBe(task)
    expect(next.id).toBe(task.id)
  })
})
