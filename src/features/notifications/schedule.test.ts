import { makeTask } from '../../test/factories'
import type { Reminder, Task } from '../../domain/types'
import { baseKey, dueReminders, isReminderEligible, isReminderLive, reminderEntries, reminderTimes } from './schedule'

const MIN = 60_000
const HOUR = 60 * MIN

/** 로컬 시각 기준 epoch ms. 테스트가 실행 환경의 시간대와 무관하도록 로컬 생성자를 쓴다. */
const local = (date: string, time = '00:00'): number => {
  const [y, m, d] = date.split('-').map(Number)
  const [h, min] = time.split(':').map(Number)
  return new Date(y, m - 1, d, h, min).getTime()
}

const rel = (id: string, offsetMin: number): Reminder => ({ id, kind: 'relative', offsetMin })
const abs = (id: string, at: number): Reminder => ({ id, kind: 'absolute', at })

const withReminder = (overrides: Partial<Task> = {}): Task =>
  makeTask({
    id: 't1',
    title: '보고서 제출',
    startDate: '2026-10-24',
    startTime: '15:00',
    reminders: [rel('r1', 0)],
    ...overrides,
  })

describe('reminderTimes', () => {
  test('returns the start time for an on-time relative reminder', () => {
    expect(reminderTimes(withReminder(), {})).toEqual([local('2026-10-24', '15:00')])
  })

  test('moves a relative reminder earlier by its offset', () => {
    const task = withReminder({ reminders: [rel('a', 5), rel('b', 60), rel('c', 1440)] })

    expect(reminderTimes(task, {})).toEqual([
      local('2026-10-24', '14:55'),
      local('2026-10-24', '14:00'),
      local('2026-10-23', '15:00'),
    ])
  })

  test('uses an absolute reminder time as is', () => {
    const at = local('2026-10-24', '08:10')

    expect(reminderTimes(withReminder({ reminders: [abs('a', at)] }), {})).toEqual([at])
  })

  test('falls back to the default work start when only a date is set', () => {
    const task = withReminder({ startTime: null })

    expect(reminderTimes(task, {})).toEqual([local('2026-10-24', '09:00')])
  })

  test('uses the configured work start for date-only tasks', () => {
    const task = withReminder({ startTime: null, reminders: [rel('a', 30)] })

    expect(reminderTimes(task, { workStart: '08:30' })).toEqual([local('2026-10-24', '08:00')])
  })

  test('returns nothing when the task has no start date', () => {
    const task = withReminder({ startDate: null, reminders: [rel('a', 0), abs('b', local('2026-10-24', '08:00'))] })

    expect(reminderTimes(task, {})).toEqual([])
  })

  test('crosses midnight backwards for an early-morning task', () => {
    const task = withReminder({ startTime: '00:10', reminders: [rel('a', 30)] })

    expect(reminderTimes(task, {})).toEqual([local('2026-10-23', '23:40')])
  })

  test('ignores reminders with unusable values', () => {
    const task = withReminder({
      startTime: '25:99',
      reminders: [rel('a', Number.NaN), abs('b', Number.POSITIVE_INFINITY)],
    })

    expect(reminderTimes(task, {})).toEqual([])
  })

  test('returns nothing for a malformed start date', () => {
    expect(reminderTimes(withReminder({ startDate: '내일' }), {})).toEqual([])
  })

  test.each([
    ['completed', { status: 'done' }],
    ['canceled', { status: 'canceled' }],
    ['deleted', { deletedAt: 1 }],
    ['on hold', { onHold: true }],
    ['someday', { someday: true }],
  ] as const)('excludes %s tasks', (_label, patch) => {
    expect(reminderTimes(withReminder(patch), {})).toEqual([])
  })

  test('does not mutate the task', () => {
    const task = withReminder()
    const copy = structuredClone(task)

    reminderTimes(task, {})

    expect(task).toEqual(copy)
  })
})

