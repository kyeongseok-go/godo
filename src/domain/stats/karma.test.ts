import { makeTask } from '../../test/factories'
import type { Task } from '../types'
import { KARMA_LEVELS, karmaLevelFor, summarizeProductivity } from './karma'
import type { ProductivitySettings } from './karma'

// 2026-10-23 은 금요일, 2026-10-26 은 월요일
const at = (month: number, day: number, hour = 12): number => new Date(2026, month - 1, day, hour).getTime()

const baseSettings: ProductivitySettings = {
  karmaEnabled: true,
  dailyGoal: 1,
  weeklyGoal: 5,
  daysOff: [],
  vacationMode: false,
}

const doneTask = (month: number, day: number, overrides: Partial<Task> = {}): Task =>
  makeTask({ status: 'done', completedAt: at(month, day), ...overrides })

interface RunOptions {
  tasks: readonly Task[]
  today?: string
  weekStartsOn?: 0 | 1
  settings?: Partial<ProductivitySettings>
  seriesDays?: number
}

function run({ tasks, today = '2026-10-23', weekStartsOn = 1, settings = {}, seriesDays = 7 }: RunOptions) {
  return summarizeProductivity({
    tasks,
    today,
    weekStartsOn,
    settings: { ...baseSettings, ...settings },
    seriesDays,
  })
}

describe('karmaLevelFor', () => {
  test('maps thresholds to Korean level names', () => {
    expect(KARMA_LEVELS.map((l) => l.min)).toEqual([0, 500, 2500, 5000, 7500, 10000, 20000, 50000])
    expect(karmaLevelFor(0)).toEqual({ level: '시작자', levelIndex: 0, nextLevelAt: 500 })
    expect(karmaLevelFor(499).levelIndex).toBe(0)
    expect(karmaLevelFor(500)).toEqual({ level: '초보', levelIndex: 1, nextLevelAt: 2500 })
    expect(karmaLevelFor(2500).level).toBe('중급')
    expect(karmaLevelFor(5000).level).toBe('전문가')
    expect(karmaLevelFor(7500).level).toBe('달인')
    expect(karmaLevelFor(10000).level).toBe('고수')
    expect(karmaLevelFor(20000).level).toBe('마스터')
  })

  test('the top level has no next threshold', () => {
    expect(karmaLevelFor(50000)).toEqual({ level: '깨달은 자', levelIndex: 7, nextLevelAt: null })
    expect(karmaLevelFor(999999).levelIndex).toBe(7)
  })
})

describe('summarizeProductivity: empty state', () => {
  test('returns zeros for no tasks', () => {
    const s = run({ tasks: [] })
    expect(s).toMatchObject({
      points: 0,
      level: '시작자',
      levelIndex: 0,
      nextLevelAt: 500,
      todayDone: 0,
      weekDone: 0,
      dailyGoalMet: false,
      weeklyGoalMet: false,
      streakDays: 0,
      longestStreak: 0,
    })
    expect(s.series).toHaveLength(7)
    expect(s.series.every((p) => p.done === 0)).toBe(true)
  })
})

