import { WEEKDAY_KO, daysBetween, fromISODate } from '../date'
import type { ISODate } from '../types'

/**
 * 날짜 그룹 제목. 어제·오늘·내일은 말로, 나머지는 "10월 26일 월요일".
 * 올해가 아니면 연도를 붙인다("2025년 10월 25일 토요일").
 */
export function formatGroupDate(date: ISODate, today: ISODate): string {
  const diff = daysBetween(today, date)
  if (diff === 0) return '오늘'
  if (diff === 1) return '내일'
  if (diff === -1) return '어제'

  const d = fromISODate(date)
  const base = `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAY_KO[d.getDay()]}요일`
  const sameYear = d.getFullYear() === fromISODate(today).getFullYear()
  return sameYear ? base : `${d.getFullYear()}년 ${base}`
}