describe('isReminderEligible', () => {
  test('accepts an open task and rejects a finished one', () => {
    expect(isReminderEligible(makeTask())).toBe(true)
    expect(isReminderEligible(makeTask({ status: 'done' }))).toBe(false)
  })
})

describe('isReminderLive', () => {
  const task = withReminder()

  test('is true for an open task on the same occurrence', () => {
    expect(isReminderLive(task, 't1|r1|2026-10-24|2')).toBe(true)
  })

  test('is false when the task is gone, finished, or moved to another occurrence', () => {
    expect(isReminderLive(undefined, 't1|r1|2026-10-24')).toBe(false)
    expect(isReminderLive({ ...task, status: 'done' }, 't1|r1|2026-10-24')).toBe(false)
    expect(isReminderLive({ ...task, startDate: '2026-10-25' }, 't1|r1|2026-10-24')).toBe(false)
  })
})

describe('reminderEntries / baseKey', () => {
  test('builds a key from task, reminder and occurrence date, not the fire date', () => {
    const task = withReminder({ startTime: '00:10', reminders: [rel('r9', 30)] })

    const [entry] = reminderEntries(task, {})

    expect(entry.key).toBe('t1|r9|2026-10-24')
    expect(entry.at).toBe(local('2026-10-23', '23:40'))
  })

  test('baseKey strips snooze and round suffixes', () => {
    expect(baseKey('t1|r1|2026-10-24')).toBe('t1|r1|2026-10-24')
    expect(baseKey('t1|r1|2026-10-24|3')).toBe('t1|r1|2026-10-24')
    expect(baseKey('t1|r1|2026-10-24|z999|2')).toBe('t1|r1|2026-10-24')
  })
})

