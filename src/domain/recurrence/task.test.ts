import { makeTask } from '../../test/factories'
import type { RecurrenceRule, Task } from '../types'
import { advanceRecurringTask, skipOccurrence } from './task'

const rule = (o: Partial<RecurrenceRule> = {}): RecurrenceRule => ({
  freq: 'daily',
  interval: 1,
  anchor: 'due',
  end: { type: 'never' },
  resetSubtasks: false,
  ...o,
})

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

const NOW = new Date(2026, 9, 23, 12, 0).getTime() // 2026-10-23 12:00 (local)

const doneTask = (o: Partial<Task> = {}): Task =>
  makeTask({
    id: 't-rec',
    startDate: '2026-10-23',
    status: 'done',
    completedAt: 1,
    postponeCount: 3,
    recurrence: rule(),
    ...o,
  })

describe('advanceRecurringTask', () => {
  test('moves startDate to the next occurrence and keeps the same id', () => {
    const next = advanceRecurringTask(doneTask(), '2026-10-23', NOW)
    expect(next?.id).toBe('t-rec')
    expect(next?.startDate).toBe('2026-10-24')
  })

  test('increments doneCount and resets status, postponeCount and completedAt', () => {
    const next = advanceRecurringTask(doneTask({ recurrence: rule({ doneCount: 2 }) }), '2026-10-23', NOW)
    expect(next?.recurrence?.doneCount).toBe(3)
    expect(next?.status).toBe('todo')
    expect(next?.postponeCount).toBe(0)
    expect(next?.completedAt).toBeNull()
    expect(next?.updatedAt).toBe(NOW)
  })

  test('treats a missing doneCount as zero', () => {
    expect(advanceRecurringTask(doneTask(), '2026-10-23', NOW)?.recurrence?.doneCount).toBe(1)
  })

  test('shifts dueDate by the same number of days as startDate', () => {
    const next = advanceRecurringTask(
      doneTask({ recurrence: rule({ freq: 'weekly' }), dueDate: '2026-10-25' }),
      '2026-10-23',
      NOW,
    )
    expect(next?.startDate).toBe('2026-10-30')
    expect(next?.dueDate).toBe('2026-11-01')
  })

  test('leaves a missing dueDate empty', () => {
    expect(advanceRecurringTask(doneTask(), '2026-10-23', NOW)?.dueDate).toBeNull()
  })

  test('uses dueDate as the base date when startDate is missing', () => {
    const next = advanceRecurringTask(doneTask({ startDate: null, dueDate: '2026-10-20' }), '2026-10-20', NOW)
    expect(next?.startDate).toBe('2026-10-21')
    expect(next?.dueDate).toBe('2026-10-21')
  })

  test('uses completedOn as the base date when the task has no dates', () => {
    const next = advanceRecurringTask(doneTask({ startDate: null }), '2026-10-23', NOW)
    expect(next?.startDate).toBe('2026-10-24')
    expect(next?.dueDate).toBeNull()
  })

  test('computes from completedOn when the anchor is completion', () => {
    const next = advanceRecurringTask(
      doneTask({ recurrence: rule({ anchor: 'completion', interval: 3 }), dueDate: '2026-10-24' }),
      '2026-10-27',
      NOW,
    )
    expect(next?.startDate).toBe('2026-10-30')
    expect(next?.dueDate).toBe('2026-10-31')
  })

  test('jumps an overdue daily task to the day after completion and moves dueDate along', () => {
    const next = advanceRecurringTask(
      doneTask({ startDate: '2026-10-01', dueDate: '2026-10-02' }),
      '2026-10-23',
      NOW,
    )
    expect(next?.startDate).toBe('2026-10-24')
    expect(next?.dueDate).toBe('2026-10-25')
  })

  test('returns null when the series has ended by date', () => {
    const t = doneTask({ recurrence: rule({ end: { type: 'until', date: '2026-10-23' } }) })
    expect(advanceRecurringTask(t, '2026-10-23', NOW)).toBeNull()
  })

  test('returns null when this completion reaches the count', () => {
    const t = doneTask({ recurrence: rule({ end: { type: 'count', count: 3 }, doneCount: 2 }) })
    expect(advanceRecurringTask(t, '2026-10-23', NOW)).toBeNull()
  })

  test('returns null for a task without a recurrence', () => {
    expect(advanceRecurringTask(doneTask({ recurrence: null }), '2026-10-23', NOW)).toBeNull()
  })

  test('keeps skipDates and the other rule fields', () => {
    const t = doneTask({ recurrence: rule({ skipDates: ['2026-10-30'], resetSubtasks: true }) })
    const next = advanceRecurringTask(t, '2026-10-23', NOW)
    expect(next?.recurrence?.skipDates).toEqual(['2026-10-30'])
    expect(next?.recurrence?.resetSubtasks).toBe(true)
  })

  test('does not mutate the input task', () => {
    const t = deepFreeze(doneTask({ dueDate: '2026-10-25', recurrence: rule({ skipDates: ['2026-11-01'] }) }))
    expect(() => advanceRecurringTask(t, '2026-10-23', NOW)).not.toThrow()
    expect(t.startDate).toBe('2026-10-23')
    expect(t.recurrence?.doneCount).toBeUndefined()
  })
})

