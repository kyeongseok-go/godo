// 목표 스테퍼와 쉬는 요일 토글의 순수 계산.
import type { Weekday } from '../../domain/types'

export interface GoalRange {
  min: number
  max: number
}

export const DAILY_GOAL_RANGE: GoalRange = { min: 1, max: 99 }
export const WEEKLY_GOAL_RANGE: GoalRange = { min: 1, max: 500 }

/** 값을 delta만큼 옮기고 범위 안으로 되돌린다. 저장된 값이 범위를 벗어나거나 소수여도 안전하다. */
export function stepGoal(value: number, delta: number, range: GoalRange): number {
  const base = Number.isFinite(value) ? Math.round(value) : range.min
  return Math.min(range.max, Math.max(range.min, base + delta))
}

/** 쉬는 요일을 켜고 끈다. 항상 오름차순 새 배열을 돌려준다. */
export function toggleDayOff(daysOff: readonly Weekday[], day: Weekday): Weekday[] {
  const next = daysOff.includes(day) ? daysOff.filter((d) => d !== day) : [...daysOff, day]
  return next.sort((a, b) => a - b)
}

/** 한 주 시작 요일에 맞춘 요일 순서 */
export function orderedWeekdays(weekStartsOn: 0 | 1): Weekday[] {
  return Array.from({ length: 7 }, (_, i) => ((i + weekStartsOn) % 7) as Weekday)
}
