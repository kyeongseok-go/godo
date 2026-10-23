import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { useState } from 'react'
import { monthGrid, weekdayOrder } from '../../domain/calendarGrid'
import { WEEKDAY_KO } from '../../domain/date'
import { formatDayTitle, formatTime } from '../../domain/format'
import type { ISODate, Task } from '../../domain/types'
import { useSettings } from '../../hooks/data'
import { useOpenTask } from '../../hooks/openTask'
import { PHONE_QUERY, useMediaQuery } from '../../hooks/media'
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

interface CellProps {
  date: ISODate
  inMonth: boolean
  today: ISODate
  items: Occurrence[]
  timeFormat: '12h' | '24h'
  defaults?: QuickAddDefaults
  /** 폰에서는 칸이 좁아 제목을 넣을 수 없다. 점만 찍고 누르면 아래에 그날 목록을 편다. */
  phone: boolean
  selected: boolean
  onSelect: (date: ISODate) => void
}

function Cell({ date, inMonth, today, items, timeFormat, defaults, phone, selected, onSelect }: CellProps) {
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
      data-selected={selected}
      {...(phone ? { role: 'button', tabIndex: 0, 'aria-pressed': selected } : {})}
      onClick={() => (phone ? onSelect(date) : openQuickAdd({ ...defaults, startDate: date }))}
    >
      <span className="mcell__num">{Number(date.slice(8))}</span>
      {phone ? (
        <span className="mcell__dots" aria-hidden="true">
          {items.slice(0, MAX_CHIPS).map((o) => (
            <i key={`${o.task.id}|${o.date}`} data-priority={o.task.priority} />
          ))}
        </span>
      ) : null}
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

/** 폰에서 달력 아래에 펴는 그날 목록. 칸 안에 글자를 못 넣는 대신 여기서 제목을 온전히 읽는다. */
function DayAgenda({
  date,
  items,
  timeFormat,
  defaults,
}: {
  date: ISODate
  items: Occurrence[]
  timeFormat: '12h' | '24h'
  defaults?: QuickAddDefaults
}) {
  const { open } = useOpenTask()
  const openQuickAdd = useUI((s) => s.openQuickAdd)
  return (
    <section className="magenda" aria-label={`${formatDayTitle(date)} 일정`}>
      <h3 className="magenda__title">{formatDayTitle(date)}</h3>
      {items.length === 0 ? (
        <p className="magenda__empty">이 날은 비어 있어요.</p>
      ) : (
        <ul className="magenda__list">
          {items.map((o) => (
            <li key={`${o.task.id}|${o.date}`}>
              <button
                type="button"
                className="magenda__item"
                data-priority={o.task.priority}
                data-done={o.task.status === 'done'}
                onClick={() => open(o.task.id)}
              >
                <span className="magenda__when">
                  {o.task.startTime ? formatTime(o.task.startTime, timeFormat) : '하루 중'}
                </span>
                <span className="magenda__name">{o.task.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="magenda__add"
        onClick={() => openQuickAdd({ ...defaults, startDate: date })}
      >
        이 날짜에 추가
      </button>
    </section>
  )
}

/** 월간 달력. 칩을 다른 날짜로 끌면 시작일(시작일이 없으면 마감일)이 바뀐다. */
export function MonthGrid({ anchor, today, occurrences, defaults }: MonthGridProps) {
  const settings = useSettings()
  const actions = useTaskActions()
  const [activeId, setActiveId] = useState<string | null>(null)
  const phone = useMediaQuery(PHONE_QUERY)
  const [picked, setPicked] = useState<ISODate | null>(null)
  // 고른 날이 없으면 오늘을 보여 준다. 달을 넘겨도 고른 날은 그대로 둔다.
  const day = picked ?? today
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
            <span key={d} data-weekend={d === 0 || d === 6} data-day={d}>
              {WEEKDAY_KO[d]}
            </span>
          ))}
        </div>
        <div className="mgrid__body">
          {weeks.flat().map((c) => (
            <Cell
              key={c.date}
              date={c.date}
              inMonth={c.inMonth}
              today={today}
              items={occurrences.get(c.date) ?? []}
              timeFormat={settings.timeFormat}
              defaults={defaults}
              phone={phone}
              selected={phone && c.date === day}
              onSelect={setPicked}
            />
          ))}
        </div>
      </div>
      {phone ? <DayAgenda date={day} items={occurrences.get(day) ?? []} timeFormat={settings.timeFormat} defaults={defaults} /> : null}
      <DragOverlay>{active ? <Chip o={active} timeFormat={settings.timeFormat} overlay /> : null}</DragOverlay>
    </DndContext>
  )
}
