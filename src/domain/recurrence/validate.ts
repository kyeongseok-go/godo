// 규칙 검증과 UI 프리셋. 검증 메시지는 입력 폼에 그대로 보여 준다.
import { isISODate, weekdayOf } from '../date'
import type { ISODate, RecurrenceRule } from '../types'
import { parseYMD } from './calendar'

export type ValidationResult = { ok: true } | { ok: false; message: string }

const FREQS: readonly string[] = ['daily', 'weekly', 'monthly', 'yearly']
/** 반복 간격 상한. 1000년·1000개월까지면 실제 쓰임에는 충분하다. */
export const MAX_INTERVAL = 1000
const NTH_VALUES: readonly number[] = [1, 2, 3, 4, -1]

const fail = (message: string): ValidationResult => ({ ok: false, message })
const isWeekdayNumber = (v: unknown): boolean => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 6

function checkMonthly(rule: RecurrenceRule): ValidationResult | null {
  const { byMonthDay, nth } = rule
  if (byMonthDay !== undefined && byMonthDay !== 'last') {
    if (!Number.isInteger(byMonthDay) || byMonthDay < 1 || byMonthDay > 31) {
      return fail("매월 반복일은 1~31 사이의 날짜이거나 '말일'이어야 해요.")
    }
  }
  if (nth !== undefined) {
    if (!NTH_VALUES.includes(nth.n)) return fail('n번째 요일은 첫째~넷째 또는 마지막만 고를 수 있어요.')
    if (!isWeekdayNumber(nth.weekday)) return fail('요일은 일요일부터 토요일 사이여야 해요.')
    if (byMonthDay !== undefined) return fail('매월 반복은 날짜와 n번째 요일 중 하나만 고를 수 있어요.')
  }
  return null
}

function checkEnd(rule: RecurrenceRule): ValidationResult | null {
  if (rule.end.type === 'until' && !isISODate(rule.end.date)) return fail('종료 날짜가 올바르지 않아요.')
  if (rule.end.type === 'count' && (!Number.isInteger(rule.end.count) || rule.end.count < 1)) {
    return fail('반복 횟수는 1 이상의 정수여야 해요.')
  }
  return null
}

export function validateRule(rule: RecurrenceRule): ValidationResult {
  if (!FREQS.includes(rule.freq)) return fail('반복 주기가 올바르지 않아요.')
  if (!Number.isInteger(rule.interval) || rule.interval < 1) return fail('반복 간격은 1 이상의 정수여야 해요.')
  // 상한이 없으면 가져온 백업의 터무니없는 값이 'NaN-NaN-NaN' 같은 날짜를 만든다
  if (rule.interval > MAX_INTERVAL) return fail(`반복 간격은 ${MAX_INTERVAL} 이하여야 해요.`)
  if (rule.byWeekday && !rule.byWeekday.every(isWeekdayNumber)) {
    return fail('요일은 일요일부터 토요일 사이여야 해요.')
  }
  const problem = checkMonthly(rule) ?? checkEnd(rule)
  if (problem) return problem
  if (rule.doneCount !== undefined && (!Number.isInteger(rule.doneCount) || rule.doneCount < 0)) {
    return fail('완료 횟수는 0 이상의 정수여야 해요.')
  }
  if (rule.skipDates && !rule.skipDates.every(isISODate)) return fail('건너뛴 날짜가 올바르지 않아요.')
  return { ok: true }
}

export function presetRule(
  kind: 'daily' | 'weekly' | 'weekdays' | 'monthly' | 'yearly',
  startDate: ISODate,
): RecurrenceRule {
  const base = { interval: 1, anchor: 'due', end: { type: 'never' }, resetSubtasks: false } as const
  switch (kind) {
    case 'daily':
      return { ...base, freq: 'daily' }
    case 'weekly':
      return { ...base, freq: 'weekly', byWeekday: [weekdayOf(startDate)] }
    case 'weekdays':
      return { ...base, freq: 'weekly', byWeekday: [1, 2, 3, 4, 5] }
    case 'monthly':
      return { ...base, freq: 'monthly', byMonthDay: parseYMD(startDate).day }
    case 'yearly':
      return { ...base, freq: 'yearly' }
  }
}
