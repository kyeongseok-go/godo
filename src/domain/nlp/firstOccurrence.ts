// 반복 규칙의 첫 회차 날짜: 시작일이 따로 없을 때 오늘 이후(오늘 포함) 가장 가까운 회차를 고른다.
import { addDays, weekdayOf } from '../date'
import type { ISODate, RecurrenceRule } from '../types'
import { dayOfMonth, endOfMonth, monthFirstOf, nthWeekdayOfMonth } from './dateMath'

function firstWeekly(rule: RecurrenceRule, today: ISODate): ISODate {
  const days = rule.byWeekday
  if (!days || days.length === 0) return today
  const todayIndex = weekdayOf(today)
  const delta = Math.min(...days.map((d) => (d - todayIndex + 7) % 7))
  return addDays(today, delta)
}

function firstMonthly(rule: RecurrenceRule, today: ISODate): ISODate {
  const pick = (monthOffset: number): ISODate | null => {
    if (rule.byMonthDay === 'last') return endOfMonth(today, monthOffset)
    if (typeof rule.byMonthDay === 'number') return dayOfMonth(today, monthOffset, rule.byMonthDay)
    if (rule.nth) return nthWeekdayOfMonth(monthFirstOf(today, monthOffset), rule.nth.n, rule.nth.weekday)
    return null
  }
  const thisMonth = pick(0)
  if (thisMonth === null) return today
  if (thisMonth >= today) return thisMonth
  return pick(1) ?? today
}

export function firstOccurrence(rule: RecurrenceRule, today: ISODate): ISODate {
  switch (rule.freq) {
    case 'weekly':
      return firstWeekly(rule, today)
    case 'monthly':
      return firstMonthly(rule, today)
    case 'daily':
    case 'yearly':
      return today
  }
}
