// 칸반에서 카드를 놓은 위치를 새 섹션·순서 값으로 바꾸는 순수 함수
import type { ID, Task } from '../../domain/types'
import { reorderValue } from '../../domain/views'

export interface BoardColumn {
  /** 'none' 또는 섹션 id */
  key: string
  sectionId: ID | null
  tasks: readonly Task[]
}

export const COLUMN_PREFIX = 'col:'

export interface DropResult {
  sectionId: ID | null
  order: number
  needsRebalance: boolean
}

/**
 * overId가 열(`col:<key>`)이면 그 열의 맨 끝에, 카드이면 그 카드 자리에 끼워 넣는다.
 * 같은 열에서 아래로 옮길 때는 대상 카드 뒤, 위로 옮길 때는 앞에 놓는다(dnd-kit sortable과 같은 규칙).
 */
export function computeDrop(columns: readonly BoardColumn[], activeId: ID, overId: string): DropResult | null {
  const from = columns.find((c) => c.tasks.some((t) => t.id === activeId))
  if (!from) return null

  if (overId.startsWith(COLUMN_PREFIX)) {
    const target = columns.find((c) => c.key === overId.slice(COLUMN_PREFIX.length))
    if (!target) return null
    const rest = target.tasks.filter((t) => t.id !== activeId)
    const last = rest[rest.length - 1]
    const r = reorderValue(last ? last.order : null, null)
    return { sectionId: target.sectionId, order: r.value, needsRebalance: r.needsRebalance }
  }

  const target = columns.find((c) => c.tasks.some((t) => t.id === overId))
  if (!target || activeId === overId) return null
  const list = target.tasks.filter((t) => t.id !== activeId)
  const overIndex = list.findIndex((t) => t.id === overId)
  const movingDown = from.key === target.key && from.tasks.findIndex((t) => t.id === activeId) < target.tasks.findIndex((t) => t.id === overId)
  const insertAt = movingDown ? overIndex + 1 : overIndex
  const prev = list[insertAt - 1] ?? null
  const next = list[insertAt] ?? null
  const r = reorderValue(prev ? prev.order : null, next ? next.order : null)
  return { sectionId: target.sectionId, order: r.value, needsRebalance: r.needsRebalance }
}
