// 습관 화면용 순수 계산: 묶기, 오늘 할 일 고르기, 히트맵, 문구. 달성·연속 판정은 domain/stats 를 쓴다.
import { addDays, startOfWeek, WEEKDAY_KO } from '../../domain/date'
import { habitValue, isHabitDone, isHabitDue } from '../../domain/stats'
import type { Habit, HabitFrequency, ISODate, Weekday } from '../../domain/types'

const DAYS_PER_WEEK = 7
const MAX_HEAT_LEVEL = 4
const PARTIAL_LEVELS = MAX_HEAT_LEVEL - 1
const WEEK_ORDER_MON_FIRST: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 0]

const byOrder = (a: Habit, b: Habit): number => a.order - b.order

export function splitArchived(habits: readonly Habit[]): { active: Habit[]; archived: Habit[] } {
  const sorted = [...habits].sort(byOrder)
  return { active: sorted.filter((h) => !h.archived), archived: sorted.filter((h) => h.archived) }
}

export interface HabitGroup {
  /** null 이면 그룹 없음 */
  name: string | null
  habits: Habit[]
}

/** 그룹 이름별로 묶는다. 그룹은 가장 앞선 습관의 순서를 따르고, 그룹 없는 습관은 맨 뒤로 보낸다. */
export function groupHabits(habits: readonly Habit[]): HabitGroup[] {
  const sorted = [...habits].sort(byOrder)
  const named = new Map<string, Habit[]>()
  const loose: Habit[] = []
  for (const habit of sorted) {
    if (habit.group === null) loose.push(habit)
    else named.set(habit.group, [...(named.get(habit.group) ?? []), habit])
  }
  const groups: HabitGroup[] = [...named].map(([name, list]) => ({ name, habits: list }))
  return loose.length > 0 ? [...groups, { name: null, habits: loose }] : groups
}

export function todayHabits(habits: readonly Habit[], today: ISODate): Habit[] {
  return [...habits].sort(byOrder).filter((h) => isHabitDue(h, today))
}

/** 0 은 기록 없음, 1~3 은 목표 대비 진행, 4 는 목표 달성. */
export function heatLevel(habit: Habit, value: number): number {
  if (value <= 0) return 0
  const ratio = value / habit.goal.target
  if (ratio >= 1) return MAX_HEAT_LEVEL
  return Math.max(1, Math.min(PARTIAL_LEVELS, Math.ceil(ratio * PARTIAL_LEVELS)))
}

export interface HeatCell {
  date: ISODate
  level: number
  due: boolean
  future: boolean
}

/** 열 = 주, 행 = 요일. 마지막 열이 오늘이 속한 주다. */
export function habitHeatmap(
  habit: Habit,
  today: ISODate,
  weeks: number,
  weekStartsOn: 0 | 1,
): HeatCell[][] {
  const lastWeekStart = startOfWeek(today, weekStartsOn)
  return Array.from({ length: weeks }, (_, w) => {
    const weekStart = addDays(lastWeekStart, (w - (weeks - 1)) * DAYS_PER_WEEK)
    return Array.from({ length: DAYS_PER_WEEK }, (_, d): HeatCell => {
      const date = addDays(weekStart, d)
      const future = date > today
      return {
        date,
        future,
        due: !future && isHabitDue(habit, date),
        level: future ? 0 : heatLevel(habit, habitValue(habit, date)),
      }
    })
  })
}

/** weekStart 부터 7일 중 완료한 날 수. 주 N회 습관의 진행 표시에 쓴다. */
export function weekDoneCount(habit: Habit, weekStart: ISODate): number {
  let done = 0
  for (let i = 0; i < DAYS_PER_WEEK; i += 1) {
    if (isHabitDone(habit, addDays(weekStart, i))) done += 1
  }
  return done
}

export function describeFrequency(frequency: HabitFrequency): string {
  if (frequency.type === 'daily') return '매일'
  if (frequency.type === 'timesPerWeek') return `주 ${frequency.times}회`
  const days = new Set(frequency.days)
  if (days.size === DAYS_PER_WEEK) return '매일'
  if (days.size === 5 && [1, 2, 3, 4, 5].every((d) => days.has(d as Weekday))) return '평일'
  if (days.size === 2 && days.has(0) && days.has(6)) return '주말'
  return WEEK_ORDER_MON_FIRST.filter((d) => days.has(d))
    .map((d) => WEEKDAY_KO[d])
    .join('·')
}

export function formatProgress(habit: Habit, value: number): string {
  if (habit.goal.kind === 'check') return value > 0 ? '완료' : '미완료'
  return `${value}/${habit.goal.target}${habit.goal.unit ?? ''}`
}

export function formatMonthDay(date: ISODate): string {
  const [, month, day] = date.split('-').map(Number)
  return `${month}월 ${day}일`
}

/** 체크 칸의 접근 가능한 이름. count 습관은 진행도를 덧붙인다. */
export function cellLabel(habit: Habit, date: ISODate): string {
  const base = `${habit.name} ${formatMonthDay(date)}`
  return habit.goal.kind === 'count' ? `${base}, ${formatProgress(habit, habitValue(habit, date))}` : base
}

export function formatWeekRange(weekStart: ISODate): string {
  const [y1, m1, d1] = weekStart.split('-').map(Number)
  const [y2, m2, d2] = addDays(weekStart, DAYS_PER_WEEK - 1).split('-').map(Number)
  if (y1 !== y2) return `${y1}년 ${m1}월 ${d1}일 – ${y2}년 ${m2}월 ${d2}일`
  if (m1 !== m2) return `${y1}년 ${m1}월 ${d1}일 – ${m2}월 ${d2}일`
  return `${y1}년 ${m1}월 ${d1}일 – ${d2}일`
}

/** 목록 한 줄 아래에 붙는 보조 문구: 빈도, 하루 목표, 주 N회의 이번 주 진행. */
export function habitMeta(habit: Habit, weekStart: ISODate): string {
  const parts = [describeFrequency(habit.frequency)]
  if (habit.goal.kind === 'count') parts.push(`하루 ${habit.goal.target}${habit.goal.unit ?? ''}`)
  if (habit.frequency.type === 'timesPerWeek') {
    parts.push(`이 주 ${weekDoneCount(habit, weekStart)}/${habit.frequency.times}`)
  }
  return parts.join(' · ')
}
