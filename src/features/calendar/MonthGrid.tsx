import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { useState } from 'react'
import { monthGrid, weekdayOrder } from '../../domain/calendarGrid'
import { WEEKDAY_KO } from '../../domain/date'
import { formatTime } from '../../domain/format'
import type { ISODate, Task } from '../../domain/types'
import { useSettings } from '../../hooks/data'
import { useOpenTask } from '../../hooks/openTask'
import { useTaskActions } from '../../hooks/actions'
import { useUI } from '../../store/ui'
import type { QuickAddDefaults } from '../../store/ui'
import type { Occurrence } from './layout'
import './month-grid.css'

const MAX_CHIPS = 3

interface MonthGridProps {
  anchor: ISODate
  today: ISODate
  occurrences: ReadonlyMap<ISODate, Occurrence[]>
  defaults?: QuickAddDefaults
}

function Chip({ o, timeFormat, overlay }: { o: Occurrence; timeFormat: '12h' | '24h'; overlay?: boolean }) {
  const { open } = useOpenTask()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${o.task.id}|${o.date}`,
    disabled: o.virtual || overlay,
  })
  const t = o.task
  return (
    <button
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      type="button"
      className="mchip"
      data-priority={t.priority}
      data-virtual={o.virtual}
      data-done={t.status === 'done'}
      data-due={!t.startDate}
      style={{ opacity: isDragging ? 0.3 : 1 }}
      onClick={(e) => {
        e.stopPropagation()
        open(t.id)
      }}
    >
      {t.startTime ? <small>{formatTime(t.startTime, timeFormat)}</small> : null}
      <span>{t.title}</span>
    </button>
  )
}

function Cell({ date, inMonth, today, items, timeFormat, defaults }: { date: ISODate; inMonth: boolean; today: ISODate; items: Occurrence[]; timeFormat: '12h' | '24h'; defaults?: QuickAddDefaults }) {
  const { setNodeRef, isOver } = useDroppable({ id: date })
  const openQuickAdd = useUI((s) => s.openQuickAdd)
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? items : items.slice(0, MAX_CHIPS)
  return (
    <div
      ref={setNodeRef}
      className="mcell"
      data-out={!inMonth}
      data-today={date === today}
      data-over={isOver}
      onClick={() => openQuickAdd({ ...defaults, startDate: date })}
    >
      <span className="mcell__num">{Number(date.slice(8))}</span>
      <div className="mcell__items">
        {shown.map((o) => (
          <Chip key={`${o.task.id}|${o.date}`} o={o} timeFormat={timeFormat} />
        ))}
        {items.length > MAX_CHIPS ? (
          <button
            type="button"
            className="mcell__more"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded((v) => !v)
            }}
          >
            {expanded ? '접기' : `+${items.length - MAX_CHIPS}개 더`}
          </button>
        ) : null}
      </div>
    </div>
  )
}

/** 월간 달력. 칩을 다른 날짜로 끌면 시작일(시작일이 없으면 마감일)이 바뀐다. */
export function MonthGrid({ anchor, today, occurrences, defaults }: MonthGridProps) {
  const settings = useSettings()
  const actions = useTaskActions()
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const weeks = monthGrid(anchor, settings.weekStartsOn)

  const find = (id: string): Occurrence | undefined => {
    const [taskId, date] = id.split('|')
    return occurrences.get(date)?.find((o) => o.task.id === taskId)
  }
  const active = activeId ? find(activeId) : undefined

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const target = e.over?.id as ISODate | undefined
    const o = find(String(e.active.id))
    if (!target || !o || o.date === target) return
    const t: Task = o.task
    actions.patch(t.id, t.startDate ? { startDate: target } : { dueDate: target }, '일정 이동')
  }

  return (
    <DndContext sensors={sensors} onDragStart={(e) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="mgrid" role="group" aria-label="월간 달력">
        <div className="mgrid__weekdays" aria-hidden="true">
          {weekdayOrder(settings.weekStartsOn).map((d) => (
            <span key={d} data-weekend={d === 0 || d === 6}>
              {WEEKDAY_KO[d]}
            </span>
          ))}
        </div>
        <div className="mgrid__body">
          {weeks.flat().map((c) => (
            <Cell key={c.date} date={c.date} inMonth={c.inMonth} today={today} items={occurrences.get(c.date) ?? []} timeFormat={settings.timeFormat} defaults={defaults} />
          ))}
        </div>
      </div>
      <DragOverlay>{active ? <Chip o={active} timeFormat={settings.timeFormat} overlay /> : null}</DragOverlay>
    </DndContext>
  )
}
