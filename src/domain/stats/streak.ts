import { addDays, weekdayOf } from '../date'
import type { ISODate, Weekday } from '../types'

export interface StreakInput {
  /** 날짜별 완료 건수 */
  countsByDate: ReadonlyMap<ISODate, number>
  today: ISODate
  /** 하루 목표(1 이상으로 보정된 값) */
  goal: number
  daysOff: readonly Weekday[]
  vacationMode: boolean
}

/**
 * 연속 달성(streak) 규칙
 * - 목표를 채운 날이 +1.
 * - 쉬는 요일(daysOff)에 못 채워도 끊기지 않고 건너뛴다. 쉬는 날에 채웠으면 그대로 +1.
 * - 오늘은 아직 못 채웠어도 끊지 않는다(어제까지의 연속이 살아 있다).
 * - 휴가 모드: 오늘부터 거슬러 올라가며, 마지막으로 목표를 채운 날 이후의 빈 날들은 모두 건너뛴다.
 *   (휴가 시작일을 따로 저장하지 않으므로 "마지막 달성일 이후의 공백 전체"를 휴가로 본다.)
 * - 목표를 채운 날이 한 번도 없으면 0.
 */
export function computeStreaks(input: StreakInput): { current: number; longest: number } {
  const { countsByDate, today, goal, daysOff, vacationMode } = input
  const isMet = (date: ISODate): boolean => (countsByDate.get(date) ?? 0) >= goal
  const isOff = (date: ISODate): boolean => daysOff.includes(weekdayOf(date))

  const earliest = [...countsByDate.keys()].filter((d) => d <= today && isMet(d)).sort()[0]
  if (earliest === undefined) return { current: 0, longest: 0 }

  let current = 0
  let inVacationGap = vacationMode
  for (let d = today; d >= earliest; d = addDays(d, -1)) {
    if (isMet(d)) {
      current += 1
      inVacationGap = false
    } else if (d !== today && !inVacationGap && !isOff(d)) {
      break
    }
  }

  let run = 0
  let best = 0
  for (let d = earliest; d <= today; d = addDays(d, 1)) {
    if (isMet(d)) {
      run += 1
      best = Math.max(best, run)
    } else if (d !== today && !isOff(d)) {
      run = 0
    }
  }
  return { current, longest: Math.max(best, current) }
}
