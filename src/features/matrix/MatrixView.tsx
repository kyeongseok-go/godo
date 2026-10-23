import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { useMemo, useState } from 'react'
import type { PointerEventHandler } from 'react'
import type { Task } from '../../domain/types'
import { matrixQuadrants, moveToQuadrantPriority } from '../../domain/views'
import type { Quadrant } from '../../domain/views'
import { useTaskActions } from '../../hooks/actions'
import { DragGrip } from '../tasks/DragGrip'
import { TaskCard } from '../tasks/TaskCard'
import './matrix.css'

const QUADRANTS: ReadonlyArray<{ id: Quadrant; title: string; hint: string; tone: string }> = [
  { id: 'doFirst', title: '지금 하기', hint: '중요하고 급함 · P1', tone: 'p1' },
  { id: 'schedule', title: '계획하기', hint: '중요하지만 급하지 않음 · P2', tone: 'p2' },
  { id: 'delegate', title: '빠르게 처리', hint: '급하지만 덜 중요함 · P3', tone: 'p3' },
  { id: 'eliminate', title: '나중에 · 버리기', hint: '급하지도 중요하지도 않음 · P4', tone: 'p4' },
]

function DraggableCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: task.id })
  // 카드 어디를 잡아도 끌 수 있고(포인터), 키보드는 손잡이에서만 시작한다(카드 안 버튼과 중첩 방지).
  return (
    <div ref={setNodeRef} onPointerDown={listeners?.onPointerDown as PointerEventHandler<HTMLDivElement> | undefined} style={{ position: 'relative', opacity: isDragging ? 0.35 : 1, touchAction: 'manipulation' }}>
      <TaskCard task={task} showProject />
      <DragGrip attributes={attributes} listeners={listeners} setActivatorNodeRef={setActivatorNodeRef} />
    </div>
  )
}

function Quad({ id, title, hint, tone, tasks }: (typeof QUADRANTS)[number] & { tasks: Task[] }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <section ref={setNodeRef} className="quad" data-tone={tone} data-over={isOver} aria-label={title}>
      <header>
        <h2>{title}</h2>
        <p>{hint}</p>
        <span>{tasks.length}</span>
      </header>
      <div className="quad__list">
        {tasks.map((t) => (
          <DraggableCard key={t.id} task={t} />
        ))}
        {tasks.length === 0 ? <p className="quad__empty">여기로 끌어다 놓으면 우선순위가 바뀌어요</p> : null}
      </div>
    </section>
  )
}

/** 우선순위로 4분면을 자동 분류한다. 카드를 다른 칸으로 끌면 우선순위가 바뀐다. */
export function MatrixView({ tasks }: { tasks: readonly Task[] }) {
  const actions = useTaskActions()
  const quads = useMemo(() => matrixQuadrants(tasks), [tasks])
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )
  const active = tasks.find((t) => t.id === activeId)

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const target = e.over?.id as Quadrant | undefined
    if (!target) return
    const priority = moveToQuadrantPriority(target)
    const task = tasks.find((t) => t.id === e.active.id)
    if (task && task.priority !== priority) actions.patch(task.id, { priority }, '우선순위 변경')
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="matrix">
        {QUADRANTS.map((q) => (
          <Quad key={q.id} {...q} tasks={quads[q.id]} />
        ))}
      </div>
      <DragOverlay>{active ? <TaskCard task={active} showProject dragging /> : null}</DragOverlay>
    </DndContext>
  )
}
