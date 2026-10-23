import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useToday, useSettings } from '../../hooks/data'
import { useLookups } from '../../hooks/lookups'
import { useOpenTask } from '../../hooks/openTask'
import { useTaskActions } from '../../hooks/actions'
import type { Task } from '../../domain/types'
import { buildTaskTree } from '../../domain/views'
import type { TaskGroup, TaskNode } from '../../domain/views'
import { useUI } from '../../store/ui'
import type { QuickAddDefaults } from '../../store/ui'
import { rebalanceOrders } from '../../domain/views'
import { useApp } from '../../store/app'
import { nextMembership } from './membership'
import { computeReorder } from './reorder'
import { TaskRow } from './TaskRow'
import type { TaskRowProps } from './TaskRow'
import './task-list.css'

interface TaskListProps {
  groups: readonly TaskGroup[]
  /** 프로젝트 이름 칩을 행에 보일지 */
  showProject?: boolean
  empty?: ReactNode
  /** 목록 맨 아래 "작업 추가" 버튼이 빠른 추가에 넘길 기본값. 없으면 버튼을 숨긴다. */
  addDefaults?: QuickAddDefaults
  /** 접힌 부모의 하위 작업을 숨길지. 평면 목록(오늘 등)에서는 끈다. */
  nested?: boolean
  /** 직접 정렬 상태에서 드래그로 순서를 바꿀 수 있게 한다(같은 부모 안에서만) */
  sortable?: boolean
}

function SortableRow(props: TaskRowProps & { sortable: boolean }) {
  const { sortable, ...rowProps } = props
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.node.task.id,
    disabled: !sortable,
  })
  const handle = sortable ? (
    <button type="button" className="task-row__grip" aria-label="끌어서 순서 바꾸기" {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}>
      <GripVertical size={14} aria-hidden="true" />
    </button>
  ) : null
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, position: 'relative', zIndex: isDragging ? 5 : undefined }}
    >
      <TaskRow {...rowProps} handle={handle} />
    </li>
  )
}

function flatten(nodes: readonly TaskNode[], collapsed: Readonly<Record<string, true>>, out: TaskNode[] = []): TaskNode[] {
  for (const node of nodes) {
    out.push(node)
    if (!collapsed[node.task.id]) flatten(node.children, collapsed, out)
  }
  return out
}

