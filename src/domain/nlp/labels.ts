// 칩에 보일 한국어 요약 문구.
import { daysBetween, fromISODate, WEEKDAY_KO } from '../date'
import type { ISODate } from '../types'

const RELATIVE_LABEL: Readonly<Record<number, string>> = { [-1]: '어제', 0: '오늘', 1: '내일', 2: '모레' }

/** 예: "내일 · 10/24(토)", "10/30(금)", 다른 해면 "2027/3/2(화)" */
export function describeDate(date: ISODate, today: ISODate): string {
  const d = fromISODate(date)
  const sameYear = d.getFullYear() === fromISODate(today).getFullYear()
  const md = `${sameYear ? '' : `${d.getFullYear()}/`}${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_KO[d.getDay()]})`
  const relative = RELATIVE_LABEL[daysBetween(today, date)]
  return relative ? `${relative} · ${md}` : md
}
