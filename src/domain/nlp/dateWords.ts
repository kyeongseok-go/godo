// 날짜 단어 사전.
import type { Weekday } from '../types'

export const WEEKDAY_KO_INDEX: Readonly<Record<string, Weekday>> = {
  일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6,
}

export const WEEKDAY_EN_INDEX: Readonly<Record<string, Weekday>> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
}

export const MONTH_EN_INDEX: Readonly<Record<string, number>> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

export const WEEKDAY_EN_SOURCE =
  'monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat|sunday|sun'

export const WEEKDAY_EN_FULL_SOURCE = 'monday|tuesday|wednesday|thursday|friday|saturday|sunday'

export const MONTH_EN_SOURCE =
  'january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec'

export function weekdayEn(word: string): Weekday {
  return WEEKDAY_EN_INDEX[word.slice(0, 3).toLowerCase()] ?? 0
}

export function monthEn(word: string): number {
  return MONTH_EN_INDEX[word.slice(0, 3).toLowerCase()] ?? 1
}

/** "이번/다음/다다음/지난" 같은 주·달 상대어를 오프셋으로 */
export const RELATIVE_OFFSET: Readonly<Record<string, number>> = {
  이번: 0, 다음: 1, 다다음: 2, 담: 1, 지난: -1, 저번: -1,
}

export const NTH_KO: Readonly<Record<string, 1 | 2 | 3 | 4 | -1>> = {
  첫째: 1, 첫번째: 1, 둘째: 2, 두번째: 2, 셋째: 3, 세번째: 3, 넷째: 4, 네번째: 4, 마지막: -1,
}

export const NTH_EN: Readonly<Record<string, 1 | 2 | 3 | 4 | -1>> = {
  first: 1, second: 2, third: 3, fourth: 4, last: -1,
}