describe('skipOccurrence', () => {
  const openTask = (o: Partial<Task> = {}): Task =>
    makeTask({ id: 't-skip', startDate: '2026-10-23', postponeCount: 2, recurrence: rule(), ...o })

  test('moves to the next occurrence and records the skipped date', () => {
    const next = skipOccurrence(openTask(), NOW)
    expect(next?.id).toBe('t-skip')
    expect(next?.startDate).toBe('2026-10-24')
    expect(next?.recurrence?.skipDates).toEqual(['2026-10-23'])
    expect(next?.updatedAt).toBe(NOW)
  })

  test('does not raise doneCount', () => {
    expect(skipOccurrence(openTask({ recurrence: rule({ doneCount: 2 }) }), NOW)?.recurrence?.doneCount).toBe(2)
    expect(skipOccurrence(openTask(), NOW)?.recurrence?.doneCount).toBeUndefined()
  })

  test('appends to existing skipDates without duplicating', () => {
    const t = openTask({ recurrence: rule({ skipDates: ['2026-10-23', '2026-09-01'] }) })
    expect(skipOccurrence(t, NOW)?.recurrence?.skipDates).toEqual(['2026-10-23', '2026-09-01'])
    const u = openTask({ recurrence: rule({ skipDates: ['2026-09-01'] }) })
    expect(skipOccurrence(u, NOW)?.recurrence?.skipDates).toEqual(['2026-09-01', '2026-10-23'])
  })

  test('shifts dueDate by the same number of days', () => {
    const next = skipOccurrence(openTask({ recurrence: rule({ freq: 'weekly' }), dueDate: '2026-10-24' }), NOW)
    expect(next?.startDate).toBe('2026-10-30')
    expect(next?.dueDate).toBe('2026-10-31')
  })

  test('resets postponeCount and keeps the task open', () => {
    const next = skipOccurrence(openTask(), NOW)
    expect(next?.postponeCount).toBe(0)
    expect(next?.status).toBe('todo')
    expect(next?.completedAt).toBeNull()
  })

  test('steps from the current date even when the anchor is completion', () => {
    const t = openTask({ recurrence: rule({ anchor: 'completion', interval: 3 }) })
    expect(skipOccurrence(t, NOW)?.startDate).toBe('2026-10-26')
  })

  test('falls back to dueDate and then to the date of nowMs', () => {
    expect(skipOccurrence(openTask({ startDate: null, dueDate: '2026-10-20' }), NOW)?.startDate).toBe('2026-10-21')
    const next = skipOccurrence(openTask({ startDate: null }), NOW)
    expect(next?.startDate).toBe('2026-10-24')
    expect(next?.recurrence?.skipDates).toEqual(['2026-10-23'])
  })

  test('returns null when the series has ended by date', () => {
    const t = openTask({ recurrence: rule({ end: { type: 'until', date: '2026-10-23' } }) })
    expect(skipOccurrence(t, NOW)).toBeNull()
  })

  test('returns null when the count is already reached, and continues while it is not', () => {
    const done = openTask({ recurrence: rule({ end: { type: 'count', count: 3 }, doneCount: 3 }) })
    expect(skipOccurrence(done, NOW)).toBeNull()
    const open = openTask({ recurrence: rule({ end: { type: 'count', count: 3 }, doneCount: 2 }) })
    expect(skipOccurrence(open, NOW)?.startDate).toBe('2026-10-24')
  })

  test('returns null for a task without a recurrence', () => {
    expect(skipOccurrence(openTask({ recurrence: null }), NOW)).toBeNull()
  })

  test('does not mutate the input task', () => {
    const t = deepFreeze(openTask({ dueDate: '2026-10-25', recurrence: rule({ skipDates: ['2026-09-01'] }) }))
    expect(() => skipOccurrence(t, NOW)).not.toThrow()
    expect(t.recurrence?.skipDates).toEqual(['2026-09-01'])
  })
})

describe('advanceRecurringTask - 기준 일 고정', () => {
  test('매월 반복을 여러 번 완료해도 31일이 28일로 굳지 않는다', () => {
    let task = makeTask({
      startDate: '2026-01-31',
      recurrence: { freq: 'monthly', interval: 1, anchor: 'due', end: { type: 'never' }, resetSubtasks: false },
    })
    const dates: string[] = []
    for (let i = 0; i < 4; i++) {
      const next = advanceRecurringTask(task, task.startDate as string, NOW)
      expect(next).not.toBeNull()
      task = next as typeof task
      dates.push(task.startDate as string)
    }

    expect(dates).toEqual(['2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31'])
  })

  test('매년 반복을 여러 번 완료해도 2월 29일로 돌아온다', () => {
    let task = makeTask({
      startDate: '2024-02-29',
      recurrence: { freq: 'yearly', interval: 1, anchor: 'due', end: { type: 'never' }, resetSubtasks: false },
    })
    const dates: string[] = []
    for (let i = 0; i < 4; i++) {
      const next = advanceRecurringTask(task, task.startDate as string, NOW)
      task = next as typeof task
      dates.push(task.startDate as string)
    }

    expect(dates).toEqual(['2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29'])
  })
})
