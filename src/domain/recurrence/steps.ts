// 규칙 한 걸음 계산: "이 회차 다음 날짜"와 "완료일 기준 첫 후보".
import { addDays, addMonths, addYears, weekdayOf } from '../date'
// addYears 는 완료일 기준(completionBase)에서만 쓴다. 'due' 기준 연간 반복은 stepYearly 가 맡는다.
import type { ISODate, RecurrenceRule } from '../types'
import { dayOfMonthClamped, mondayIndex, nthWeekdayOfMonth, parseYMD, shiftMonth } from './calendar'

/** 잘못된 interval이 들어와도 제자리걸음(무한 루프)하지 않도록 1로 보정한다. */
export function intervalOf(rule: RecurrenceRule): number {
  return Number.isInteger(rule.interval) && rule.interval >= 1 ? rule.interval : 1
}

/**
 * 주간 규칙: 주는 월요일~일요일 한 덩어리로 본다(설정의 주 시작 요일과 무관, 항상 고정).
 * from 이후 가장 가까운 해당 요일을 같은 주 안에서 먼저 찾고, 그 주에 남은 요일이 없으면
 * interval주 뒤 주의 첫 해당 요일로 건너뛴다. interval=1이면 단순히 "다음 해당 요일"과 같다.
 * byWeekday가 비었으면 from의 요일 하나만 쓴다.
 */
function stepWeekly(rule: RecurrenceRule, current: ISODate): ISODate {
  const weekdays = rule.byWeekday && rule.byWeekday.length > 0 ? rule.byWeekday : [weekdayOf(current)]
  const slots = [...new Set(weekdays.map(mondayIndex))].sort((a, b) => a - b)
  const currentSlot = mondayIndex(weekdayOf(current))
  const later = slots.find((slot) => slot > currentSlot)
  if (later !== undefined) return addDays(current, later - currentSlot)
  return addDays(current, 7 * intervalOf(rule) - currentSlot + slots[0])
}

function resolveInMonth(rule: RecurrenceRule, year: number, month: number, fallbackDay: number): ISODate {
  // nth와 byMonthDay를 함께 주면 nth가 이긴다(validateRule이 함께 쓰는 것을 막는다).
  if (rule.nth) return nthWeekdayOfMonth(year, month, rule.nth.n, rule.nth.weekday)
  return dayOfMonthClamped(year, month, rule.byMonthDay ?? fallbackDay)
}

/**
 * 월간 규칙: 같은 달에 아직 남은 날짜가 있으면 그것을, 없으면 interval달 뒤를 쓴다.
 * byMonthDay가 있으면 31일처럼 짧은 달에 밀려도 원래 일을 기억한다(없으면 current의 일).
 */
function stepMonthly(rule: RecurrenceRule, current: ISODate): ISODate {
  const { year, month, day } = parseYMD(current)
  const sameMonth = resolveInMonth(rule, year, month, day)
  if (sameMonth > current) return sameMonth
  const target = shiftMonth(year, month, intervalOf(rule))
  return resolveInMonth(rule, target.year, target.month, day)
}

/**
 * 연간 규칙: 달은 그대로 두고 해만 더한다. 기준 일(byMonthDay)이 있으면 2월 29일처럼
 * 짧은 달에 밀렸던 날짜도 다시 29일로 돌아온다. 없으면 current의 일을 쓴다.
 */
function stepYearly(rule: RecurrenceRule, current: ISODate): ISODate {
  const { year, month, day } = parseYMD(current)
  return dayOfMonthClamped(year + intervalOf(rule), month, rule.byMonthDay ?? day)
}

/** 'due' 기준: current 회차 바로 다음 회차(current보다 항상 늦다). */
export function stepDue(rule: RecurrenceRule, current: ISODate): ISODate {
  switch (rule.freq) {
    case 'daily':
      return addDays(current, intervalOf(rule))
    case 'weekly':
      return stepWeekly(rule, current)
    case 'monthly':
      return stepMonthly(rule, current)
    case 'yearly':
      return stepYearly(rule, current)
  }
}

/**
 * 월간·연간 규칙에 기준 일을 박아 둔다.
 * 1월 31일에서 시작한 "매월"은 2월에 28일로 밀리는데, 그 28일을 다시 기준으로 삼으면
 * 3월에도 28일이 되어 영구히 밀린다. 기준 일을 규칙에 적어 두면 3월에 31일로 돌아온다.
 * 이미 날짜(byMonthDay)나 n번째 요일(nth)을 정한 규칙은 그대로 둔다.
 */
export function withMonthDayAnchor(rule: RecurrenceRule, base: ISODate): RecurrenceRule {
  if (rule.freq !== 'monthly' && rule.freq !== 'yearly') return rule
  if (rule.byMonthDay !== undefined || rule.nth !== undefined) return rule
  return { ...rule, byMonthDay: parseYMD(base).day }
}

/**
 * 'completion' 기준 첫 후보. 요일 지정 없는 weekly는 완료일 + 7*interval일.
 * 요일이 있으면 (interval-1)주를 먼저 보낸 뒤 그 이후 첫 해당 요일(완료일 당일은 제외).
 */
export function completionBase(rule: RecurrenceRule, completedOn: ISODate): ISODate {
  const interval = intervalOf(rule)
  switch (rule.freq) {
    case 'daily':
      return addDays(completedOn, interval)
    case 'weekly': {
      if (!rule.byWeekday || rule.byWeekday.length === 0) return addDays(completedOn, 7 * interval)
      const base = addDays(completedOn, 7 * (interval - 1))
      for (let offset = 1; offset <= 7; offset++) {
        const candidate = addDays(base, offset)
        if (rule.byWeekday.includes(weekdayOf(candidate))) return candidate
      }
      return addDays(completedOn, 7 * interval)
    }
    case 'monthly':
      return addMonths(completedOn, interval)
    case 'yearly':
      return addYears(completedOn, interval)
  }
}
