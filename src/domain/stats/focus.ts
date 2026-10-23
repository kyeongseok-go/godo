import type { FocusSession, ID, ISODate, Task } from '../types'
import { localDateOf } from './shared'

// 규칙
// - 세션 길이는 세션마다 분 단위로 반올림한다(30초는 1분으로 올림). 집계와 작업 기록이 같은 값을 쓰도록 공유한다.
// - 날짜는 시작 시각(startedAt)의 로컬 날짜. 자정을 넘긴 세션은 시작한 날에 전부 넣는다.

function sessionMinutes(session: FocusSession): number {
  const min = Math.round(session.durationSec / 60)
  return Number.isFinite(min) ? Math.max(0, min) : 0
}

export function focusSummary(
  sessions: readonly FocusSession[],
  today: ISODate,
): {
  todayMin: number
  todayCount: number
  totalMin: number
  totalCount: number
  byDay: Array<{ date: ISODate; min: number }>
  byTask: Array<{ taskId: ID | null; min: number }>
} {
  const dayMin = new Map<ISODate, number>()
  const taskMin = new Map<ID | null, number>()
  let totalMin = 0
  let totalCount = 0
  let todayCount = 0

  for (const session of sessions) {
    if (!session.completed) continue
    const min = sessionMinutes(session)
    const date = localDateOf(session.startedAt)
    totalMin += min
    totalCount += 1
    if (date === today) todayCount += 1
    dayMin.set(date, (dayMin.get(date) ?? 0) + min)
    taskMin.set(session.taskId, (taskMin.get(session.taskId) ?? 0) + min)
  }

  const byDay = [...dayMin.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([date, min]) => ({ date, min }))
  // 분이 같으면 처음 등장한 순서를 유지한다(Array.sort 는 안정 정렬).
  const byTask = [...taskMin.entries()].map(([taskId, min]) => ({ taskId, min })).sort((a, b) => b.min - a.min)

  return { todayMin: dayMin.get(today) ?? 0, todayCount, totalMin, totalCount, byDay, byTask }
}

/**
 * 끝난 집중 세션의 시간을 작업의 날짜별 실제 시간(actualMin)에 더한다.
 * 반올림하고 1분 미만이면 아무것도 더하지 않고 작업을 그대로 돌려준다.
 * 어떤 세션을 반영할지(완료된 세션만, 연결된 작업만)는 호출 측이 정한다.
 */
export function applyFocusToTask(task: Task, session: FocusSession): Task {
  const min = sessionMinutes(session)
  if (min < 1) return task
  const date = localDateOf(session.startedAt)
  return { ...task, actualMin: { ...task.actualMin, [date]: (task.actualMin[date] ?? 0) + min } }
}
