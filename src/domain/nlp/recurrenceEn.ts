// 영어 반복 패턴: every day, every other day, every weekday, every mon,wed,fri, every 2 weeks, every! 3 days ...
import type { RecurrenceFreq, Weekday } from '../types'
import { buildDate, nextMonthDay } from './dateMath'
import { MONTH_EN_SOURCE, monthEn, NTH_EN, WEEKDAY_EN_SOURCE, weekdayEn } from './dateWords'
import { group, BEFORE_WORD, EN_END } from './scan'
import { makeRule, WEEKDAYS, WEEKEND, type RecurrenceBuild, type RecurrencePattern } from './recurrenceRule'
import type { ParseContext } from './types'

const WD_ITEM = `(?:${WEEKDAY_EN_SOURCE})(?![a-z])`
const WD_LIST = `${WD_ITEM}(?:\\s*(?:,|and|&|/)\\s*${WD_ITEM})*`
const EVERY = 'every(!)?\\s+'

const re = (source: string): RegExp => new RegExp(`${BEFORE_WORD}(?:${source})${EN_END}`, 'giu')

const anchorOf = (m: RegExpExecArray): 'due' | 'completion' => (group(m, 1) === '!' ? 'completion' : 'due')

const FREQ: Readonly<Record<string, RecurrenceFreq>> = {
  day: 'daily', week: 'weekly', month: 'monthly', year: 'yearly',
}

function wrap(rule: ReturnType<typeof makeRule>, startHint: RecurrenceBuild['startHint'] = null): RecurrenceBuild | null {
  return rule ? { rule, startHint } : null
}

function weekdaysIn(list: string): Weekday[] {
  const words = list.match(new RegExp(WEEKDAY_EN_SOURCE, 'giu')) ?? []
  return Array.from(new Set(words.map(weekdayEn))).sort((a, b) => a - b)
}

function everyUnit(m: RegExpExecArray, n: number, unitWord: string | undefined): RecurrenceBuild | null {
  const freq = FREQ[(unitWord ?? '').toLowerCase()]
  return freq ? wrap(makeRule(freq, n, {}, anchorOf(m))) : null
}

function yearlyMonthDay(m: RegExpExecArray, monthWord: string, day: number, ctx: ParseContext): RecurrenceBuild | null {
  const month = monthEn(monthWord)
  if (buildDate(2028, month, day) === null) return null
  return wrap(makeRule('yearly', 1, {}, anchorOf(m)), nextMonthDay(month, day, ctx.today))
}

export const ENGLISH_PATTERNS: readonly RecurrencePattern[] = [
  { re: re('everyday|daily'), build: () => wrap(makeRule('daily', 1)) },
  { re: re('weekly'), build: () => wrap(makeRule('weekly', 1)) },
  { re: re('monthly'), build: () => wrap(makeRule('monthly', 1)) },
  { re: re('yearly|annually'), build: () => wrap(makeRule('yearly', 1)) },
  {
    re: re(`${EVERY}(other\\s+)?(day|week|month|year)`),
    build: (m) => everyUnit(m, group(m, 2) ? 2 : 1, group(m, 3)),
  },
  {
    re: re(`${EVERY}(\\d{1,3})\\s+(day|week|month|year)s?`),
    build: (m) => everyUnit(m, Number(group(m, 2)), group(m, 3)),
  },
  {
    re: re(`${EVERY}weekdays?`),
    build: (m) => wrap(makeRule('weekly', 1, { byWeekday: [...WEEKDAYS] }, anchorOf(m))),
  },
  {
    re: re(`${EVERY}weekends?`),
    build: (m) => wrap(makeRule('weekly', 1, { byWeekday: [...WEEKEND] }, anchorOf(m))),
  },
  {
    re: re(`${EVERY}(${WD_LIST})`),
    build: (m) => wrap(makeRule('weekly', 1, { byWeekday: weekdaysIn(group(m, 2) ?? '') }, anchorOf(m))),
  },
  {
    re: re(`${EVERY}(?:month\\s+on\\s+the\\s+)?(\\d{1,2})(?:st|nd|rd|th)`),
    build: (m) => {
      const day = Number(group(m, 2))
      return day >= 1 && day <= 31 ? wrap(makeRule('monthly', 1, { byMonthDay: day }, anchorOf(m))) : null
    },
  },
  { re: re(`${EVERY}last\\s+day`), build: (m) => wrap(makeRule('monthly', 1, { byMonthDay: 'last' }, anchorOf(m))) },
  {
    re: re(`${EVERY}(first|second|third|fourth|last)\\s+(${WEEKDAY_EN_SOURCE})(?![a-z])`),
    build: (m) => {
      const n = NTH_EN[(group(m, 2) ?? '').toLowerCase()]
      return n === undefined ? null : wrap(makeRule('monthly', 1, { nth: { n, weekday: weekdayEn(group(m, 3) ?? '') } }, anchorOf(m)))
    },
  },
  {
    re: re(`${EVERY}(${MONTH_EN_SOURCE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?`),
    build: (m, ctx) => yearlyMonthDay(m, group(m, 2) ?? '', Number(group(m, 3)), ctx),
  },
  {
    re: re(`${EVERY}(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_EN_SOURCE})`),
    build: (m, ctx) => yearlyMonthDay(m, group(m, 3) ?? '', Number(group(m, 2)), ctx),
  },
]
