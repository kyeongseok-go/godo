import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { addDays, fromISODate, isISODate, WEEKDAY_KO } from '../../domain/date'
import type { ISODate, Task } from '../../domain/types'
import { useToday } from '../../hooks/data'
import { useOpenTask } from '../../hooks/openTask'
import { useTaskActions } from '../../hooks/actions'
import { barFor, resizeEnd, shiftSpan } from './bars'
import './timeline.css'

const ZOOMS = [
  { days: 14, label: '2주' },
  { days: 28, label: '4주' },
  { days: 56, label: '8주' },
] as const
const CELL_PX = 36

interface DragInfo {
  taskId: string
  mode: 'move' | 'resize'
  deltaDays: number
}

/** 간트형 타임라인. 막대를 끌어 옮기고, 오른쪽 끝을 끌어 마감일을 늘린다. 빈 칸을 누르면 그 날로 시작일을 잡는다. */
export function TimelineView({ tasks }: { tasks: readonly Task[] }) {
  const today = useToday()
  const actions = useTaskActions()
  const { open } = useOpenTask()
  const [params, setParams] = useSearchParams()
  const zoom = ZOOMS.find((z) => String(z.days) === params.get('zoom')) ?? ZOOMS[1]
  const raw = params.get('from')
  const start: ISODate = isISODate(raw) ? raw : addDays(today, -2)
  const [drag, setDrag] = useState<DragInfo | null>(null)
  const dragRef = useRef<DragInfo | null>(null)
  dragRef.current = drag

  const days = useMemo(() => Array.from({ length: zoom.days }, (_, i) => addDays(start, i)), [start, zoom.days])
  const rows = useMemo(
    () =>
      tasks
        .filter((t) => t.deletedAt === null && t.status !== 'canceled' && (t.status !== 'done' || t.completedAt !== null) && !t.someday)
        .filter((t) => t.status !== 'done')
        .sort((a, b) => (a.startDate ?? a.dueDate ?? '9999').localeCompare(b.startDate ?? b.dueDate ?? '9999') || a.order - b.order),
    [tasks],
  )
  const dated = rows.filter((t) => t.startDate || t.dueDate)
  const undated = rows.filter((t) => !t.startDate && !t.dueDate)

  const setRange = (from: ISODate, zoomDays = zoom.days) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p)
        next.set('from', from)
        next.set('zoom', String(zoomDays))
        return next
      },
      { replace: true },
    )

  const startDrag = (e: ReactPointerEvent, task: Task, mode: 'move' | 'resize') => {
    e.stopPropagation()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    const originX = e.clientX
    setDrag({ taskId: task.id, mode, deltaDays: 0 })
    const onMove = (ev: PointerEvent) => {
      const cur = dragRef.current
      if (cur) setDrag({ ...cur, deltaDays: Math.round((ev.clientX - originX) / CELL_PX) })
    }
    const onUp = () => {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
      const final = dragRef.current
      setDrag(null)
      if (!final) return
      if (final.deltaDays === 0) return open(task.id)
      if (final.mode === 'move') actions.patch(task.id, shiftSpan(task, final.deltaDays), '일정 이동')
      else {
        const end = task.dueDate ?? task.startDate
        if (end) actions.patch(task.id, resizeEnd(task, addDays(end, final.deltaDays)), '마감일 변경')
      }
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  }

  const todayIdx = days.indexOf(today)

  return (
    <div className="tl">
      <div className="calview__bar">
        <div className="calview__nav">
          <button type="button" className="icon-btn" aria-label="이전" onClick={() => setRange(addDays(start, -7))}>
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button type="button" className="icon-btn" aria-label="다음" onClick={() => setRange(addDays(start, 7))}>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <button type="button" className="btn-ghost" onClick={() => setRange(addDays(today, -2))}>
            오늘
          </button>
        </div>
        <div className="vswitch" role="tablist" aria-label="표시 기간">
          {ZOOMS.map((z) => (
            <button key={z.days} type="button" role="tab" aria-selected={z.days === zoom.days} onClick={() => setRange(start, z.days)}>
              {z.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tl__scroll">
        <div className="tl__canvas" style={{ width: zoom.days * CELL_PX + 14 * 16 }}>
          <div className="tl__head" style={{ ['--cell' as string]: `${CELL_PX}px` }}>
            <div className="tl__label" />
            <div className="tl__days" style={{ gridTemplateColumns: `repeat(${zoom.days}, ${CELL_PX}px)` }}>
              {days.map((d) => {
                const date = fromISODate(d)
                return (
                  <span key={d} data-today={d === today} data-weekend={date.getDay() === 0 || date.getDay() === 6} data-first={date.getDate() === 1}>
                    {date.getDate() === 1 ? `${date.getMonth() + 1}월` : null}
                    <b>{date.getDate()}</b>
                    <small>{WEEKDAY_KO[date.getDay()]}</small>
                  </span>
                )
              })}
            </div>
          </div>

          {dated.map((t) => {
            const base = barFor(t, start, zoom.days)
            const live = drag?.taskId === t.id ? drag : null
            const shifted = base && live?.mode === 'move' ? { ...base, from: base.from + live.deltaDays, to: base.to + live.deltaDays } : base
            const bar = shifted && live?.mode === 'resize' ? { ...shifted, to: Math.max(shifted.from, shifted.to + live.deltaDays) } : shifted
            return (
              <div key={t.id} className="tl__row" style={{ ['--cell' as string]: `${CELL_PX}px` }}>
                <button type="button" className="tl__label" onClick={() => open(t.id)} title={t.title}>
                  <i style={{ background: `var(--p${t.priority})` }} aria-hidden="true" />
                  {t.title}
                </button>
                <div
                  className="tl__track"
                  style={{ gridTemplateColumns: `repeat(${zoom.days}, ${CELL_PX}px)` }}
                  onClick={(e) => {
                    if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.cell) return
                    const idx = Math.floor((e.clientX - e.currentTarget.getBoundingClientRect().left) / CELL_PX)
                    if (!t.startDate) actions.patch(t.id, { startDate: days[idx] }, '일정 지정')
                  }}
                >
                  {days.map((d) => (
                    <i key={d} data-cell data-today={d === today} />
                  ))}
                  {bar ? (
                    <div
                      className="tl__bar"
                      data-priority={t.priority}
                      data-clipped-start={bar.clippedStart}
                      data-clipped-end={bar.clippedEnd}
                      data-dragging={Boolean(live)}
                      style={{ gridColumn: `${Math.max(1, bar.from + 1)} / ${Math.min(zoom.days, bar.to) + 2}` }}
                      role="button"
                      tabIndex={0}
                      aria-label={`${t.title} 일정 막대`}
                      onPointerDown={(e) => startDrag(e, t, 'move')}
                      onKeyDown={(e) => e.key === 'Enter' && open(t.id)}
                    >
                      <span>{t.title}</span>
                      {!bar.clippedEnd ? <b className="tl__grip" onPointerDown={(e) => startDrag(e, t, 'resize')} aria-hidden="true" /> : null}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
          {todayIdx >= 0 ? <i className="tl__today" style={{ left: `calc(14rem + ${todayIdx * CELL_PX + CELL_PX / 2}px)` }} aria-hidden="true" /> : null}
        </div>
      </div>

      {dated.length === 0 ? <p className="tl__empty">날짜가 있는 할 일이 없어요. 시작일이나 마감일을 정하면 여기에 막대로 나타나요.</p> : null}

      {undated.length > 0 ? (
        <section className="tl__undated" aria-label="날짜 없는 할 일">
          <h3>날짜 없음 <span>{undated.length}</span></h3>
          <ul>
            {undated.slice(0, 30).map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => open(t.id)}>{t.title}</button>
                <button type="button" className="chip-btn" onClick={() => actions.patch(t.id, { startDate: today }, '일정 지정')}>
                  오늘로
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
