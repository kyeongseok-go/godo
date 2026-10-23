// 디데이 화면용 순수 계산: 가까운 순 정렬과 지난 항목 분리, 날짜 문구.
import { fromISODate, isISODate, WEEKDAY_KO } from '../../domain/date'
import { countdownInfo, nextCountdownDate } from '../../domain/stats'
import type { Countdown, ISODate } from '../../domain/types'
import type { CountdownInput } from './commands'

export interface CountdownEntry {
  countdown: Countdown
  info: ReturnType<typeof countdownInfo>
  /** 매년 반복이면 다음 기념일, 아니면 저장된 날짜 */
  nextDate: ISODate
}

/** 오늘 이후(오늘 포함)는 가까운 순, 지난 일회성 항목은 최근에 지난 순으로 나눈다. */
export function splitCountdowns(
  countdowns: readonly Countdown[],
  today: ISODate,
): { upcoming: CountdownEntry[]; passed: CountdownEntry[] } {
  const entries = countdowns.map<CountdownEntry>((countdown) => ({
    countdown,
    info: countdownInfo(countdown, today),
    nextDate: nextCountdownDate(countdown, today),
  }))
  const upcoming = entries
    .filter((e) => !e.info.passed)
    .sort((a, b) => a.info.daysLeft - b.info.daysLeft || a.countdown.order - b.countdown.order)
  const passed = entries
    .filter((e) => e.info.passed)
    .sort((a, b) => b.info.daysLeft - a.info.daysLeft || a.countdown.order - b.countdown.order)
  return { upcoming, passed }
}

export function describeCountdownDate(date: ISODate): string {
  const d = fromISODate(date)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAY_KO[d.getDay()]}요일`
}

export interface CountdownExample {
  name: string
  repeatYearly: boolean
  color: string
}

/** 빈 상태에서 제안하는 예시. 날짜는 사용자가 정하므로 만들기 창을 미리 채워서 연다. */
export const COUNTDOWN_EXAMPLES: readonly CountdownExample[] = [
  { name: '생일', repeatYearly: true, color: '#c2185b' },
  { name: '기념일', repeatYearly: true, color: '#d9421c' },
  { name: '시험', repeatYearly: false, color: '#2b4c7e' },
]

export const describeRepeat = (repeatYearly: boolean): string => (repeatYearly ? '매년 반복' : '')

/** 폼 입력의 첫 번째 문제를 한국어로 돌려준다. 없으면 null. */
export function validateCountdownDraft(draft: CountdownInput): string | null {
  if (draft.name.trim() === '') return '이름을 입력해 주세요'
  if (!isISODate(draft.date)) return '날짜를 정해 주세요'
  return null
}
