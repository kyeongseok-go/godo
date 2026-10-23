import type { ID, Task } from '../../domain/types'
import type { EntityState } from '../changes'

/** 자식 목록 인덱스. 삭제된 작업도 포함한다(복원 때 같이 되살려야 하므로). */
export function childrenIndex(tasks: Readonly<Record<string, Task>>): Map<ID, Task[]> {
  const index = new Map<ID, Task[]>()
  for (const task of Object.values(tasks)) {
    if (task.parentId === null) continue
    const list = index.get(task.parentId)
    if (list) list.push(task)
    else index.set(task.parentId, [task])
  }
  return index
}

/**
 * 미리 만든 자식 색인에서 자기 자신을 제외한 모든 하위 작업을 모은다. 순환 참조가 있어도 한 번씩만 방문한다.
 * 여러 작업의 하위를 구할 때는 색인을 한 번만 만들어 이 함수를 반복해 부른다(`descendantsOf`를 반복하면 O(n²)).
 */
export function descendantsFrom(index: ReadonlyMap<ID, readonly Task[]>, id: ID): Task[] {
  const seen = new Set<ID>([id])
  const out: Task[] = []
  const stack = [...(index.get(id) ?? [])]
  while (stack.length > 0) {
    const task = stack.pop()
    if (!task || seen.has(task.id)) continue
    seen.add(task.id)
    out.push(task)
    stack.push(...(index.get(task.id) ?? []))
  }
  return out
}

/** 자기 자신을 제외한 모든 하위 작업. 한 번만 부를 때 쓴다. 여러 번이면 `descendantsFrom`. */
export function descendantsOf(state: EntityState, id: ID): Task[] {
  return descendantsFrom(childrenIndex(state.tasks), id)
}

/** `candidateParentId`가 `id`의 자손이면 true. 들여쓰기·이동 때 순환을 막는 데 쓴다. */
export function wouldCreateCycle(
  state: EntityState,
  id: ID,
  candidateParentId: ID | null,
  index?: ReadonlyMap<ID, readonly Task[]>,
): boolean {
  if (candidateParentId === null) return false
  if (candidateParentId === id) return true
  return descendantsFrom(index ?? childrenIndex(state.tasks), id).some((t) => t.id === candidateParentId)
}

/** 같은 부모·프로젝트 안에서 맨 끝에 놓을 순서 값 */
export function nextOrder(state: EntityState, projectId: ID, parentId: ID | null): number {
  let max = 0
  let any = false
  for (const t of Object.values(state.tasks)) {
    if (t.projectId === projectId && t.parentId === parentId && t.deletedAt === null) {
      any = true
      if (t.order > max) max = t.order
    }
  }
  return any ? max + 1000 : 1000
}
