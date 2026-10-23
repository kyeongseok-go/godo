// F1·F7: 지금 할 수 있는 작업인가
import type { ID, ISODate, EngineContext, Task } from '../types'
import { indexById, isOpen, isParked } from './shared'

/** 시작일이 미래라서 목록에서 숨겨야 하는가 */
export function isHiddenUntilStart(task: Task, today: ISODate): boolean {
  return task.startDate !== null && task.startDate > today
}

/** 아직 끝나지 않은 선행 작업이 하나라도 있는가. 없는 id·삭제·완료·취소는 해결된 것으로 본다. */
export function isBlocked(task: Task, byId: ReadonlyMap<ID, Task>): boolean {
  return task.blockedBy.some((id) => {
    const blocker = byId.get(id)
    return blocker !== undefined && isOpen(blocker)
  })
}

/** 조상 중에 보류/someday 가 있는가. 순환 참조가 있어도 멈추도록 방문 기록을 둔다. */
export function hasParkedAncestor(task: Task, byId: ReadonlyMap<ID, Task>): boolean {
  const visited = new Set<ID>([task.id])
  let parentId = task.parentId
  while (parentId !== null && !visited.has(parentId)) {
    visited.add(parentId)
    const parent = byId.get(parentId)
    if (parent === undefined) return false
    if (isParked(parent)) return true
    parentId = parent.parentId
  }
  return false
}

/** 색인을 미리 만들어 둔 버전. 여러 작업을 훑을 때 O(n²)를 피하려고 분리했다. */
export function isActionableIn(task: Task, today: ISODate, byId: ReadonlyMap<ID, Task>): boolean {
  if (!isOpen(task) || isParked(task)) return false
  if (isHiddenUntilStart(task, today)) return false
  return !isBlocked(task, byId) && !hasParkedAncestor(task, byId)
}

export function isActionable(task: Task, ctx: EngineContext): boolean {
  return isActionableIn(task, ctx.today, indexById(ctx.tasks))
}

/**
 * 색인을 한 번만 만들어 두고 작업마다 재사용하는 판정 함수를 돌려준다.
 * 목록 전체를 훑을 때 `isActionable(task, ctx)`를 반복하면 작업마다 색인을 새로 만들어 O(n²)가 된다.
 */
export function makeActionableChecker(ctx: Pick<EngineContext, 'tasks' | 'today'>): (task: Task) => boolean {
  const byId = indexById(ctx.tasks)
  const { today } = ctx
  return (task) => isActionableIn(task, today, byId)
}
