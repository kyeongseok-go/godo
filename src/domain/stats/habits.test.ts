import type { Habit } from '../types'
import {
  habitCompletionRate,
  habitStreak,
  habitValue,
  habitWeekProgress,
  isHabitDone,
  isHabitDue,
  setHabitValue,
  toggleHabit,
} from './habits'

// 2026-10-19 월, 10-23 금, 10-24 토, 10-25 일, 10-26 월
let seq = 0
function makeHabit(overrides: Partial<Habit> = {}): Habit {
  seq += 1
  return {
    id: `h${seq}`,
    name: '물 마시기',
    icon: null,
    color: '#2f6f5e',
    frequency: { type: 'daily' },
    goal: { kind: 'check', target: 1, unit: null },
    startDate: '2026-10-01',
    group: null,
    reminderTime: null,
    block: null,
    archived: false,
    logs: {},
    order: 0,
    ...overrides,
  }
}

const logsOf = (...dates: string[]): Record<string, number> =>
  Object.fromEntries(dates.map((d) => [d, 1]))

describe('isHabitDue', () => {
  test('daily habits are due from the start date on', () => {
    const h = makeHabit({ startDate: '2026-10-10' })
    expect(isHabitDue(h, '2026-10-09')).toBe(false)
    expect(isHabitDue(h, '2026-10-10')).toBe(true)
    expect(isHabitDue(h, '2027-03-01')).toBe(true)
  })

  test('archived habits are never due', () => {
    expect(isHabitDue(makeHabit({ archived: true }), '2026-10-23')).toBe(false)
  })

  test('weekday habits are due only on the chosen weekdays', () => {
    const h = makeHabit({ frequency: { type: 'weekdays', days: [1, 3] } })
    expect(isHabitDue(h, '2026-10-19')).toBe(true) // 월
    expect(isHabitDue(h, '2026-10-20')).toBe(false) // 화
    expect(isHabitDue(h, '2026-10-21')).toBe(true) // 수
  })

  test('times-per-week habits are treated as due every day', () => {
    const h = makeHabit({ frequency: { type: 'timesPerWeek', times: 3 } })
    expect(isHabitDue(h, '2026-10-24')).toBe(true)
    expect(isHabitDue(h, '2026-10-25')).toBe(true)
  })
})

describe('habitValue and isHabitDone', () => {
  test('missing logs read as zero', () => {
    expect(habitValue(makeHabit(), '2026-10-23')).toBe(0)
    expect(habitValue(makeHabit({ logs: { '2026-10-23': 3 } }), '2026-10-23')).toBe(3)
  })

  test('a check habit is done at 1', () => {
    const h = makeHabit({ logs: { '2026-10-23': 1 } })
    expect(isHabitDone(h, '2026-10-23')).toBe(true)
    expect(isHabitDone(h, '2026-10-22')).toBe(false)
  })

  test('a count habit is done once the target is reached', () => {
    const goal = { kind: 'count' as const, target: 8, unit: '잔' }
    const h = makeHabit({ goal, logs: { a: 7, b: 8, c: 12 } })
    expect(isHabitDone(h, 'a')).toBe(false)
    expect(isHabitDone(h, 'b')).toBe(true)
    expect(isHabitDone(h, 'c')).toBe(true)
  })

  test('a zero target never counts an empty day as done', () => {
    const h = makeHabit({ goal: { kind: 'count', target: 0, unit: null } })
    expect(isHabitDone(h, '2026-10-23')).toBe(false)
  })
})

describe('toggleHabit', () => {
  test('checks an undone check habit', () => {
    const h = makeHabit()
    const next = toggleHabit(h, '2026-10-23')
    expect(next.logs).toEqual({ '2026-10-23': 1 })
    expect(h.logs).toEqual({})
  })

  test('unchecking removes the log key', () => {
    const h = makeHabit({ logs: { '2026-10-22': 1, '2026-10-23': 1 } })
    const next = toggleHabit(h, '2026-10-23')
    expect(next.logs).toEqual({ '2026-10-22': 1 })
    expect(Object.keys(next.logs)).not.toContain('2026-10-23')
    expect(h.logs['2026-10-23']).toBe(1)
  })

  test('leaves count habits alone (callers use setHabitValue)', () => {
    const h = makeHabit({ goal: { kind: 'count', target: 3, unit: null } })
    expect(toggleHabit(h, '2026-10-23')).toEqual(h)
  })
})

describe('setHabitValue', () => {
  test('stores the value without touching other days or the original', () => {
    const h = makeHabit({ logs: { '2026-10-22': 2 } })
    const next = setHabitValue(h, '2026-10-23', 5)
    expect(next.logs).toEqual({ '2026-10-22': 2, '2026-10-23': 5 })
    expect(h.logs).toEqual({ '2026-10-22': 2 })
  })

  test('removes the key for zero, negative or non-finite values', () => {
    const h = makeHabit({ logs: { '2026-10-23': 5 } })
    expect(setHabitValue(h, '2026-10-23', 0).logs).toEqual({})
    expect(setHabitValue(h, '2026-10-23', -1).logs).toEqual({})
    expect(setHabitValue(h, '2026-10-23', Number.NaN).logs).toEqual({})
    expect(setHabitValue(makeHabit(), '2026-10-23', 0).logs).toEqual({})
  })
})

