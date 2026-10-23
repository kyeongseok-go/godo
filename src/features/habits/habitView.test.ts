import type { Habit } from '../../domain/types'
import {
  cellLabel,
  describeFrequency,
  formatProgress,
  formatWeekRange,
  groupHabits,
  habitMeta,
  habitHeatmap,
  heatLevel,
  splitArchived,
  todayHabits,
  weekDoneCount,
} from './habitView'

const TODAY = '2026-10-23' // 금요일

const makeHabit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h',
  name: '물 마시기',
  icon: null,
  color: '#2b4c7e',
  frequency: { type: 'daily' },
  goal: { kind: 'check', target: 1, unit: null },
  startDate: '2026-01-01',
  group: null,
  reminderTime: null,
  archived: false,
  logs: {},
  order: 1000,
  ...over,
})

describe('splitArchived', () => {
  test('separates active habits from archived ones and sorts both by order', () => {
    const habits = [
      makeHabit({ id: 'b', order: 2000 }),
      makeHabit({ id: 'x', archived: true, order: 500 }),
      makeHabit({ id: 'a', order: 1000 }),
    ]

    const { active, archived } = splitArchived(habits)

    expect(active.map((h) => h.id)).toEqual(['a', 'b'])
    expect(archived.map((h) => h.id)).toEqual(['x'])
  })
})

describe('groupHabits', () => {
  test('returns one headless group when nothing has a group', () => {
    const groups = groupHabits([makeHabit({ id: 'a' }), makeHabit({ id: 'b', order: 2000 })])

    expect(groups).toHaveLength(1)
    expect(groups[0].name).toBeNull()
    expect(groups[0].habits.map((h) => h.id)).toEqual(['a', 'b'])
  })

  test('orders named groups by their first habit and puts ungrouped habits last', () => {
    const groups = groupHabits([
      makeHabit({ id: 'free', order: 100 }),
      makeHabit({ id: 'night1', group: '저녁', order: 300 }),
      makeHabit({ id: 'morning1', group: '아침', order: 200 }),
      makeHabit({ id: 'night2', group: '저녁', order: 400 }),
    ])

    expect(groups.map((g) => g.name)).toEqual(['아침', '저녁', null])
    expect(groups[1].habits.map((h) => h.id)).toEqual(['night1', 'night2'])
  })

  test('returns no groups for an empty list', () => {
    expect(groupHabits([])).toEqual([])
  })
})

describe('todayHabits', () => {
  test('keeps only habits due today and skips archived or not-yet-started ones', () => {
    const habits = [
      makeHabit({ id: 'daily' }),
      makeHabit({ id: 'weekday', frequency: { type: 'weekdays', days: [1, 2] } }),
      makeHabit({ id: 'friday', frequency: { type: 'weekdays', days: [5] } }),
      makeHabit({ id: 'archived', archived: true }),
      makeHabit({ id: 'future', startDate: '2026-11-01' }),
    ]

    expect(todayHabits(habits, TODAY).map((h) => h.id)).toEqual(['daily', 'friday'])
  })

  test('returns an empty list when there are no habits', () => {
    expect(todayHabits([], TODAY)).toEqual([])
  })
})

describe('heatLevel', () => {
  const count = makeHabit({ goal: { kind: 'count', target: 8, unit: '잔' } })

  test('is 0 for empty days and 4 once the goal is reached', () => {
    expect(heatLevel(count, 0)).toBe(0)
    expect(heatLevel(count, 8)).toBe(4)
    expect(heatLevel(count, 12)).toBe(4)
  })

  test('scales partial progress into levels 1 to 3', () => {
    expect(heatLevel(count, 1)).toBe(1)
    expect(heatLevel(count, 4)).toBe(2)
    expect(heatLevel(count, 6)).toBe(3)
    expect(heatLevel(count, 7)).toBe(3)
  })

  test('treats a logged check habit as level 4', () => {
    expect(heatLevel(makeHabit(), 1)).toBe(4)
  })
})

describe('habitHeatmap', () => {
  test('returns columns of seven days starting on the configured weekday and ending with the current week', () => {
    const grid = habitHeatmap(makeHabit(), TODAY, 12, 1)

    expect(grid).toHaveLength(12)
    expect(grid.every((week) => week.length === 7)).toBe(true)
    expect(grid[11][0].date).toBe('2026-10-19') // 월요일
    expect(grid[0][0].date).toBe('2026-08-03')
  })

  test('marks days after today as future and carries level and due flags', () => {
    const habit = makeHabit({
      frequency: { type: 'weekdays', days: [1, 2, 3, 4, 5] },
      logs: { '2026-10-22': 1 },
    })

    const week = habitHeatmap(habit, TODAY, 1, 1)[0]

    expect(week[3]).toMatchObject({ date: '2026-10-22', level: 4, due: true, future: false })
    expect(week[5]).toMatchObject({ date: '2026-10-24', future: true, due: false })
    expect(week[4]).toMatchObject({ date: TODAY, future: false, level: 0 })
  })

  test('respects a Sunday week start', () => {
    const grid = habitHeatmap(makeHabit(), TODAY, 2, 0)

    expect(grid[1][0].date).toBe('2026-10-18')
  })
})

