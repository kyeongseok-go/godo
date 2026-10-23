// 반복 규칙을 칩에 보일 한국어로 풀어 쓴다.
import { WEEKDAY_KO } from '../date'
import type { RecurrenceRule, Weekday } from '../types'

const NTH_LABEL: Readonly<Record<number, string>> = { 1: '첫째', 2: '둘째', 3: '셋째', 4: '넷째', [-1]: '마지막' }

function sameDays(a: readonly Weekday[], b: readonly Weekday[]): boolean {
  return a.length === b.length && a.every((d, i) => d === b[i])
}

function weeklyLabel(rule: RecurrenceRule): string {
  const days = rule.byWeekday ?? []
  if (rule.interval === 1 && sameDays(days, [1, 2, 3, 4, 5])) return '평일마다'
  if (rule.interval === 1 && sameDays(days, [0, 6])) return '주말마다'
  const names = days.length === 1 ? `${WEEKDAY_KO[days[0]]}요일` : days.map((d) => WEEKDAY_KO[d]).join('·')
  if (rule.interval === 1) return names ? `매주 ${names}` : '매주'
  return names ? `${rule.interval}주마다 ${names}` : `${rule.interval}주마다`
}

function monthlyLabel(rule: RecurrenceRule): string {
  if (rule.interval > 1) return `${rule.interval}개월마다`
  if (rule.byMonthDay === 'last') return '매월 마지막 날'
  if (typeof rule.byMonthDay === 'number') return `매월 ${rule.byMonthDay}일`
  if (rule.nth) return `매월 ${NTH_LABEL[rule.nth.n]} ${WEEKDAY_KO[rule.nth.weekday]}요일`
  return '매월'
}

function baseLabel(rule: RecurrenceRule): string {
  switch (rule.freq) {
    case 'daily':
      return rule.interval === 1 ? '매일' : `${rule.interval}일마다`
    case 'weekly':
      return weeklyLabel(rule)
    case 'monthly':
      return monthlyLabel(rule)
    case 'yearly':
      return rule.interval === 1 ? '매년' : `${rule.interval}년마다`
  }
}

export function describeRecurrence(rule: RecurrenceRule): string {
  const base = baseLabel(rule)
  return rule.anchor === 'completion' ? `완료 후 ${base}` : base
}