describe('habitStreak', () => {
  test('counts consecutive done days ending today', () => {
    const h = makeHabit({ logs: logsOf('2026-10-21', '2026-10-22', '2026-10-23') })
    expect(habitStreak(h, '2026-10-23')).toEqual({ current: 3, longest: 3 })
  })

  test('does not break when today is due but not yet done', () => {
    const h = makeHabit({ logs: logsOf('2026-10-21', '2026-10-22') })
    expect(habitStreak(h, '2026-10-23')).toEqual({ current: 2, longest: 2 })
  })

  test('breaks on a missed due day and reports the longest run', () => {
    const h = makeHabit({
      logs: logsOf('2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-22'),
    })
    expect(habitStreak(h, '2026-10-23')).toEqual({ current: 1, longest: 4 })
  })

  test('only looks at due days: off days are skipped', () => {
    // 평일 습관, 오늘은 월요일 10-26. 금·목에 했으면 주말은 건너뛰고 2.
    const h = makeHabit({
      frequency: { type: 'weekdays', days: [1, 2, 3, 4, 5] },
      logs: logsOf('2026-10-22', '2026-10-23'),
    })
    expect(habitStreak(h, '2026-10-26')).toEqual({ current: 2, longest: 2 })
  })

  test('a done mark on a non-due day does not extend the streak', () => {
    const h = makeHabit({
      frequency: { type: 'weekdays', days: [1, 2, 3, 4, 5] },
      logs: logsOf('2026-10-23', '2026-10-24', '2026-10-25'),
    })
    expect(habitStreak(h, '2026-10-26').current).toBe(1)
  })

  test('ignores logs before the start date', () => {
    const h = makeHabit({ startDate: '2026-10-22', logs: logsOf('2026-10-20', '2026-10-21', '2026-10-22') })
    expect(habitStreak(h, '2026-10-23')).toEqual({ current: 1, longest: 1 })
  })

  test('returns zeros before the start date and for archived habits', () => {
    expect(habitStreak(makeHabit({ startDate: '2026-11-01' }), '2026-10-23')).toEqual({
      current: 0,
      longest: 0,
    })
    expect(habitStreak(makeHabit({ archived: true, logs: logsOf('2026-10-23') }), '2026-10-23')).toEqual({
      current: 0,
      longest: 0,
    })
  })

  test('count habits need the target on each day', () => {
    const h = makeHabit({
      goal: { kind: 'count', target: 3, unit: '회' },
      logs: { '2026-10-21': 3, '2026-10-22': 2, '2026-10-23': 4 },
    })
    expect(habitStreak(h, '2026-10-23')).toEqual({ current: 1, longest: 1 })
  })

  test('crosses the year boundary', () => {
    const h = makeHabit({ logs: logsOf('2026-12-31', '2027-01-01') })
    expect(habitStreak(h, '2027-01-01').current).toBe(2)
  })
})

describe('habitCompletionRate', () => {
  test('divides done days by due days inside the range', () => {
    const h = makeHabit({ logs: logsOf('2026-10-19', '2026-10-21', '2026-10-25') })
    expect(habitCompletionRate(h, '2026-10-19', '2026-10-25')).toBeCloseTo(3 / 7, 10)
  })

  test('only counts due days in the denominator', () => {
    const h = makeHabit({
      frequency: { type: 'weekdays', days: [1, 2, 3, 4, 5] },
      logs: logsOf('2026-10-19', '2026-10-20', '2026-10-24'),
    })
    expect(habitCompletionRate(h, '2026-10-19', '2026-10-25')).toBeCloseTo(2 / 5, 10)
  })

  test('returns 0 when nothing was due or the range is reversed', () => {
    const h = makeHabit({ startDate: '2026-12-01', logs: logsOf('2026-10-19') })
    expect(habitCompletionRate(h, '2026-10-19', '2026-10-25')).toBe(0)
    expect(habitCompletionRate(makeHabit(), '2026-10-25', '2026-10-19')).toBe(0)
  })

  test('counts only the days after the start date', () => {
    const h = makeHabit({ startDate: '2026-10-23', logs: logsOf('2026-10-23') })
    expect(habitCompletionRate(h, '2026-10-19', '2026-10-25')).toBeCloseTo(1 / 3, 10)
  })

  test('reaches exactly 1 on a perfect range', () => {
    const h = makeHabit({ logs: logsOf('2026-10-23', '2026-10-24') })
    expect(habitCompletionRate(h, '2026-10-23', '2026-10-24')).toBe(1)
  })
})

describe('habitWeekProgress', () => {
  test('returns seven cells starting at the given date', () => {
    const h = makeHabit({
      frequency: { type: 'weekdays', days: [1, 3, 5] },
      goal: { kind: 'count', target: 2, unit: null },
      logs: { '2026-10-19': 2, '2026-10-20': 1, '2026-10-21': 1 },
    })
    const week = habitWeekProgress(h, '2026-10-19')
    expect(week).toHaveLength(7)
    expect(week.map((c) => c.date)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ])
    expect(week.map((c) => c.due)).toEqual([true, false, true, false, true, false, false])
    expect(week.map((c) => c.done)).toEqual([true, false, false, false, false, false, false])
    expect(week.map((c) => c.value)).toEqual([2, 1, 1, 0, 0, 0, 0])
  })

  test('crosses month boundaries and respects the start date', () => {
    const h = makeHabit({ startDate: '2026-11-01' })
    const week = habitWeekProgress(h, '2026-10-29')
    expect(week.map((c) => c.date)).toEqual([
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
    ])
    expect(week.map((c) => c.due)).toEqual([false, false, false, true, true, true, true])
  })
})
