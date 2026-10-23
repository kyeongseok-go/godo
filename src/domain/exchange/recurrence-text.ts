// CSV 의 DATE 칸에 쓸 한국어 반복 설명. 반복 규칙을 사람이 읽는 문장으로 바꾼다.
import { fromISODate, weekdayOf } from '../date'
import type { ISODate, RecurrenceRule, TimeOfDay, Weekday } from '../types'

const WEEKDAY_SHORT = ['일', '월', '화', '수', '목', '금', '토'] as const
const NTH_LABEL: Readonly<Record<number, string>> = { 1: '첫째', 2: '둘째', 3: '셋째', 4: '넷째', [-1]: '마지막' }
const WEEKDAYS_ONLY: readonly Weekday[] = [1, 2, 3, 4, 5]

/** 월요일부터 세는 순서로 정렬하고 중복을 없앤다. */
function sortedMondayFirst(days: readonly Weekday[]): Weekday[] {
  const unique = [...new Set(days)]
  return unique.sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
}

function isWeekdaysOnly(days: readonly Weekday[]): boolean {
  return days.length === WEEKDAYS_ONLY.length && WEEKDAYS_ONLY.every((d) => days.includes(d))
}

function describeWeekly(rule: RecurrenceRule, startDate: ISODate | null): string {
  const explicit = sortedMondayFirst(rule.byWeekday ?? [])
  const days = explicit.length > 0 ? explicit : startDate ? [weekdayOf(startDate)] : []

  if (rule.interval === 1) {
    if (isWeekdaysOnly(days)) return '평일마다'
    if (days.length === 0) return '매주'
    return `매주 ${days.map((d) => WEEKDAY_SHORT[d]).join('·')}요일`
  }
  const prefix = `${rule.interval}주마다`
  if (isWeekdaysOnly(days)) return `${prefix} 평일`
  if (days.length === 0) return prefix
  return `${prefix} ${days.map((d) => WEEKDAY_SHORT[d]).join('·')}요일`
}

function describeMonthly(rule: RecurrenceRule, startDate: ISODate | null): string {
  const prefix = rule.interval === 1 ? '매월' : `${rule.interval}개월마다`
  if (rule.nth) return `${prefix} ${NTH_LABEL[rule.nth.n]} ${WEEKDAY_SHORT[rule.nth.weekday]}요일`
  if (rule.byMonthDay === 'last') return `${prefix} 말일`
  const day = rule.byMonthDay ?? (startDate ? fromISODate(startDate).getDate() : null)
  return day === null ? prefix : `${prefix} ${day}일`
}

function describeYearly(rule: RecurrenceRule, startDate: ISODate | null): string {
  const prefix = rule.interval === 1 ? '매년' : `${rule.interval}년마다`
  if (!startDate) return prefix
  const date = fromISODate(startDate)
  return `${prefix} ${date.getMonth() + 1}월 ${date.getDate()}일`
}

/** startDate 는 요일·일을 따로 지정하지 않은 규칙의 빈칸을 채울 때만 쓴다. */
export function describeRecurrence(rule: RecurrenceRule, startDate: ISODate | null): string {
  switch (rule.freq) {
    case 'daily':
      return rule.interval === 1 ? '매일' : `${rule.interval}일마다`
    case 'weekly':
      return describeWeekly(rule, startDate)
    case 'monthly':
      return describeMonthly(rule, startDate)
    case 'yearly':
      return describeYearly(rule, startDate)
  }
}

/** '15:30' -> '오후 3시 30분', '09:00' -> '오전 9시' */
export function formatKoreanTime(time: TimeOfDay): string {
  const [hour, minute] = time.split(':').map(Number)
  const period = hour < 12 ? '오전' : '오후'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return minute === 0 ? `${period} ${hour12}시` : `${period} ${hour12}시 ${minute}분`
}
