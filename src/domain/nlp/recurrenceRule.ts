// 반복 패턴 후보의 공통 타입과 규칙 생성 도구.
import type { ISODate, RecurrenceFreq, RecurrenceRule, Weekday } from '../types'
import { WEEKDAY_KO_INDEX } from './dateWords'
import type { Span } from './scan'
import type { ParseContext } from './types'

export interface RecurrenceCandidate extends Span {
  rule: RecurrenceRule
  /** 구절 안에 날짜가 들어 있을 때(매년 3월 2일)의 첫 회차 */
  startHint: ISODate | null
}

export interface RecurrenceBuild {
  rule: RecurrenceRule
  startHint?: ISODate | null
}

export interface RecurrencePattern {
  re: RegExp
  build: (m: RegExpExecArray, ctx: ParseContext) => RecurrenceBuild | null
}

export const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5]
export const WEEKEND: readonly Weekday[] = [0, 6]

type RuleExtras = Pick<RecurrenceRule, 'byWeekday' | 'byMonthDay' | 'nth'>

/** 종료 없음·하위 작업 유지·마감일 기준이 기본값인 규칙. interval이 1 미만이면 null. */
export function makeRule(
  freq: RecurrenceFreq,
  interval: number,
  extras: RuleExtras = {},
  anchor: RecurrenceRule['anchor'] = 'due',
): RecurrenceRule | null {
  if (!Number.isInteger(interval) || interval < 1) return null
  return { freq, interval, ...extras, anchor, end: { type: 'never' }, resetSubtasks: false }
}

/** "월/수/금", "월요일과 수요일", "월수금" 같은 목록에서 요일 번호를 뽑아 정렬·중복 제거한다. */
export function parseKoreanWeekdays(list: string): Weekday[] {
  const days = Array.from(list.matchAll(/([일월화수목금토])(?:요일)?/g)).map(
    (m) => WEEKDAY_KO_INDEX[m[1]] ?? 0,
  )
  return Array.from(new Set(days)).sort((a, b) => a - b)
}