describe('summarizeProductivity: points', () => {
  test('gives 5 points per finished task', () => {
    expect(run({ tasks: [doneTask(10, 22)] }).points).toBe(5)
    expect(run({ tasks: [doneTask(10, 22), doneTask(10, 21)] }).points).toBe(10)
  })

  test('adds priority bonuses p1 +5, p2 +3, p3 +1, p4 +0', () => {
    const points = (priority: 1 | 2 | 3 | 4): number =>
      run({ tasks: [doneTask(10, 22, { priority })] }).points
    expect([points(1), points(2), points(3), points(4)]).toEqual([10, 8, 6, 5])
  })

  test('adds +2 when finished on or before the due date', () => {
    const early = doneTask(10, 22, { dueDate: '2026-10-23' })
    const sameDay = doneTask(10, 22, { dueDate: '2026-10-22' })
    const late = doneTask(10, 22, { dueDate: '2026-10-21' })
    expect(run({ tasks: [early] }).points).toBe(7)
    expect(run({ tasks: [sameDay] }).points).toBe(7)
    expect(run({ tasks: [late] }).points).toBe(5)
  })

  test('compares the due date with the local completion date', () => {
    const justAfterMidnight = makeTask({
      status: 'done',
      completedAt: new Date(2026, 9, 23, 0, 30).getTime(),
      dueDate: '2026-10-22',
    })
    expect(run({ tasks: [justAfterMidnight] }).points).toBe(5)
  })

  test('subtracts 3 per open task overdue by five or more days', () => {
    const base = doneTask(10, 22, { priority: 1 }) // +10
    const overdue5 = makeTask({ dueDate: '2026-10-18' })
    const overdue4 = makeTask({ dueDate: '2026-10-19' })
    expect(run({ tasks: [base, overdue5] }).points).toBe(7)
    expect(run({ tasks: [base, overdue4] }).points).toBe(10)
  })

  test('does not penalise finished, canceled, trashed or dateless tasks', () => {
    const tasks = [
      doneTask(10, 22, { dueDate: '2026-10-01' }), // 기한은 지났지만 이미 끝냄 (+5, 기한 초과라 보너스 없음)
      makeTask({ dueDate: '2026-10-01', status: 'canceled' }),
      makeTask({ dueDate: '2026-10-01', deletedAt: 1 }),
      makeTask({ dueDate: null }),
    ]
    expect(run({ tasks }).points).toBe(5)
  })

  test('never drops below zero', () => {
    const tasks = [makeTask({ dueDate: '2026-09-01' }), makeTask({ dueDate: '2026-09-02' })]
    expect(run({ tasks }).points).toBe(0)
  })

  test('ignores tasks that are not really completed', () => {
    const tasks = [
      makeTask({ status: 'done', completedAt: null }),
      makeTask({ status: 'todo', completedAt: at(10, 22) }),
      doneTask(10, 22, { deletedAt: 5 }),
    ]
    const s = run({ tasks })
    expect(s.points).toBe(0)
    expect(s.weekDone).toBe(0)
  })

  test('turns karma off: zero points and an empty level, but counts still work', () => {
    const s = run({ tasks: [doneTask(10, 23)], settings: { karmaEnabled: false } })
    expect(s.points).toBe(0)
    expect(s.level).toBe('')
    expect(s.nextLevelAt).toBeNull()
    expect(s.todayDone).toBe(1)
    expect(s.dailyGoalMet).toBe(true)
  })

  test('reaches the second level at 500 points', () => {
    const tasks = Array.from({ length: 100 }, () => doneTask(10, 1))
    const s = run({ tasks })
    expect(s.points).toBe(500)
    expect(s.level).toBe('초보')
    expect(s.levelIndex).toBe(1)
    expect(s.nextLevelAt).toBe(2500)
  })
})

describe('summarizeProductivity: counts and goals', () => {
  test('counts today by local completion date, including the midnight edges', () => {
    const tasks = [
      makeTask({ status: 'done', completedAt: new Date(2026, 9, 23, 0, 0).getTime() }),
      makeTask({ status: 'done', completedAt: new Date(2026, 9, 23, 23, 59).getTime() }),
      makeTask({ status: 'done', completedAt: new Date(2026, 9, 22, 23, 59).getTime() }),
      makeTask({ status: 'done', completedAt: new Date(2026, 9, 24, 0, 0).getTime() }),
    ]
    expect(run({ tasks }).todayDone).toBe(2)
  })

  test('weekDone follows weekStartsOn (Monday vs Sunday)', () => {
    const tasks = [doneTask(10, 18), doneTask(10, 19), doneTask(10, 23)]
    expect(run({ tasks, weekStartsOn: 1 }).weekDone).toBe(2)
    expect(run({ tasks, weekStartsOn: 0 }).weekDone).toBe(3)
  })

  test('goal flags compare with the configured goals', () => {
    const tasks = [doneTask(10, 23), doneTask(10, 23), doneTask(10, 22)]
    const met = run({ tasks, settings: { dailyGoal: 2, weeklyGoal: 3 } })
    expect(met.dailyGoalMet).toBe(true)
    expect(met.weeklyGoalMet).toBe(true)
    const notMet = run({ tasks, settings: { dailyGoal: 3, weeklyGoal: 4 } })
    expect(notMet.dailyGoalMet).toBe(false)
    expect(notMet.weeklyGoalMet).toBe(false)
  })

  test('a goal of zero is treated as one task', () => {
    expect(run({ tasks: [], settings: { dailyGoal: 0 } }).dailyGoalMet).toBe(false)
    expect(run({ tasks: [doneTask(10, 23)], settings: { dailyGoal: 0 } }).dailyGoalMet).toBe(true)
  })

  test('series covers the last N days ending today, oldest first', () => {
    const tasks = [doneTask(10, 23), doneTask(10, 23), doneTask(10, 21), doneTask(10, 10)]
    const s = run({ tasks, seriesDays: 3 })
    expect(s.series).toEqual([
      { date: '2026-10-21', done: 1 },
      { date: '2026-10-22', done: 0 },
      { date: '2026-10-23', done: 2 },
    ])
  })

  test('series crosses month boundaries and handles zero or invalid lengths', () => {
    expect(run({ tasks: [], today: '2026-11-02', seriesDays: 3 }).series.map((p) => p.date)).toEqual([
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ])
    expect(run({ tasks: [], seriesDays: 0 }).series).toEqual([])
    expect(run({ tasks: [], seriesDays: -4 }).series).toEqual([])
    expect(run({ tasks: [], seriesDays: Number.NaN }).series).toEqual([])
  })
})

