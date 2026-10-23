import { addDays, weekdayOf } from '../date'
import type { Habit, ISODate } from '../types'

// 규칙
// - 'due'(해야 하는 날) = 시작일 이후 + 보관 안 됨 + 빈도에 맞는 날. timesPerWeek 는 매일 due 로 본다
//   (주 N회 달성 판정은 하지 않는다 — 날짜 단위 연속 기록만 제공).
// - 연속 기록은 due 인 날만 센다. due 가 아닌 날의 기록은 연속에 영향이 없다.

export function isHabitDue(habit: Habit, date: ISODate): boolean {
  if (habit.archived || date < habit.startDate) return false
  const { frequency } = habit
  if (frequency.type === 'weekdays') return frequency.days.includes(weekdayOf(date))
  return true
}

export function habitValue(habit: Habit, date: ISODate): number {
  return habit.logs[date] ?? 0
}

/** 값이 목표 이상이면 완료. 목표가 0 이하여도 값이 0이면 완료로 치지 않는다. */
export function isHabitDone(habit: Habit, date: ISODate): boolean {
  const value = habitValue(habit, date)
  return value > 0 && value >= habit.goal.target
}

export function setHabitValue(habit: Habit, date: ISODate, value: number): Habit {
  const others = Object.entries(habit.logs).filter(([key]) => key !== date)
  const keep = Number.isFinite(value) && value > 0 ? [...others, [date, value] as const] : others
  return { ...habit, logs: Object.fromEntries(keep) }
}

/** check 습관만 0↔1 로 뒤집는다. count 습관은 그대로 돌려준다(호출 측이 setHabitValue 를 쓴다). */
export function toggleHabit(habit: Habit, date: ISODate): Habit {
  if (habit.goal.kind !== 'check') return habit
  return setHabitValue(habit, date, isHabitDone(habit, date) ? 0 : 1)
}

/**
 * 시작일부터 오늘까지 due 인 날만 훑는다.
 * 오늘이 due 인데 아직 안 했으면 연속을 끊지 않는다(어제까지의 연속 유지).
 */
export function habitStreak(habit: Habit, today: ISODate): { current: number; longest: number } {
  if (habit.archived) return { current: 0, longest: 0 }
  let run = 0
  let longest = 0
  for (let d = habit.startDate; d <= today; d = addDays(d, 1)) {
    if (!isHabitDue(habit, d)) continue
    if (isHabitDone(habit, d)) {
      run += 1
      longest = Math.max(longest, run)
    } else if (d !== today) {
      run = 0
    }
  }
  return { current: run, longest }
}

/** from~to(양끝 포함) 중 due 였던 날 대비 완료한 날의 비율(0~1). due 가 없으면 0. */
export function habitCompletionRate(habit: Habit, from: ISODate, to: ISODate): number {
  let due = 0
  let done = 0
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (!isHabitDue(habit, d)) continue
    due += 1
    if (isHabitDone(habit, d)) done += 1
  }
  return due === 0 ? 0 : done / due
}

/** 주간 체크 그리드용 7칸. */
export function habitWeekProgress(
  habit: Habit,
  weekStart: ISODate,
): Array<{ date: ISODate; due: boolean; done: boolean; value: number }> {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i)
    return {
      date,
      due: isHabitDue(habit, date),
      done: isHabitDone(habit, date),
      value: habitValue(habit, date),
    }
  })
}
