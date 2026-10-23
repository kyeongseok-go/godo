import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { todayOf } from '../domain/date'
import type { EngineContext, ISODate, Settings } from '../domain/types'
import { useApp } from '../store/app'
import type { TableMap, TableName } from '../store/changes'

/** 테이블을 배열로 돌려준다. 레코드 참조가 같으면 같은 배열을 재사용해 불필요한 재렌더를 막는다. */
export function useTable<K extends TableName>(name: K): TableMap[K][] {
  const record = useApp((s) => s.entities[name]) as Record<string, TableMap[K]>
  return useMemo(() => Object.values(record), [record])
}

export function useSettings(): Settings {
  return useApp((s) => s.settings)
}

/** 일정 간격으로 갱신되는 현재 시각. 분 단위 화면(현재 시각선 등)에 쓴다. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

const TODAY_CHECK_MS = 30_000

// 모든 useToday 사용처가 타이머 하나를 나눠 쓴다. 마지막 구독자가 빠지면 타이머도 멈춘다.
const todayListeners = new Set<() => void>()
let todayTimer: ReturnType<typeof setInterval> | undefined

function subscribeToday(listener: () => void): () => void {
  todayListeners.add(listener)
  todayTimer ??= setInterval(() => todayListeners.forEach((notify) => notify()), TODAY_CHECK_MS)
  return () => {
    todayListeners.delete(listener)
    if (todayListeners.size === 0 && todayTimer !== undefined) {
      clearInterval(todayTimer)
      todayTimer = undefined
    }
  }
}

/**
 * 오늘 날짜. 하루 시작 시각 설정을 따르고, 자정을 넘기면 자동으로 바뀐다.
 * 값이 문자열이라 하루가 바뀔 때만 재렌더된다(분 단위 시각이 필요하면 `useNow`).
 */
export function useToday(): ISODate {
  const dayStartHour = useApp((s) => s.settings.dayStartHour)
  return useSyncExternalStore(subscribeToday, () => todayOf(new Date(), dayStartHour))
}

export function useEngineContext(): EngineContext {
  const tasks = useTable('tasks')
  const projects = useTable('projects')
  const sections = useTable('sections')
  const labels = useTable('labels')
  const weekStartsOn = useApp((s) => s.settings.weekStartsOn)
  const today = useToday()
  return useMemo(
    () => ({ today, now: new Date(), weekStartsOn, projects, sections, labels, tasks }),
    [today, weekStartsOn, projects, sections, labels, tasks],
  )
}