describe('summarizeProductivity: streaks', () => {
  test('counts consecutive goal days ending today', () => {
    const tasks = [doneTask(10, 21), doneTask(10, 22), doneTask(10, 23)]
    const s = run({ tasks })
    expect(s.streakDays).toBe(3)
    expect(s.longestStreak).toBe(3)
  })

  test('keeps yesterday\'s streak alive while today is still empty', () => {
    const s = run({ tasks: [doneTask(10, 21), doneTask(10, 22)] })
    expect(s.streakDays).toBe(2)
  })

  test('breaks on a missed day and remembers the longest run', () => {
    const tasks = [doneTask(10, 15), doneTask(10, 16), doneTask(10, 17), doneTask(10, 20), doneTask(10, 22)]
    const s = run({ tasks })
    expect(s.streakDays).toBe(1)
    expect(s.longestStreak).toBe(3)
  })

  test('a streak older than yesterday is gone', () => {
    const s = run({ tasks: [doneTask(10, 20), doneTask(10, 21)] })
    expect(s.streakDays).toBe(0)
    expect(s.longestStreak).toBe(2)
  })

  test('needs the daily goal on every day', () => {
    const tasks = [doneTask(10, 22), doneTask(10, 22), doneTask(10, 21)]
    const s = run({ tasks, settings: { dailyGoal: 2 } })
    expect(s.streakDays).toBe(1)
  })

  test('crosses month and year boundaries', () => {
    const tasks = [
      new Date(2026, 11, 31, 10).getTime(),
      new Date(2027, 0, 1, 10).getTime(),
      new Date(2027, 0, 2, 10).getTime(),
    ].map((completedAt) => makeTask({ status: 'done', completedAt }))
    expect(run({ tasks, today: '2027-01-02' }).streakDays).toBe(3)
  })

  test('days off neither extend nor break the streak', () => {
    // 오늘 월요일 10-26. 토·일은 쉬는 날.
    const tasks = [doneTask(10, 22), doneTask(10, 23)]
    const withDaysOff = run({ tasks, today: '2026-10-26', settings: { daysOff: [6, 0] } })
    expect(withDaysOff.streakDays).toBe(2)
    expect(withDaysOff.longestStreak).toBe(2)
    const without = run({ tasks, today: '2026-10-26' })
    expect(without.streakDays).toBe(0)
  })

  test('a weekday that is missed still breaks the streak despite days off', () => {
    const tasks = [doneTask(10, 21), doneTask(10, 23)] // 수, 금 (목 빠짐)
    const s = run({ tasks, today: '2026-10-26', settings: { daysOff: [6, 0] } })
    expect(s.streakDays).toBe(1)
  })

  test('a goal met on a day off still counts', () => {
    const tasks = [doneTask(10, 23), doneTask(10, 24)] // 금, 토(쉬는 날)
    const s = run({ tasks, today: '2026-10-26', settings: { daysOff: [6, 0] } })
    expect(s.streakDays).toBe(2)
  })

  test('vacation mode skips the empty days since the last goal day', () => {
    const tasks = [doneTask(10, 22), doneTask(10, 23)]
    const onVacation = run({ tasks, today: '2026-10-28', settings: { vacationMode: true } })
    expect(onVacation.streakDays).toBe(2)
    const working = run({ tasks, today: '2026-10-28' })
    expect(working.streakDays).toBe(0)
  })

  test('vacation mode still breaks on a miss before the last goal day', () => {
    const tasks = [doneTask(10, 20), doneTask(10, 23)]
    const s = run({ tasks, today: '2026-10-28', settings: { vacationMode: true } })
    expect(s.streakDays).toBe(1)
  })

  test('vacation mode with no history yields zero without looping forever', () => {
    expect(run({ tasks: [], settings: { vacationMode: true } }).streakDays).toBe(0)
  })

  test('ignores completions after today when walking the streak', () => {
    const s = run({ tasks: [doneTask(10, 24), doneTask(10, 25)] })
    expect(s.streakDays).toBe(0)
    expect(s.longestStreak).toBe(0)
  })
})
