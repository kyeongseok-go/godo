import { closestCorners, DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { PointerEventHandler } from 'react'
import type { ID, Section, Task } from '../../domain/types'
import { rebalanceOrders } from '../../domain/views'
import { useTaskActions } from '../../hooks/actions'
import { applyChangeSet, mergeChangeSets } from '../../store/changes'
import type { ChangeSet } from '../../store/changes'
import { useApp } from '../../store/app'
import { createSection } from '../../store/commands/entityCommands'
import { useUI } from '../../store/ui'
import { SectionHeader } from '../projects/SectionHeader'
import { DragGrip } from '../tasks/DragGrip'
import { TaskCard } from '../tasks/TaskCard'
import { COLUMN_PREFIX, computeDrop } from './drop'
import type { BoardColumn } from './drop'
import './board.css'

interface BoardViewProps {
  projectId: ID
  tasks: readonly Task[]
  sections: readonly Section[]
}

function SortableCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  return (
    <div
      ref={setNodeRef}
      onPointerDown={listeners?.onPointerDown as PointerEventHandler<HTMLDivElement> | undefined}
      style={{ position: 'relative', transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1, touchAction: 'manipulation' }}
    >
      <TaskCard task={task} />
      <DragGrip attributes={attributes} listeners={listeners} setActivatorNodeRef={setActivatorNodeRef} />
    </div>
  )
}

function Column({ column, section, projectId }: { column: BoardColumn; section: Section | null; projectId: ID }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${COLUMN_PREFIX}${column.key}` })
  const openQuickAdd = useUI((s) => s.openQuickAdd)
  return (
    <section className="bcol" data-over={isOver} aria-label={section?.name ?? '섹션 없음'}>
      {section ? (
        <SectionHeader section={section} count={column.tasks.length} />
      ) : (
        <div className="bcol__plain">
          <h2>
            분류 안 됨<span>{column.tasks.length}</span>
          </h2>
        </div>
      )}
      <SortableContext items={column.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="bcol__list">
          {column.tasks.map((t) => (
            <SortableCard key={t.id} task={t} />
          ))}
        </div>
      </SortableContext>
      <button type="button" className="bcol__add" onClick={() => openQuickAdd({ projectId, sectionId: section?.id ?? null })}>
        <Plus size={14} aria-hidden="true" /> 작업 추가
      </button>
    </section>
  )
}

/** 섹션이 열인 칸반. 카드를 열 사이로 끌면 섹션이 바뀌고, 섹션에 상태 범주가 있으면 상태도 따라간다. */
export function BoardView({ projectId, tasks, sections }: BoardViewProps) {
  const actions = useTaskActions()
  const commit = useApp((s) => s.commit)
  const [activeId, setActiveId] = useState<ID | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const columns = useMemo<BoardColumn[]>(() => {
    const top = tasks.filter((t) => t.parentId === null)
    const known = new Set(sections.map((s) => s.id))
    const doneSections = new Set(sections.filter((s) => s.category === 'done').map((s) => s.id))
    const visible = (t: Task) => t.status === 'todo' || t.status === 'active' || (t.sectionId !== null && doneSections.has(t.sectionId))
    const byOrder = (a: Task, b: Task) => a.order - b.order
    const none: BoardColumn = {
      key: 'none',
      sectionId: null,
      tasks: top.filter((t) => visible(t) && (t.sectionId === null || !known.has(t.sectionId))).sort(byOrder),
    }
    return [none, ...sections.map((s) => ({ key: s.id, sectionId: s.id, tasks: top.filter((t) => visible(t) && t.sectionId === s.id).sort(byOrder) }))]
  }, [tasks, sections])

  const active = tasks.find((t) => t.id === activeId)

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    if (!e.over) return
    const drop = computeDrop(columns, String(e.active.id), String(e.over.id))
    if (!drop) return
    actions.move(String(e.active.id), { projectId, sectionId: drop.sectionId, parentId: null, order: drop.order })
    if (drop.needsRebalance) {
      // 간격이 너무 좁아졌으면 그 열의 순서를 1000 단위로 다시 매긴다.
      const state = useApp.getState().entities
      const target = columns.find((c) => c.sectionId === drop.sectionId)
      const ordered = (target?.tasks ?? []).map((t) => state.tasks[t.id]).filter(Boolean).sort((a, b) => a.order - b.order)
      const orders = rebalanceOrders(ordered)
      const puts = ordered.map((t) => ({ ...t, order: orders.get(t.id) ?? t.order }))
      commit({ puts: { tasks: puts }, deletes: {} }, '순서 정리', { history: false })
    }
  }

  const addColumn = () => {
    const title = name.trim()
    setAdding(false)
    setName('')
    if (title) commit(createSection(useApp.getState().entities, { projectId, name: title }).changes, '열 추가')
  }

  const seedColumns = () => {
    // 세 열을 한 번에 만들어 실행 취소 한 번으로 되돌릴 수 있게 한다.
    const defs = [
      { name: '할 일', category: 'todo' },
      { name: '진행 중', category: 'active' },
      { name: '완료', category: 'done' },
    ] as const
    let working = useApp.getState().entities
    const sets: ChangeSet[] = []
    for (const d of defs) {
      const { changes } = createSection(working, { projectId, name: d.name, category: d.category })
      sets.push(changes)
      working = applyChangeSet(working, changes).next
    }
    commit(mergeChangeSets(...sets), '칸반 열 만들기')
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="board">
        {columns.map((c) => (
          <Column key={c.key} column={c} section={sections.find((s) => s.id === c.sectionId) ?? null} projectId={projectId} />
        ))}
        <div className="board__new">
          {adding ? (
            <input
              autoFocus
              value={name}
              placeholder="열 이름"
              aria-label="새 열 이름"
              onChange={(e) => setName(e.target.value)}
              onBlur={addColumn}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) addColumn()
                if (e.key === 'Escape') {
                  setName('')
                  setAdding(false)
                }
              }}
            />
          ) : (
            <>
              <button type="button" onClick={() => setAdding(true)}>
                <Plus size={14} aria-hidden="true" /> 열 추가
              </button>
              {sections.length === 0 ? (
                <button type="button" className="board__seed" onClick={seedColumns}>
                  할 일 · 진행 중 · 완료로 시작
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
      <DragOverlay>{active ? <TaskCard task={active} dragging /> : null}</DragOverlay>
    </DndContext>
  )
}
