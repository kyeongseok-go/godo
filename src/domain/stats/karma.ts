import { addDays, daysBetween, startOfWeek } from '../date'
import type { ISODate, Priority, Task, Weekday } from '../types'
import { isCompletedTask, isOpenTask, localDateOf } from './shared'
import { computeStreaks } from './streak'

export interface ProductivitySettings {
  karmaEnabled: boolean
  dailyGoal: number
  weeklyGoal: number
  daysOff: Weekday[]
  vacationMode: boolean
}

export interface KarmaSummary {
  points: number
  level: string
  levelIndex: number
  nextLevelAt: number | null
  todayDone: number
  weekDone: number
  dailyGoalMet: boolean
  weeklyGoalMet: boolean
  streakDays: number
  longestStreak: number
  /** 최근 N일(오래된 날부터, 마지막이 오늘) */
  series: Array<{ date: ISODate; done: number }>
}

/** 레벨 표. min 은 그 레벨이 시작되는 최소 점수. 이름과 기준은 여기 한 곳에서만 고친다. */
export const KARMA_LEVELS: readonly { min: number; name: string }[] = [
  { min: 0, name: '시작자' },
  { min: 500, name: '초보' },
  { min: 2500, name: '중급' },
  { min: 5000, name: '전문가' },
  { min: 7500, name: '달인' },
  { min: 10000, name: '고수' },
  { min: 20000, name: '마스터' },
  { min: 50000, name: '깨달은 자' },
]

// 점수 규칙(Todoist 카르마를 단순화)
const BASE_POINTS = 5
const PRIORITY_BONUS: Record<Priority, number> = { 1: 5, 2: 3, 3: 1, 4: 0 }
const ON_TIME_BONUS = 2
const OVERDUE_PENALTY = 3
/** 마감이 이만큼 이상 지난 미완료 1건마다 감점(Todoist 도움말: "five or more days overdue") */
const OVERDUE_PENALTY_DAYS = 5
const MAX_SERIES_DAYS = 3660

export function karmaLevelFor(points: number): {
  level: string
  levelIndex: number
  nextLevelAt: number | null
} {
  let levelIndex = 0
  KARMA_LEVELS.forEach((entry, index) => {
    if (points >= entry.min) levelIndex = index
  })
  const next = KARMA_LEVELS[levelIndex + 1]
  return { level: KARMA_LEVELS[levelIndex].name, levelIndex, nextLevelAt: next ? next.min : null }
}

function pointsFor(tasks: readonly Task[], today: ISODate): number {
  let total = 0
  for (const task of tasks) {
    if (isCompletedTask(task)) {
      total += BASE_POINTS + PRIORITY_BONUS[task.priority]
      if (task.dueDate !== null && localDateOf(task.completedAt) <= task.dueDate) total += ON_TIME_BONUS
    } else if (
      isOpenTask(task) &&
      task.dueDate !== null &&
      daysBetween(task.dueDate, today) >= OVERDUE_PENALTY_DAYS
    ) {
      total -= OVERDUE_PENALTY
    }
  }
  return Math.max(0, total)
}

function countByDate(tasks: readonly Task[]): Map<ISODate, number> {
  const counts = new Map<ISODate, number>()
  for (const task of tasks) {
    if (!isCompletedTask(task)) continue
    const date = localDateOf(task.completedAt)
    counts.set(date, (counts.get(date) ?? 0) + 1)
  }
  return counts
}

function buildSeries(
  counts: ReadonlyMap<ISODate, number>,
  today: ISODate,
  days: number,
): Array<{ date: ISODate; done: number }> {
  const length = Number.isFinite(days) ? Math.min(MAX_SERIES_DAYS, Math.max(0, Math.floor(days))) : 0
  return Array.from({ length }, (_, i) => {
    const date = addDays(today, i - (length - 1))
    return { date, done: counts.get(date) ?? 0 }
  })
}

function sumRange(counts: ReadonlyMap<ISODate, number>, from: ISODate, to: ISODate): number {
  let sum = 0
  counts.forEach((count, date) => {
    if (date >= from && date <= to) sum += count
  })
  return sum
}

/**
 * 생산성·카르마 요약.
 * - 집계는 완료 시각(epoch ms)을 로컬 날짜로 바꿔서 한다. 완료 작업 = status done + completedAt 있음 + 휴지통 아님.
 * - 목표가 0 이하면 1건으로 본다(목표 없는 사람도 "하루 한 건"을 연속 기록의 기준으로 삼는다).
 * - 카르마를 꺼도 건수·목표·연속 기록은 그대로 계산하고, 점수와 레벨만 비운다.
 * - 이번 주 건수는 주 시작일부터 오늘까지.
 */
export function summarizeProductivity(input: {
  tasks: readonly Task[]
  today: ISODate
  weekStartsOn: 0 | 1
  settings: ProductivitySettings
  seriesDays: number
}): KarmaSummary {
  const { tasks, today, weekStartsOn, settings, seriesDays } = input
  const counts = countByDate(tasks)
  const dailyGoal = Math.max(1, settings.dailyGoal)
  const weeklyGoal = Math.max(1, settings.weeklyGoal)

  const todayDone = counts.get(today) ?? 0
  const weekDone = sumRange(counts, startOfWeek(today, weekStartsOn), today)
  const streaks = computeStreaks({
    countsByDate: counts,
    today,
    goal: dailyGoal,
    daysOff: settings.daysOff,
    vacationMode: settings.vacationMode,
  })

  const points = settings.karmaEnabled ? pointsFor(tasks, today) : 0
  const levelInfo = settings.karmaEnabled
    ? karmaLevelFor(points)
    : { level: '', levelIndex: 0, nextLevelAt: null }

  return {
    points,
    ...levelInfo,
    todayDone,
    weekDone,
    dailyGoalMet: todayDone >= dailyGoal,
    weeklyGoalMet: weekDone >= weeklyGoal,
    streakDays: streaks.current,
    longestStreak: streaks.longest,
    series: buildSeries(counts, today, seriesDays),
  }
}
