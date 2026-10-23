import type { ID, Task } from '../types'
import type { TaskNode } from './types'

interface Indexed {
  task: Task
  index: number
}

const byOrder = (a: Indexed, b: Indexed): number => a.task.order - b.task.order || a.index - b.index

/**
 * parentId 로 트리를 만든다.
 * - 부모가 목록에 없거나 자기 자신을 부모로 가리키면 최상위로 올린다.
 * - 순환(A→B→A)은 order(같으면 입력 순서)가 가장 앞선 작업을 최상위로 끊어서 모든 작업이 정확히 한 번씩 나오게 한다.
 * - 같은 id 가 또 나오면 첫 번째만 쓴다.
 * - 형제는 order 순, 같으면 입력 순서.
 */
export function buildTaskTree(tasks: readonly Task[]): TaskNode[] {
  const unique = dedupe(tasks)
  const known = new Set(unique.map((e) => e.task.id))

  const childrenOf = new Map<ID, Indexed[]>()
  const roots: Indexed[] = []
  for (const entry of unique) {
    const parentId = entry.task.parentId
    if (parentId === null || parentId === entry.task.id || !known.has(parentId)) {
      roots.push(entry)
      continue
    }
    childrenOf.set(parentId, [...(childrenOf.get(parentId) ?? []), entry])
  }

  const visited = new Set<ID>()
  const build = (entry: Indexed, depth: number): TaskNode => {
    visited.add(entry.task.id)
    const kids = (childrenOf.get(entry.task.id) ?? []).filter((k) => !visited.has(k.task.id))
    return { task: entry.task, depth, children: [...kids].sort(byOrder).map((k) => build(k, depth + 1)) }
  }

  const nodes = [...roots].sort(byOrder).map((r) => build(r, 0))

  // 순환에 갇혀 아직 방문하지 못한 작업을 최상위로 끊어 올린다.
  for (const entry of [...unique].sort(byOrder)) {
    if (!visited.has(entry.task.id)) nodes.push(build(entry, 0))
  }
  return sortRootNodes(nodes, unique)
}

function dedupe(tasks: readonly Task[]): Indexed[] {
  const seen = new Set<ID>()
  const result: Indexed[] = []
  tasks.forEach((task, index) => {
    if (seen.has(task.id)) return
    seen.add(task.id)
    result.push({ task, index })
  })
  return result
}

function sortRootNodes(nodes: TaskNode[], entries: readonly Indexed[]): TaskNode[] {
  const indexOf = new Map(entries.map((e) => [e.task.id, e.index]))
  return [...nodes].sort(
    (a, b) => a.task.order - b.task.order || (indexOf.get(a.task.id) ?? 0) - (indexOf.get(b.task.id) ?? 0),
  )
}

/**
 * 노드 자신을 뺀 모든 하위 작업 수. done 은 상태가 'done' 인 것만 센다.
 * 취소된 하위 작업도 total 에 들어간다(가장 단순한 규칙을 택했다).
 */
export function countDescendants(node: TaskNode): { total: number; done: number } {
  let total = 0
  let done = 0
  for (const child of node.children) {
    const sub = countDescendants(child)
    total += 1 + sub.total
    done += (child.task.status === 'done' ? 1 : 0) + sub.done
  }
  return { total, done }
}
