import type { Task } from '../types'
import { scheduleDate } from './taskKeys'
import type { SortBy, SortDir } from './types'

// 이름은 한국어 로케일 + 숫자 자연 정렬("할 일 2" < "할 일 10")
const nameCollator = new Intl.Collator('ko', { numeric: true })

type SortKey = string | number | null

/**
 * 정렬 키. null 은 "값 없음"이며 방향과 무관하게 항상 맨 뒤로 보낸다.
 * - date: 시작일, 없으면 마감일. 같은 날이면 시작 시각(시각 없는 건 가장 앞).
 * - dueDate: 마감일만 본다.
 */
function sortKeyOf(task: Task, by: SortBy): SortKey {
  switch (by) {
    case 'manual':
      return task.order
    case 'name':
      return task.title
    case 'priority':
      return task.priority
    case 'createdAt':
      return task.createdAt
    case 'updatedAt':
      return task.updatedAt
    case 'dueDate':
      return task.dueDate
    case 'date': {
      const date = scheduleDate(task)
      if (date === null) return null
      const time = task.startDate !== null ? (task.startTime ?? '') : ''
      return `${date}T${time}`
    }
  }
}

function compareKeys(a: string | number, b: string | number, by: SortBy): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  const sa = String(a)
  const sb = String(b)
  if (by === 'name') return nameCollator.compare(sa, sb)
  return sa < sb ? -1 : sa > sb ? 1 : 0
}

/**
 * 안정 정렬. 값이 같으면 입력 순서를 유지한다(내림차순에서도 뒤집지 않는다).
 * 입력 배열은 바꾸지 않는다.
 */
export function sortTasks(tasks: readonly Task[], by: SortBy, dir: SortDir): Task[] {
  const sign = dir === 'asc' ? 1 : -1
  return tasks
    .map((task, index) => ({ task, index, key: sortKeyOf(task, by) }))
    .sort((x, y) => {
      if (x.key === null && y.key === null) return x.index - y.index
      if (x.key === null) return 1
      if (y.key === null) return -1
      const c = compareKeys(x.key, y.key, by)
      return c !== 0 ? c * sign : x.index - y.index
    })
    .map((entry) => entry.task)
}
