// 화면에 보이는 날짜·시간 문구. 전부 한국어.
import { daysBetween, fromISODate, WEEKDAY_KO } from './date'
import type { ISODate, TimeOfDay } from './types'

const WEEKDAY_LONG = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'] as const

/** 오늘 기준 상대 표현. 가까우면 단어(오늘/내일), 일주일 안이면 요일, 그 밖에는 월일(요일). */
export function describeDate(date: ISODate, today: ISODate): string {
  const diff = daysBetween(today, date)
  if (diff === 0) return '오늘'
  if (diff === 1) return '내일'
  if (diff === -1) return '어제'
  const d = fromISODate(date)
  if (diff > 1 && diff < 7) return WEEKDAY_LONG[d.getDay()]
  const sameYear = d.getFullYear() === fromISODate(today).getFullYear()
  const md = `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY_KO[d.getDay()]})`
  return sameYear ? md : `${d.getFullYear()}년 ${md}`
}

/** 날짜 칩 색을 정하는 분류 */
export type DateTone = 'overdue' | 'today' | 'soon' | 'later'

export function dateTone(date: ISODate, today: ISODate): DateTone {
  const diff = daysBetween(today, date)
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  if (diff <= 7) return 'soon'
  return 'later'
}

export function formatTime(time: TimeOfDay, format: '12h' | '24h'): string {
  if (format === '24h') return time
  const [h, m] = time.split(':').map(Number)
  const meridiem = h < 12 ? '오전' : '오후'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${meridiem} ${hour12}:${String(m).padStart(2, '0')}`
}

export function formatDuration(minutes: number): string {
  const total = Math.round(minutes)
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}분`
  if (m === 0) return `${h}시간`
  return `${h}시간 ${m}분`
}

/** 'YYYY년 M월' 같은 달력 머리글 */
export function formatMonthTitle(date: ISODate): string {
  const d = fromISODate(date)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`
}

/** '10월 24일 (토)' 같은 하루 머리글 */
export function formatDayTitle(date: ISODate): string {
  const d = fromISODate(date)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY_KO[d.getDay()]})`
}
