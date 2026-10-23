import { addYears, daysBetween, fromISODate } from '../date'
import type { Countdown, ISODate } from '../types'

/**
 * 다음 기준일. 반복이 아니거나 아직 오지 않은 날짜면 그 날짜 그대로,
 * 매년 반복이면 오늘 이후(오늘 포함) 가장 가까운 기념일. 2/29 는 평년에 2/28 로 맞춘다.
 */
export function nextCountdownDate(c: Countdown, today: ISODate): ISODate {
  if (!c.repeatYearly || c.date >= today) return c.date
  const years = fromISODate(today).getFullYear() - fromISODate(c.date).getFullYear()
  const thisYear = addYears(c.date, years)
  return thisYear >= today ? thisYear : addYears(c.date, years + 1)
}

/**
 * daysLeft 는 (기준일 - 오늘)이라 지난 날짜는 음수다.
 * 라벨: 3일 전 "D-3", 당일 "D-DAY", 5일 지남 "D+5". 매년 반복은 지났다고 보지 않는다.
 */
export function countdownInfo(
  c: Countdown,
  today: ISODate,
): { daysLeft: number; label: string; passed: boolean } {
  const daysLeft = daysBetween(today, nextCountdownDate(c, today))
  if (daysLeft > 0) return { daysLeft, label: `D-${daysLeft}`, passed: false }
  if (daysLeft === 0) return { daysLeft, label: 'D-DAY', passed: false }
  return { daysLeft, label: `D+${-daysLeft}`, passed: true }
}