export function TaskList({ groups, showProject = false, empty, addDefaults, nested = true, sortable = false }: TaskListProps) {
  const today = useToday()
  const settings = useSettings()
  const lookups = useLookups()
  const actions = useTaskActions()
  const { open } = useOpenTask()
  const collapsed = useUI((s) => s.collapsed)
  const selectedIds = useUI((s) => s.selectedIds)
  const focusedId = useUI((s) => s.focusedId)
  const toggleCollapsed = useUI((s) => s.toggleCollapsed)
  const toggleSelected = useUI((s) => s.toggleSelected)
  const openQuickAdd = useUI((s) => s.openQuickAdd)

  // 방금 완료한 행은 몇 초 동안 취소선으로 남겨 둔다. 눌렀다는 확인이 되고, 실수면 바로 되돌릴 수 있다.
  // 어느 그룹에 있었는지 기억해 두었다가, 사라진 자리에 다시 끼워 넣는다.
  // 기억은 ref 가 아니라 state 로 둔다: 그룹이 바뀐 렌더에서 한 번만 새로 계산하고(React 의 "이전 렌더 정보 저장" 패턴),
  // 같은 입력으로 다시 렌더될 때는 계산을 건너뛴다.
  const lingering = useUI((s) => s.lingering)
  const allTasks = useApp((s) => s.entities.tasks)
  const [tracked, setTracked] = useState(() => ({ groups, lingering, membership: nextMembership(new Map(), groups, lingering) }))
  let membership = tracked.membership
  if (tracked.groups !== groups || tracked.lingering !== lingering) {
    membership = nextMembership(tracked.membership, groups, lingering)
    setTracked({ groups, lingering, membership })
  }

  const rendered = useMemo(
    () =>
      groups.map((g) => {
        const present = new Set(g.tasks.map((t) => t.id))
        const extra = Object.keys(lingering)
          .filter((id) => membership.get(id) === g.key && !present.has(id) && allTasks[id])
          .map((id) => allTasks[id])
        const tasks = extra.length > 0 ? [...g.tasks, ...extra] : g.tasks
        return {
          group: g,
          rows: nested
            ? flatten(buildTaskTree(tasks), collapsed)
            : tasks.map((task): TaskNode => ({ task, children: [], depth: 0 })),
        }
      }),
    [groups, collapsed, nested, lingering, allTasks, membership],
  )

  const onToggleDone = useCallback(
    (task: Task, done: boolean) => (done ? actions.complete(task.id) : actions.reopen(task.id)),
    [actions],
  )
  const onOpen = useCallback((task: Task) => open(task.id), [open])
  const onToggleCollapse = useCallback((task: Task) => toggleCollapsed(task.id), [toggleCollapsed])
  const onToggleSelect = useCallback((task: Task) => toggleSelected(task.id), [toggleSelected])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const activeId = String(e.active.id)
    const overId = String(e.over.id)
    for (const { rows } of rendered) {
      const active = rows.find((r) => r.task.id === activeId)?.task
      const over = rows.find((r) => r.task.id === overId)?.task
      if (!active || !over) continue
      // 부모가 다른 행 사이로는 옮기지 않는다(들여쓰기는 ⌘] / ⌘[ 로).
      if (active.parentId !== over.parentId) return
      const siblings = rows.map((r) => r.task).filter((t) => t.parentId === active.parentId)
      const result = computeReorder(siblings, activeId, overId)
      if (!result) return
      actions.patch(activeId, { order: result.order }, '순서 변경')
      if (result.needsRebalance) {
        const state = useApp.getState().entities
        const ordered = siblings.map((t) => state.tasks[t.id]).filter(Boolean).sort((a, b) => a.order - b.order)
        const orders = rebalanceOrders(ordered)
        useApp.getState().commit({ puts: { tasks: ordered.map((t) => ({ ...t, order: orders.get(t.id) ?? t.order })) }, deletes: {} }, '순서 정리', { history: false })
      }
      return
    }
  }

  const total = rendered.reduce((n, r) => n + r.rows.length, 0)
  const selected = new Set(selectedIds)
  const showGroupHeaders = groups.length > 1 || (groups[0] && groups[0].title !== '')

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
    <div className="task-list">
      {total === 0 ? <div className="task-list__empty">{empty}</div> : null}
      {rendered.map(({ group, rows }) =>
        rows.length === 0 ? null : (
          <section key={group.key} className="task-group" aria-label={group.title || undefined}>
            {showGroupHeaders && group.title ? (
              <h3 className="task-group__title">
                <span>{group.title}</span>
                <span className="task-group__count">{group.tasks.length}</span>
              </h3>
            ) : null}
            <SortableContext items={rows.map((r) => r.task.id)} strategy={verticalListSortingStrategy} disabled={!sortable}>
              <ul className="task-ul">
              {rows.map((node) => (
                <SortableRow
                  key={node.task.id}
                  sortable={sortable}
                  node={node}
                  today={today}
                  settings={settings}
                  lookups={lookups}
                  showProject={showProject}
                  collapsed={!!collapsed[node.task.id]}
                  selected={selected.has(node.task.id)}
                  focused={focusedId === node.task.id}
                  onToggleDone={onToggleDone}
                  onOpen={onOpen}
                  onToggleCollapse={onToggleCollapse}
                  onToggleSelect={onToggleSelect}
                />
              ))}
              </ul>
            </SortableContext>
          </section>
        ),
      )}
      {addDefaults ? (
        <button type="button" className="task-list__add" onClick={() => openQuickAdd(addDefaults)}>
          <Plus size={16} aria-hidden="true" />
          작업 추가
        </button>
      ) : null}
    </div>
    </DndContext>
  )
}