describe('dueReminders', () => {
  const task = withReminder()
  const fireAt = local('2026-10-24', '15:00')
  const base = { fired: new Set<string>() }

  test('returns a reminder whose time falls in (lastCheck, now]', () => {
    const due = dueReminders([task], { ...base, lastCheck: fireAt - MIN, now: fireAt + 10_000 })

    expect(due).toHaveLength(1)
    expect(due[0]).toMatchObject({ key: 't1|r1|2026-10-24', taskId: 't1', title: '보고서 제출', at: fireAt })
    expect(due[0].body).toBe('15:00 시작')
  })

  test('does not return a reminder that is still in the future', () => {
    expect(dueReminders([task], { ...base, lastCheck: fireAt - HOUR, now: fireAt - MIN })).toEqual([])
  })

  test('treats lastCheck as exclusive and now as inclusive', () => {
    expect(dueReminders([task], { ...base, lastCheck: fireAt, now: fireAt + MIN })).toEqual([])
    expect(dueReminders([task], { ...base, lastCheck: fireAt - MIN, now: fireAt })).toHaveLength(1)
  })

  test('includes a reminder missed while the app was closed, within 24 hours', () => {
    const due = dueReminders([task], { ...base, lastCheck: fireAt - 2 * HOUR, now: fireAt + 20 * HOUR })

    expect(due.map((d) => d.key)).toEqual(['t1|r1|2026-10-24'])
  })

  test('drops a missed reminder older than 24 hours', () => {
    expect(dueReminders([task], { ...base, lastCheck: 0, now: fireAt + 24 * HOUR + MIN })).toEqual([])
  })

  test('skips reminders already recorded as fired', () => {
    const fired = new Set(['t1|r1|2026-10-24'])

    expect(dueReminders([task], { fired, lastCheck: fireAt - MIN, now: fireAt + MIN })).toEqual([])
  })

  test('reports several reminders of one task in time order', () => {
    const multi = withReminder({ reminders: [rel('r1', 0), rel('r2', 30)] })

    const due = dueReminders([multi], { ...base, lastCheck: 0, now: fireAt + MIN })

    expect(due.map((d) => d.key)).toEqual(['t1|r2|2026-10-24', 't1|r1|2026-10-24'])
    expect(due[0].body).toBe('15:00 시작 · 30분 전')
  })

  test('formats the body with the 12-hour clock when asked', () => {
    const due = dueReminders([task], { ...base, lastCheck: 0, now: fireAt, timeFormat: '12h' })

    expect(due[0].body).toBe('오후 3:00 시작')
  })

  test('describes date-only tasks by date', () => {
    const dateOnly = withReminder({ startTime: null })

    const due = dueReminders([dateOnly], { ...base, lastCheck: 0, now: local('2026-10-24', '09:30') })

    expect(due[0].body).toBe('10월 24일 할 일')
  })

  test('skips finished tasks', () => {
    const done = withReminder({ status: 'done' })

    expect(dueReminders([done], { ...base, lastCheck: 0, now: fireAt + MIN })).toEqual([])
  })

  test('only follows the current occurrence of a recurring task', () => {
    const daily = withReminder({
      recurrence: { freq: 'daily', interval: 1, anchor: 'due', end: { type: 'never' }, resetSubtasks: false },
    })

    const due = dueReminders([daily], { ...base, lastCheck: 0, now: fireAt + 3 * 24 * HOUR })

    expect(due).toEqual([])
    const today = dueReminders([daily], { ...base, lastCheck: 0, now: fireAt + MIN })
    expect(today.map((d) => d.key)).toEqual(['t1|r1|2026-10-24'])
  })

  test('gives the next occurrence a new key so it can fire again', () => {
    const next = withReminder({ startDate: '2026-10-25' })

    const due = dueReminders([next], { fired: new Set(['t1|r1|2026-10-24']), lastCheck: 0, now: local('2026-10-25', '15:01') })

    expect(due.map((d) => d.key)).toEqual(['t1|r1|2026-10-25'])
  })

  test('catches a reminder that fires before midnight for a task starting after it', () => {
    const early = withReminder({ startTime: '00:10', reminders: [rel('r1', 30)] })
    const fireTime = local('2026-10-23', '23:40')

    const due = dueReminders([early], { ...base, lastCheck: fireTime - MIN, now: local('2026-10-24', '00:00') })

    expect(due.map((d) => d.key)).toEqual(['t1|r1|2026-10-24'])
  })
})

describe('dueReminders with persistent reminders', () => {
  const task = withReminder({ persistentReminder: true })
  const fireAt = local('2026-10-24', '15:00')

  test('fires the first time with the plain key', () => {
    const due = dueReminders([task], { fired: new Set(), lastCheck: fireAt - MIN, now: fireAt })

    expect(due.map((d) => d.key)).toEqual(['t1|r1|2026-10-24'])
  })

  test('repeats every 10 minutes after the first firing', () => {
    const fired = new Set(['t1|r1|2026-10-24'])

    expect(dueReminders([task], { fired, lastCheck: fireAt, now: fireAt + 9 * MIN })).toEqual([])
    const due = dueReminders([task], { fired, lastCheck: fireAt + 9 * MIN, now: fireAt + 10 * MIN })
    expect(due.map((d) => d.key)).toEqual(['t1|r1|2026-10-24|1'])
    expect(due[0].at).toBe(fireAt + 10 * MIN)
    expect(due[0].body).toBe('아직 완료하지 않았어요 · 15:00 시작')
  })

  test('reports only the latest round when many were missed', () => {
    const fired = new Set(['t1|r1|2026-10-24'])

    const due = dueReminders([task], { fired, lastCheck: fireAt + 5 * MIN, now: fireAt + 47 * MIN })

    expect(due.map((d) => d.key)).toEqual(['t1|r1|2026-10-24|4'])
  })

  test('keeps repeating beyond 24 hours until the task is completed', () => {
    const fired = new Set<string>()
    const now = fireAt + 3 * 24 * HOUR + 4 * MIN

    const due = dueReminders([task], { fired, lastCheck: now - MIN, now })

    expect(due).toEqual([])
    const onRound = fireAt + 3 * 24 * HOUR + 10 * MIN
    expect(dueReminders([task], { fired, lastCheck: onRound - MIN, now: onRound })).toHaveLength(1)
  })

  test('stops once the task is done', () => {
    const done = { ...task, status: 'done' as const }

    expect(dueReminders([done], { fired: new Set(), lastCheck: fireAt, now: fireAt + HOUR })).toEqual([])
  })

  test('does not repeat the same round twice', () => {
    const fired = new Set(['t1|r1|2026-10-24', 't1|r1|2026-10-24|1'])

    expect(dueReminders([task], { fired, lastCheck: fireAt, now: fireAt + 12 * MIN })).toEqual([])
  })
})