describe('weekDoneCount', () => {
  test('counts completed days inside the seven-day window', () => {
    const habit = makeHabit({
      frequency: { type: 'timesPerWeek', times: 3 },
      logs: { '2026-10-19': 1, '2026-10-21': 1, '2026-10-26': 1 },
    })

    expect(weekDoneCount(habit, '2026-10-19')).toBe(2)
  })
})

describe('describeFrequency', () => {
  test('describes each frequency type in Korean', () => {
    expect(describeFrequency({ type: 'daily' })).toBe('매일')
    expect(describeFrequency({ type: 'timesPerWeek', times: 3 })).toBe('주 3회')
    expect(describeFrequency({ type: 'weekdays', days: [1, 3, 5] })).toBe('월·수·금')
  })

  test('collapses weekdays and weekends into short words', () => {
    expect(describeFrequency({ type: 'weekdays', days: [1, 2, 3, 4, 5] })).toBe('평일')
    expect(describeFrequency({ type: 'weekdays', days: [0, 6] })).toBe('주말')
    expect(describeFrequency({ type: 'weekdays', days: [0, 1, 2, 3, 4, 5, 6] })).toBe('매일')
  })

  test('lists days in week order starting from Monday and puts Sunday last', () => {
    expect(describeFrequency({ type: 'weekdays', days: [0, 6, 2] })).toBe('화·토·일')
  })
})

describe('formatProgress', () => {
  test('shows value over target with the unit for count habits', () => {
    const habit = makeHabit({ goal: { kind: 'count', target: 8, unit: '잔' } })

    expect(formatProgress(habit, 3)).toBe('3/8잔')
    expect(formatProgress(habit, 0)).toBe('0/8잔')
  })

  test('omits the unit when there is none and handles decimals', () => {
    const habit = makeHabit({ goal: { kind: 'count', target: 5, unit: null } })

    expect(formatProgress(habit, 2.5)).toBe('2.5/5')
  })

  test('shows a done / not done word for check habits', () => {
    expect(formatProgress(makeHabit(), 1)).toBe('완료')
    expect(formatProgress(makeHabit(), 0)).toBe('미완료')
  })
})

describe('cellLabel', () => {
  test('combines the habit name and a Korean month-day', () => {
    expect(cellLabel(makeHabit(), '2026-10-23')).toBe('물 마시기 10월 23일')
  })

  test('adds progress for count habits', () => {
    const habit = makeHabit({ goal: { kind: 'count', target: 8, unit: '잔' }, logs: { '2026-10-23': 3 } })

    expect(cellLabel(habit, '2026-10-23')).toBe('물 마시기 10월 23일, 3/8잔')
  })
})

describe('formatWeekRange', () => {
  test('collapses the month when the week stays inside one month', () => {
    expect(formatWeekRange('2026-10-19')).toBe('2026년 10월 19일 – 25일')
  })

  test('names both months when the week crosses a month', () => {
    expect(formatWeekRange('2026-10-26')).toBe('2026년 10월 26일 – 11월 1일')
  })

  test('names both years when the week crosses new year', () => {
    expect(formatWeekRange('2026-12-28')).toBe('2026년 12월 28일 – 2027년 1월 3일')
  })
})

describe('habitMeta', () => {
  test('joins frequency and a count goal', () => {
    const habit = makeHabit({ goal: { kind: 'count', target: 8, unit: '잔' } })

    expect(habitMeta(habit, '2026-10-19')).toBe('매일 · 하루 8잔')
  })

  test('shows weekly progress for times-per-week habits', () => {
    const habit = makeHabit({
      frequency: { type: 'timesPerWeek', times: 3 },
      logs: { '2026-10-19': 1, '2026-10-21': 1 },
    })

    expect(habitMeta(habit, '2026-10-19')).toBe('주 3회 · 이 주 2/3')
  })

  test('is just the frequency for a plain check habit', () => {
    expect(habitMeta(makeHabit({ frequency: { type: 'weekdays', days: [1, 3] } }), '2026-10-19')).toBe('월·수')
  })
})
