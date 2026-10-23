// 날짜 구절 후보 수집. 패턴마다 정규식과 해석 함수를 짝지어 두고, 입력 전체에서 모든 후보를 모은다.
import { addDays, addMonths, addYears } from '../date'
import type { ISODate, Weekday } from '../types'
import { buildDate, dayOfMonth, endOfMonth, nextMonthDay, nextWeekdayAfter, weekBased } from './dateMath'
import {
  MONTH_EN_SOURCE,
  monthEn,
  RELATIVE_OFFSET,
  WEEKDAY_EN_FULL_SOURCE,
  WEEKDAY_EN_SOURCE,
  WEEKDAY_KO_INDEX,
  weekdayEn,
} from './dateWords'
import { allMatches, BEFORE_WORD, EN_END, group, KO_END, type Span } from './scan'
import type { ParseContext } from './types'

export interface DateCandidate extends Span {
  date: ISODate
}

interface DatePattern {
  re: RegExp
  resolve: (m: RegExpExecArray, ctx: ParseContext) => ISODate | null
}

const ko = (source: string): RegExp => new RegExp(`${BEFORE_WORD}(?:${source})${KO_END}`, 'giu')
const en = (source: string): RegExp => new RegExp(`${BEFORE_WORD}(?:${source})${EN_END}`, 'giu')

const num = (m: RegExpExecArray, i: number): number => Number(group(m, i))
const KO_WD = '[일월화수목금토]'
const NOT_COUNTER = '(?![차째간])'

const RELATIVE_WORDS: Readonly<Record<string, number>> = {
  오늘: 0, 내일: 1, 모레: 2, 내일모레: 2, 글피: 3, 그글피: 4, 어제: -1, 그저께: -2, 그제: -2,
  today: 0, tomorrow: 1, tmrw: 1, tmr: 1, yesterday: -1,
}

const NAMED_OFFSETS: Readonly<Record<string, { unit: 'day' | 'month'; n: number }>> = {
  일주일: { unit: 'day', n: 7 },
  이주일: { unit: 'day', n: 14 },
  하루: { unit: 'day', n: 1 },
  이틀: { unit: 'day', n: 2 },
  사흘: { unit: 'day', n: 3 },
  나흘: { unit: 'day', n: 4 },
  한달: { unit: 'month', n: 1 },
  두달: { unit: 'month', n: 2 },
  세달: { unit: 'month', n: 3 },
  석달: { unit: 'month', n: 3 },
}

function shiftBy(today: ISODate, unit: 'day' | 'week' | 'month' | 'year', n: number): ISODate {
  switch (unit) {
    case 'day':
      return addDays(today, n)
    case 'week':
      return addDays(today, n * 7)
    case 'month':
      return addMonths(today, n)
    case 'year':
      return addYears(today, n)
  }
}

function weekdayKo(ch: string | undefined): Weekday | null {
  return ch === undefined ? null : (WEEKDAY_KO_INDEX[ch] ?? null)
}

const UNIT_EN: Readonly<Record<string, 'day' | 'week' | 'month' | 'year'>> = {
  day: 'day', week: 'week', month: 'month', year: 'year',
}

function resolveMonthDay(month: number, day: number, ctx: ParseContext): ISODate | null {
  return nextMonthDay(month, day, ctx.today)
}

function resolveEnglishMonthDay(monthWord: string, day: number, year: string | undefined, ctx: ParseContext): ISODate | null {
  const month = monthEn(monthWord)
  return year ? buildDate(Number(year), month, day) : resolveMonthDay(month, day, ctx)
}

const NOT_TIME_AFTER = '(?![\\d:])(?!\\s?[ap]m(?![A-Za-z]))'
const EN_YEAR = '(?:,?\\s+(\\d{4})(?!\\d))?'