describe('dueReminders with snooze', () => {
  const task = withReminder()
  const fireAt = local('2026-10-24', '15:00')
  const key = 't1|r1|2026-10-24'
  const fired = new Set([key])

  test('holds the reminder until the snooze time', () => {
    const snoozed = { [key]: fireAt + 10 * MIN }

    expect(dueReminders([task], { fired, snoozed, lastCheck: fireAt, now: fireAt + 9 * MIN })).toEqual([])
  })

  test('fires again under a new key when the snooze time arrives', () => {
    const snoozed = { [key]: fireAt + 10 * MIN }

    const due = dueReminders([task], { fired, snoozed, lastCheck: fireAt + 9 * MIN, now: fireAt + 10 * MIN })

    expect(due).toHaveLength(1)
    expect(due[0].key).toBe(`${key}|z${fireAt + 10 * MIN}`)
    expect(due[0].at).toBe(fireAt + 10 * MIN)
    expect(due[0].body).toBe('미뤄 둔 알림 · 15:00 시작')
  })

  test('does not fire the snoozed reminder twice', () => {
    const until = fireAt + 10 * MIN
    const snoozed = { [key]: until }
    const done = new Set([key, `${key}|z${until}`])

    expect(dueReminders([task], { fired: done, snoozed, lastCheck: until, now: until + HOUR })).toEqual([])
  })

  test('suppresses the original reminder even if it was never fired', () => {
    const snoozed = { [key]: fireAt + HOUR }

    expect(dueReminders([task], { fired: new Set(), snoozed, lastCheck: fireAt - MIN, now: fireAt + MIN })).toEqual([])
  })

  test('ignores snooze entries for reminders that no longer exist', () => {
    const snoozed = { 'gone|r1|2026-10-24': fireAt }

    expect(dueReminders([task], { fired, snoozed, lastCheck: fireAt - MIN, now: fireAt + MIN })).toEqual([])
  })

  test('does not wake a snoozed reminder of a task completed meanwhile', () => {
    const done = { ...task, status: 'done' as const }
    const snoozed = { [key]: fireAt + 10 * MIN }

    expect(dueReminders([done], { fired, snoozed, lastCheck: fireAt, now: fireAt + 11 * MIN })).toEqual([])
  })

  test('restarts the 10-minute repetition from the snooze time for persistent tasks', () => {
    const persistent = withReminder({ persistentReminder: true })
    const until = fireAt + 30 * MIN
    const snoozed = { [key]: until }

    expect(dueReminders([persistent], { fired, snoozed, lastCheck: fireAt, now: fireAt + 25 * MIN })).toEqual([])
    const wake = dueReminders([persistent], { fired, snoozed, lastCheck: until - MIN, now: until })
    expect(wake.map((d) => d.key)).toEqual([`${key}|z${until}`])
    const repeat = dueReminders([persistent], {
      fired: new Set([key, `${key}|z${until}`]),
      snoozed,
      lastCheck: until + 9 * MIN,
      now: until + 10 * MIN,
    })
    expect(repeat.map((d) => d.key)).toEqual([`${key}|z${until}|1`])
  })
})
