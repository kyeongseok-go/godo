import { addDays } from '../../domain/date'
import type { ID, ISODate, Task } from '../../domain/types'

export interface DailyBar {
  date: ISODate
  min: number
}

/** 오늘로 끝나는 연속 n일. 기록이 없는 날은 0분으로 채워 막대 사이에 빈틈이 없게 한다. */
export function buildDailyBars(byDay: readonly DailyBar[], today: ISODate, days: number): DailyBar[] {
  if (days <= 0) return []
  const minutes = new Map(byDay.map((d) => [d.date, d.min]))
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - (days - 1))
    return { date, min: minutes.get(date) ?? 0 }
  })
}

export interface TopTask {
  taskId: ID
  title: string
  min: number
}

const DELETED_TITLE = '삭제된 할 일'

/** 연결된 할 일 중 집중 시간이 많은 순 상위 n개. 연결 없는 세션은 따로 합계만 돌려준다. */
export function buildTopTasks(
  byTask: ReadonlyArray<{ taskId: ID | null; min: number }>,
  tasks: ReadonlyMap<ID, Task>,
  limit: number,
): { items: TopTask[]; unlinkedMin: number } {
  let unlinkedMin = 0
  const items: TopTask[] = []
  for (const entry of byTask) {
    if (entry.taskId === null) {
      unlinkedMin += entry.min
    } else if (entry.min > 0) {
      items.push({ taskId: entry.taskId, title: tasks.get(entry.taskId)?.title ?? DELETED_TITLE, min: entry.min })
    }
  }
  items.sort((a, b) => b.min - a.min)
  return { items: items.slice(0, Math.max(0, limit)), unlinkedMin }
}

/** 오늘 끝낸 포모 점. 다음 긴 휴식까지 채울 칸을 비어 있는 점으로 함께 보여준다. */
export function buildDots(doneToday: number, cycle: number): { done: number; total: number } {
  if (!(cycle >= 1)) return { done: doneToday, total: doneToday }
  const size = Math.round(cycle)
  return { done: doneToday, total: Math.max(size, Math.ceil(doneToday / size) * size) }
}
