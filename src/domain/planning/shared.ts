// 계획 모듈 안에서 함께 쓰는 작은 헬퍼. 외부에는 공개하지 않는다.
import { compareDate } from '../date'
import type { ID, ISODate, Task } from '../types'

export const DAY_MS = 86_400_000

/** 할 수 있는 상태(대기/진행)이고 휴지통에 없는 작업 */
export function isOpen(task: Task): boolean {
  return (task.status === 'todo' || task.status === 'active') && task.deletedAt === null
}

/** 보류 또는 "언젠가" — 계획에서 의도적으로 빠진 작업 */
export function isParked(task: Task): boolean {
  return task.onHold || task.someday
}

export function indexById(tasks: readonly Task[]): Map<ID, Task> {
  return new Map(tasks.map((t) => [t.id, t]))
}

/** 오늘 목록의 기준 날짜: 시작일이 있으면 시작일, 없으면 마감일 */
export function effectiveDate(task: Task): ISODate | null {
  return task.startDate ?? task.dueDate
}

/** 같은 그룹 안 정렬: 고정 먼저, 그다음 우선순위(1이 먼저), 그다음 order */
export function compareByPlanOrder(a: Task, b: Task): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
  if (a.priority !== b.priority) return a.priority - b.priority
  return a.order - b.order
}

/** 날짜 없음(null)은 맨 뒤로 보내는 날짜 비교 */
export function compareDateNullLast(a: ISODate | null, b: ISODate | null): number {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return compareDate(a, b)
}
