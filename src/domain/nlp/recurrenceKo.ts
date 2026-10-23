// 한국어 반복 패턴: 매일, 매주 월/수/금, 평일마다, 매월 25일, 매월 첫째 월요일, 매년 3월 2일, 3일마다 ...
import type { RecurrenceRule } from '../types'
import { buildDate, nextMonthDay } from './dateMath'
import { NTH_KO, WEEKDAY_KO_INDEX } from './dateWords'
import { group } from './scan'
import type { ParseContext } from './types'
import { makeRule, parseKoreanWeekdays, WEEKDAYS, WEEKEND, type RecurrenceBuild, type RecurrencePattern } from './recurrenceRule'

const WD = '[일월화수목금토]'
const ITEM = `(?:${WD}요일|${WD})`
const SEP = '(?:\\s*(?:,|/|·|、|과|와|및|그리고)\\s*)'
const LIST = `(?:${WD}{2,7}|${ITEM}(?:${SEP}${ITEM})*)`
const FULL_ITEM = `${WD}요일`
const FULL_LIST = `${FULL_ITEM}(?:${SEP}${FULL_ITEM})*`
const EVERY_WEEK = '(?:매\\s*주|매)'
const EVERY_MONTH = '(?:매\\s*월|매\\s*달)'
const END = '(?:에|은|는|도)?(?![\\p{L}\\p{N}])'
const BEFORE = '(?<![^\\s(\\[{"\'“‘,;])'
const NTH_WORDS = '첫째|둘째|셋째|넷째|첫\\s*번째|두\\s*번째|세\\s*번째|네\\s*번째|마지막'

const re = (source: string): RegExp => new RegExp(`${BEFORE}(?:${source})${END}`, 'gu')

const wrap = (rule: RecurrenceRule | null, startHint: RecurrenceBuild['startHint'] = null): RecurrenceBuild | null =>
  rule ? { rule, startHint } : null

const interval = (m: RegExpExecArray, i: number): number => Number(group(m, i))

function monthDayRule(day: number): RecurrenceBuild | null {
  return day >= 1 && day <= 31 ? wrap(makeRule('monthly', 1, { byMonthDay: day })) : null
}

function nthRule(m: RegExpExecArray): RecurrenceBuild | null {
  const n = NTH_KO[(group(m, 1) ?? '').replace(/\s+/g, '')]
  const weekday = WEEKDAY_KO_INDEX[group(m, 2) ?? '']
  return n === undefined || weekday === undefined ? null : wrap(makeRule('monthly', 1, { nth: { n, weekday } }))
}

function yearlyRule(m: RegExpExecArray, ctx: ParseContext): RecurrenceBuild | null {
  const month = group(m, 1) ?? group(m, 3)
  const day = group(m, 2) ?? group(m, 4)
  const rule = makeRule('yearly', 1)
  if (month === undefined || day === undefined) return wrap(rule)
  if (buildDate(2028, Number(month), Number(day)) === null) return null // 윤년 기준으로도 없는 날짜
  return wrap(rule, nextMonthDay(Number(month), Number(day), ctx.today))
}

function weeklyWithOptionalDays(m: RegExpExecArray, n: number, listGroup: number): RecurrenceBuild | null {
  const list = group(m, listGroup)
  return wrap(makeRule('weekly', n, list ? { byWeekday: parseKoreanWeekdays(list) } : {}))
}

export const KOREAN_PATTERNS: readonly RecurrencePattern[] = [
  // 매일 / 매일마다 / 날마다 / 격일 / N일마다
  { re: re('매일(?:\\s*마다)?|날마다|매일매일'), build: () => wrap(makeRule('daily', 1)) },
  { re: re('격일'), build: () => wrap(makeRule('daily', 2)) },
  { re: re('(\\d{1,3})\\s*일\\s*마다'), build: (m) => wrap(makeRule('daily', interval(m, 1))) },
  // 평일·주말
  {
    re: re(`(?:매\\s*주|매일|매)\\s*평일(?:\\s*마다)?|평일\\s*마다`),
    build: () => wrap(makeRule('weekly', 1, { byWeekday: [...WEEKDAYS] })),
  },
  {
    re: re(`${EVERY_WEEK}\\s*주말(?:\\s*마다)?|주말\\s*마다`),
    build: () => wrap(makeRule('weekly', 1, { byWeekday: [...WEEKEND] })),
  },
  // 매주 / 매주 월·수·금 / 월요일마다
  {
    // 약칭(월/수/금)은 '매주' 뒤에서만 읽는다. '매월'의 '월'을 월요일로 오해하지 않으려는 것이다.
    re: re(`매\\s*주\\s*(${LIST})(?:\\s*마다)?`),
    build: (m) => wrap(makeRule('weekly', 1, { byWeekday: parseKoreanWeekdays(group(m, 1) ?? '') })),
  },
  {
    re: re(`매\\s*(${FULL_LIST})(?:\\s*마다)?`),
    build: (m) => wrap(makeRule('weekly', 1, { byWeekday: parseKoreanWeekdays(group(m, 1) ?? '') })),
  },
  { re: re(`(${FULL_LIST})\\s*마다`), build: (m) => wrap(makeRule('weekly', 1, { byWeekday: parseKoreanWeekdays(group(m, 1) ?? '') })) },
  { re: re('매\\s*주(?:\\s*마다)?'), build: () => wrap(makeRule('weekly', 1)) },
  // 격주 / N주마다 (+ 요일)
  { re: re(`격주(?:\\s*(?:매주\\s*)?(${LIST}))?`), build: (m) => weeklyWithOptionalDays(m, 2, 1) },
  {
    re: re(`(\\d{1,3})\\s*주(?:일)?\\s*마다(?:\\s*(?:매주\\s*)?(${LIST}))?`),
    build: (m) => weeklyWithOptionalDays(m, interval(m, 1), 2),
  },
  // 매월 …
  {
    re: re(`${EVERY_MONTH}\\s*(\\d{1,2})\\s*일(?![차째간])(?:\\s*마다)?`),
    build: (m) => monthDayRule(interval(m, 1)),
  },
  {
    re: re(`${EVERY_MONTH}\\s*(?:마지막\\s*날|말일|말|끝)`),
    build: () => wrap(makeRule('monthly', 1, { byMonthDay: 'last' })),
  },
  { re: re(`${EVERY_MONTH}\\s*(${NTH_WORDS})\\s*(?:주\\s*)?(${WD})요일`), build: nthRule },
  { re: re(`${EVERY_MONTH}(?:\\s*마다)?`), build: () => wrap(makeRule('monthly', 1)) },
  { re: re('(\\d{1,3})\\s*(?:개월|달)\\s*마다'), build: (m) => wrap(makeRule('monthly', interval(m, 1))) },
  { re: re('격월'), build: () => wrap(makeRule('monthly', 2)) },
  // 매년 …
  {
    re: re('(?:매\\s*년|해마다|매해)(?:\\s*(?:(\\d{1,2})\\s*월\\s*(\\d{1,2})\\s*일|(\\d{1,2})\\/(\\d{1,2})))?'),
    build: yearlyRule,
  },
  { re: re('(\\d{1,3})\\s*년\\s*마다'), build: (m) => wrap(makeRule('yearly', interval(m, 1))) },
]
