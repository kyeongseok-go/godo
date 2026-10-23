// 반복 규칙의 한국어 설명. 화면에 그대로 보이는 문구다.
import { WEEKDAY_KO, weekdayOf } from '../date'
import type { ISODate, RecurrenceRule, Weekday } from '../types'
import { mondayIndex, parseYMD } from './calendar'
import { intervalOf } from './steps'

const WEEKDAYS_ONLY: readonly number[] = [1, 2, 3, 4, 5]
const NTH_KO: Record<number, string> = { 1: '첫째', 2: '둘째', 3: '셋째', 4: '넷째', [-1]: '마지막' }

/** 주기 + 간격 표현. 간격이 1이면 "매일", 그 외는 "N일마다". */
function everyPhrase(rule: RecurrenceRule): string {
  const interval = intervalOf(rule)
  const unit = { daily: '일', weekly: '주', monthly: '개월', yearly: '년' }[rule.freq]
  const every = { daily: '매일', weekly: '매주', monthly: '매월', yearly: '매년' }[rule.freq]
  return interval === 1 ? every : `${interval}${unit}마다`
}

function weekdaysPhrase(rule: RecurrenceRule, startDate?: ISODate): string {
  const given = rule.byWeekday ?? []
  const days: Weekday[] = given.length > 0 ? [...new Set(given)] : startDate ? [weekdayOf(startDate)] : []
  if (days.length === 0) return ''
  const sorted = [...days].sort((a, b) => mondayIndex(a) - mondayIndex(b))
  if (sorted.length === 5 && sorted.every((d, i) => d === WEEKDAYS_ONLY[i])) return '평일'
  if (sorted.length === 1) return `${WEEKDAY_KO[sorted[0]]}요일`
  return sorted.map((d) => WEEKDAY_KO[d]).join('·')
}

function monthDayPhrase(rule: RecurrenceRule, startDate?: ISODate): string {
  if (rule.nth) return `${NTH_KO[rule.nth.n]} ${WEEKDAY_KO[rule.nth.weekday]}요일`
  if (rule.byMonthDay === 'last') return '마지막 날'
  if (rule.byMonthDay !== undefined) return `${rule.byMonthDay}일`
  return startDate ? `${parseYMD(startDate).day}일` : ''
}

function yearDayPhrase(startDate?: ISODate): string {
  if (!startDate) return ''
  const { month, day } = parseYMD(startDate)
  return `${month}월 ${day}일`
}

function detailPhrase(rule: RecurrenceRule, startDate?: ISODate): string {
  switch (rule.freq) {
    case 'weekly':
      return weekdaysPhrase(rule, startDate)
    case 'monthly':
      return monthDayPhrase(rule, startDate)
    case 'yearly':
      return yearDayPhrase(startDate)
    case 'daily':
      return ''
  }
}

function endSuffix(rule: RecurrenceRule): string {
  if (rule.end.type === 'until') return ` · ${rule.end.date}까지`
  if (rule.end.type === 'count') return ` · ${rule.end.count}회`
  return ''
}

export function describeRule(rule: RecurrenceRule, startDate?: ISODate): string {
  const detail = detailPhrase(rule, startDate)
  // 평일 전체는 "매주 평일"이 아니라 "평일마다"로 읽는다.
  const isWeekdays = rule.freq === 'weekly' && detail === '평일'
  const body =
    isWeekdays && intervalOf(rule) === 1 ? '평일마다' : [everyPhrase(rule), detail].filter(Boolean).join(' ')
  const prefix = rule.anchor === 'completion' ? '완료한 날부터 ' : ''
  return `${prefix}${body}${endSuffix(rule)}`
}