const PATTERNS: readonly DatePattern[] = [
  // 오늘·내일·모레 …
  {
    re: ko('(오늘|내일모레|내일|모레|그글피|글피|어제|그저께|그제)'),
    resolve: (m, ctx) => addDays(ctx.today, RELATIVE_WORDS[group(m, 1) ?? ''] ?? 0),
  },
  // 이번 주 금요일 / 다음주 수 / 다다음 주 월요일
  {
    re: ko(`(이번|다음|다다음|담|지난|저번)\\s*주\\s*(?:(${KO_WD})요일|([월화수목금토]))`),
    resolve: (m, ctx) => {
      const weekday = weekdayKo(group(m, 2) ?? group(m, 3))
      return weekday === null
        ? null
        : weekBased(ctx.today, RELATIVE_OFFSET[group(m, 1) ?? ''] ?? 0, weekday, ctx.weekStartsOn)
    },
  },
  // 이번 토요일 / 다음 월요일 (주 생략)
  {
    re: ko(`(이번|다음)\\s*(${KO_WD})요일`),
    resolve: (m, ctx) => {
      const weekday = weekdayKo(group(m, 2))
      return weekday === null
        ? null
        : weekBased(ctx.today, RELATIVE_OFFSET[group(m, 1) ?? ''] ?? 0, weekday, ctx.weekStartsOn)
    },
  },
  // 주말: 이번 토요일. 이미 주말 한가운데(일요일)면 오늘.
  {
    re: ko('(?:(이번|다음|다다음)\\s*)?주말'),
    resolve: (m, ctx) => {
      const offset = RELATIVE_OFFSET[group(m, 1) ?? '이번'] ?? 0
      const saturday = weekBased(ctx.today, offset, 6, ctx.weekStartsOn)
      return offset === 0 && saturday < ctx.today ? ctx.today : saturday
    },
  },
  // 요일 단독: 오늘 다음 날부터 가장 가까운 그 요일
  {
    re: ko(`(${KO_WD})요일`),
    resolve: (m, ctx) => {
      const weekday = weekdayKo(group(m, 1))
      return weekday === null ? null : nextWeekdayAfter(ctx.today, weekday)
    },
  },
  // N일/주/개월/년 후·뒤
  {
    re: ko('(\\d{1,4})\\s*일\\s*(?:후|뒤)'),
    resolve: (m, ctx) => shiftBy(ctx.today, 'day', num(m, 1)),
  },
  {
    re: ko('(\\d{1,3})\\s*주(?:일)?\\s*(?:후|뒤)'),
    resolve: (m, ctx) => shiftBy(ctx.today, 'week', num(m, 1)),
  },
  {
    re: ko('(\\d{1,3})\\s*(?:개월|달)\\s*(?:후|뒤)'),
    resolve: (m, ctx) => shiftBy(ctx.today, 'month', num(m, 1)),
  },
  {
    re: ko('(\\d{1,2})\\s*년\\s*(?:후|뒤)'),
    resolve: (m, ctx) => shiftBy(ctx.today, 'year', num(m, 1)),
  },
  {
    re: ko('(일주일|이주일|하루|이틀|사흘|나흘|한\\s*달|두\\s*달|세\\s*달|석\\s*달)\\s*(?:후|뒤)'),
    resolve: (m, ctx) => {
      const named = NAMED_OFFSETS[(group(m, 1) ?? '').replace(/\s+/g, '')]
      return named ? shiftBy(ctx.today, named.unit, named.n) : null
    },
  },
  // 2027년 1월 5일 / 10월 30일 / 12/25 / 2026-12-31
  {
    re: ko(`(\\d{4})\\s*년\\s*(\\d{1,2})\\s*월\\s*(\\d{1,2})\\s*일${NOT_COUNTER}`),
    resolve: (m) => buildDate(num(m, 1), num(m, 2), num(m, 3)),
  },
  {
    re: ko(`(\\d{1,2})\\s*월\\s*(\\d{1,2})\\s*일${NOT_COUNTER}`),
    resolve: (m, ctx) => resolveMonthDay(num(m, 1), num(m, 2), ctx),
  },
  {
    re: ko('(\\d{1,2})\\/(\\d{1,2})(?![\\d\\/])'),
    resolve: (m, ctx) => resolveMonthDay(num(m, 1), num(m, 2), ctx),
  },
  {
    re: ko('(\\d{4})([-/.])(\\d{1,2})\\2(\\d{1,2})(?!\\d)'),
    resolve: (m) => buildDate(num(m, 1), num(m, 3), num(m, 4)),
  },
  // 이번 달 5일 / 다음 달 말일 / 월말
  {
    re: ko(`(이번|다음|다다음)\\s*달\\s*(\\d{1,2})\\s*일${NOT_COUNTER}`),
    resolve: (m, ctx) => dayOfMonth(ctx.today, RELATIVE_OFFSET[group(m, 1) ?? ''] ?? 0, num(m, 2)),
  },
  {
    re: ko('(이번|다음|다다음)\\s*달\\s*(?:말일|마지막\\s*날|말)'),
    resolve: (m, ctx) => endOfMonth(ctx.today, RELATIVE_OFFSET[group(m, 1) ?? ''] ?? 0),
  },
  {
    re: ko('월말|말일'),
    resolve: (_m, ctx) => endOfMonth(ctx.today, 0),
  },
  // English
  {
    re: en('(today|tomorrow|tmrw|tmr|yesterday)'),
    resolve: (m, ctx) => addDays(ctx.today, RELATIVE_WORDS[(group(m, 1) ?? '').toLowerCase()] ?? 0),
  },
  {
    re: en(`(next|this)\\s+(${WEEKDAY_EN_SOURCE})`),
    resolve: (m, ctx) =>
      weekBased(ctx.today, (group(m, 1) ?? '').toLowerCase() === 'next' ? 1 : 0, weekdayEn(group(m, 2) ?? ''), ctx.weekStartsOn),
  },
  {
    re: en(`(?:on\\s+)?(${WEEKDAY_EN_FULL_SOURCE})`),
    resolve: (m, ctx) => nextWeekdayAfter(ctx.today, weekdayEn(group(m, 1) ?? '')),
  },
  {
    re: en('in\\s+(\\d{1,4})\\s+(day|week|month|year)s?'),
    resolve: (m, ctx) => shiftBy(ctx.today, UNIT_EN[(group(m, 2) ?? '').toLowerCase()] ?? 'day', num(m, 1)),
  },
  {
    re: en(`(?:on\\s+)?(${MONTH_EN_SOURCE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?${EN_YEAR}${NOT_TIME_AFTER}`),
    resolve: (m, ctx) => resolveEnglishMonthDay(group(m, 1) ?? '', num(m, 2), group(m, 3), ctx),
  },
  {
    re: en(`(?:on\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_EN_SOURCE})\\b${EN_YEAR}`),
    resolve: (m, ctx) => resolveEnglishMonthDay(group(m, 2) ?? '', num(m, 1), group(m, 3), ctx),
  },
]

/** text 안의 모든 날짜 후보를 시작 위치 순, 같은 시작이면 긴 것 먼저 돌려준다. */
export function findDateCandidates(text: string, ctx: ParseContext): DateCandidate[] {
  const found: DateCandidate[] = []
  for (const pattern of PATTERNS) {
    for (const m of allMatches(pattern.re, text)) {
      const date = pattern.resolve(m, ctx)
      if (date) found.push({ start: m.index, end: m.index + m[0].length, date })
    }
  }
  return found.sort((a, b) => a.start - b.start || b.end - a.end)
}
