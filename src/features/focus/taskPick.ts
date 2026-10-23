import type { ISODate, Task } from '../../domain/types'
import { isOpenTask } from '../../domain/stats/shared'

const DEFAULT_LIMIT = 8

function dueToday(task: Task, today: ISODate): boolean {
  return task.startDate === today || task.dueDate === today
}

/**
 * 집중에 연결할 수 있는 열린 할 일. 제목 검색, 오늘 할 일 먼저, 그다음 우선순위(1이 가장 높음) 순서.
 * 보류·언젠가 항목도 사용자가 마음먹고 고를 수 있으므로 거르지 않는다.
 */
export function pickableTasks(tasks: readonly Task[], query: string, today: ISODate, limit = DEFAULT_LIMIT): Task[] {
  const needle = query.trim().toLowerCase()
  return tasks
    .filter((t) => isOpenTask(t) && (needle === '' || t.title.toLowerCase().includes(needle)))
    .sort((a, b) => {
      const byToday = Number(dueToday(b, today)) - Number(dueToday(a, today))
      return byToday || a.priority - b.priority || a.order - b.order
    })
    .slice(0, Math.max(0, limit))
}
