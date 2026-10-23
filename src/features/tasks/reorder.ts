import type { ID, Task } from '../../domain/types'
import { reorderValue } from '../../domain/views'

/**
 * 같은 부모 아래 형제 목록에서 active를 over 자리로 옮길 때의 새 순서 값.
 * 아래로 옮기면 over 뒤, 위로 옮기면 over 앞에 놓는다. 형제가 아니거나 같은 항목이면 null.
 */
export function computeReorder(
  siblings: readonly Task[],
  activeId: ID,
  overId: ID,
): { order: number; needsRebalance: boolean } | null {
  if (activeId === overId) return null
  const sorted = [...siblings].sort((a, b) => a.order - b.order)
  const from = sorted.findIndex((t) => t.id === activeId)
  const to = sorted.findIndex((t) => t.id === overId)
  if (from === -1 || to === -1) return null
  const rest = sorted.filter((t) => t.id !== activeId)
  const overIndex = rest.findIndex((t) => t.id === overId)
  const insertAt = from < to ? overIndex + 1 : overIndex
  const prev = rest[insertAt - 1] ?? null
  const next = rest[insertAt] ?? null
  const r = reorderValue(prev ? prev.order : null, next ? next.order : null)
  return { order: r.value, needsRebalance: r.needsRebalance }
}
