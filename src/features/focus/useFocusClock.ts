import { useEffect, useState } from 'react'
import { toISODate } from '../../domain/date'
import type { ISODate } from '../../domain/types'
import { useFocus } from './focusStore'

const TICK_MS = 250
const CALENDAR_REFRESH_MS = 60_000

/**
 * 화면 갱신과 완료 판정을 맡는 틱. 값을 세는 것이 아니라 "지금 시각"만 갱신한다.
 * 탭이 숨겨져 간격이 늘어져도 남은 시간은 타임스탬프로 계산하므로 틀어지지 않고,
 * 탭이 다시 보이는 즉시 한 번 더 판정한다.
 */
export function useFocusClock(): number {
  const isRunning = useFocus((s) => s.timer.phase === 'running')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const step = (): void => {
      const current = Date.now()
      setNow(current)
      useFocus.getState().tick(current)
    }
    step()
    if (!isRunning) return undefined
    const id = window.setInterval(step, TICK_MS)
    document.addEventListener('visibilitychange', step)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', step)
    }
  }, [isRunning])

  return now
}

/**
 * 달력상의 오늘. 집중 통계는 세션 시작 시각의 로컬 달력 날짜로 묶이므로(focusSummary),
 * 하루 시작 시각 설정과 무관하게 같은 기준으로 비교해야 오늘 칸이 어긋나지 않는다.
 */
export function useCalendarToday(): ISODate {
  const [today, setToday] = useState(() => toISODate(new Date()))
  useEffect(() => {
    const id = window.setInterval(() => setToday(toISODate(new Date())), CALENDAR_REFRESH_MS)
    return () => window.clearInterval(id)
  }, [])
  return today
}
