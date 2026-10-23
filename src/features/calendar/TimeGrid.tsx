import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { fromISODate, minutesOfDay, timeFromMinutes, WEEKDAY_KO } from '../../domain/date'
import { describeDate, formatTime } from '../../domain/format'
import type { ISODate, Task } from '../../domain/types'
import { useNow, useSettings } from '../../hooks/data'
import { useOpenTask } from '../../hooks/openTask'
import { useTaskActions } from '../../hooks/actions'
import { useUI } from '../../store/ui'
import type { QuickAddDefaults } from '../../store/ui'
import { blockMinutes, clampMinutes, layoutSpans, snapMinutes } from './layout'
import type { Occurrence } from './layout'
import './time-grid.css'

const HOUR_PX = 56
const STEP = 15
const MIN_BLOCK = 15
/** 이만큼은 움직여야 끌기로 본다. 누르는 순간의 손떨림을 '일정 이동'으로 기록하지 않기 위한 값이다. */
const DRAG_THRESHOLD_PX = 4
const HOURS = Array.from({ length: 24 }, (_, h) => h)

interface TimeGridProps {
  days: readonly ISODate[]
  today: ISODate
  occurrences: ReadonlyMap<ISODate, Occurrence[]>
  defaults?: QuickAddDefaults
}

interface DragState {
  taskId: string
  mode: 'move' | 'resize'
  date: ISODate
  start: number
  duration: number
  moved: boolean
}

const px = (minutes: number): number => (minutes / 60) * HOUR_PX

/** 주/일 시간표. 블록을 끌면 날짜·시각이, 아래쪽 끝을 끌면 길이가 15분 단위로 바뀐다. */
export function TimeGrid({ days, today, occurrences, defaults }: TimeGridProps) {
  const settings = useSettings()
  const actions = useTaskActions()
  const { open } = useOpenTask()
  const openQuickAdd = useUI((s) => s.openQuickAdd)
  const now = useNow()
  const scrollRef = useRef<HTMLDivElement>(null)
  const colsRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  dragRef.current = drag

  useEffect(() => {
    // 처음 열 때 업무 시작 시각 근처로 스크롤한다.
    if (scrollRef.current) scrollRef.current.scrollTop = Math.max(0, px(minutesOfDay(settings.workStart) - 60) - 10)
  }, [settings.workStart])

  const untimed = useMemo(
    () => days.map((d) => (occurrences.get(d) ?? []).filter((o) => !o.task.startTime)),
    [days, occurrences],
  )

  const dateAtPoint = (clientX: number): ISODate | null => {
    const cols = colsRef.current?.querySelectorAll<HTMLElement>('[data-date]')
    if (!cols) return null
    for (const c of cols) {
      const r = c.getBoundingClientRect()
      if (clientX >= r.left && clientX < r.right) return c.dataset.date as ISODate
    }
    return null
  }

  const minutesAtPoint = (clientY: number): number => {
    const r = colsRef.current?.getBoundingClientRect()
    return r ? ((clientY - r.top) / HOUR_PX) * 60 : 0
  }

  const startDrag = (e: ReactPointerEvent, o: Occurrence, mode: 'move' | 'resize') => {
    if (o.virtual || e.button !== 0) return
    e.stopPropagation()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    const startMin = minutesOfDay(o.task.startTime as string)
    const dur = blockMinutes(o.task, settings.defaultDurationMin)
    const grabOffset = minutesAtPoint(e.clientY) - startMin
    const origin = { x: e.clientX, y: e.clientY }
    setDrag({ taskId: o.task.id, mode, date: o.date, start: startMin, duration: dur, moved: false })

    const onMove = (ev: PointerEvent) => {
      const cur = dragRef.current
      if (!cur) return
      // 임계값을 넘기 전에는 아직 누르기로 본다. 1px 움직임이 끌기로 기록되는 것을 막는다.
      const far = Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) >= DRAG_THRESHOLD_PX
      if (!cur.moved && !far) return
      if (mode === 'move') {
        const date = dateAtPoint(ev.clientX) ?? cur.date
        const start = clampMinutes(snapMinutes(minutesAtPoint(ev.clientY) - grabOffset, STEP))
        setDrag({ ...cur, date, start: Math.min(start, 24 * 60 - MIN_BLOCK), moved: true })
      } else {
        const end = snapMinutes(minutesAtPoint(ev.clientY), STEP)
        setDrag({ ...cur, duration: Math.max(MIN_BLOCK, Math.min(end - cur.start, 24 * 60 - cur.start)), moved: true })
      }
    }
    const onUp = () => {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
      const final = dragRef.current
      setDrag(null)
      if (!final) return
      if (!final.moved) return open(final.taskId)
      // 끌었다가 제자리로 돌아왔으면 아무것도 바꾸지 않는다. 안 바뀐 값을 쓰면 실행 취소 항목만 쌓인다.
      const patch: Partial<Task> = {}
      if (final.date !== o.date) patch.startDate = final.date
      if (final.start !== startMin) patch.startTime = timeFromMinutes(final.start)
      if (final.duration !== dur) patch.durationMin = final.duration
      if (Object.keys(patch).length === 0) return
      actions.patch(final.taskId, patch, '일정 이동')
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const columns = `3.25rem repeat(${days.length}, minmax(0, 1fr))`

  return (
    <div className="tgrid" style={{ ['--hour-px' as string]: `${HOUR_PX}px` }}>
      <div className="tgrid__head" style={{ gridTemplateColumns: columns }}>
        <span />
        {days.map((d, i) => {
          const date = fromISODate(d)
          return (
            <div key={d} className="tgrid__day" data-today={d === today}>
              <small>{WEEKDAY_KO[date.getDay()]}</small>
              <strong>{date.getDate()}</strong>
              <ul className="tgrid__untimed">
                {untimed[i].slice(0, 3).map((o) => (
                  <li key={`${o.task.id}-${o.date}`} data-virtual={o.virtual} data-priority={o.task.priority}>
                    <button type="button" onClick={() => open(o.task.id)}>
                      {o.task.title}
                    </button>
                  </li>
                ))}
                {untimed[i].length > 3 ? <li className="tgrid__more">+{untimed[i].length - 3}</li> : null}
              </ul>
            </div>
          )
        })}
      </div>

      <div className="tgrid__scroll" ref={scrollRef}>
        <div className="tgrid__body" style={{ gridTemplateColumns: columns, height: HOUR_PX * 24 }}>
          <div className="tgrid__hours" aria-hidden="true">
            {HOURS.map((h) => (
              <span key={h} style={{ top: h * HOUR_PX }}>
                {h === 0 ? '' : formatTime(timeFromMinutes(h * 60), settings.timeFormat).replace(':00', '')}
              </span>
            ))}
          </div>
          <div className="tgrid__cols" ref={colsRef} style={{ gridColumn: `2 / span ${days.length}`, gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
            {days.map((d) => {
              // 끌고 있는 블록도 DOM에 남겨 둔다. 지우면 포인터 캡처가 풀려 move/up 이벤트가 끊긴다(원본은 흐리게만 한다).
              const timed = (occurrences.get(d) ?? []).filter((o) => o.task.startTime)
              const ghost = drag && drag.date === d ? allFor(occurrences, drag.taskId).find((o) => !o.virtual) : undefined
              const spans = layoutSpans(
                timed.map((o) => {
                  const start = minutesOfDay(o.task.startTime as string)
                  return { id: `${o.task.id}|${o.date}`, start, end: start + blockMinutes(o.task, settings.defaultDurationMin) }
                }),
              )
              return (
                <div
                  key={d}
                  className="tgrid__col"
                  data-date={d}
                  data-today={d === today}
                  onClick={(e) => {
                    if (e.target !== e.currentTarget) return
                    const rect = e.currentTarget.getBoundingClientRect()
                    const minutes = clampMinutes(snapMinutes(((e.clientY - rect.top) / HOUR_PX) * 60 - STEP / 2, 30))
                    openQuickAdd({ ...defaults, startDate: d, startTime: timeFromMinutes(minutes) })
                  }}
                >
                  {HOURS.map((h) => (
                    <i key={h} className="tgrid__line" style={{ top: h * HOUR_PX }} />
                  ))}
                  {d === today ? <i className="tgrid__now" style={{ top: px(nowMinutes) }} aria-hidden="true" /> : null}
                  {timed.map((o) => {
                    const placed = spans.find((s) => s.id === `${o.task.id}|${o.date}`)
                    if (!placed) return null
                    return (
                      <Block
                        key={placed.id}
                        occurrence={o}
                        top={px(placed.start)}
                        height={Math.max(px(MIN_BLOCK), px(placed.end - placed.start))}
                        column={placed.column}
                        columns={placed.columns}
                        timeFormat={settings.timeFormat}
                        dimmed={drag?.taskId === o.task.id}
                        onPointerDown={startDrag}
                        onOpen={() => open(o.task.id)}
                      />
                    )
                  })}
                  {drag && drag.date === d && ghost ? (
                    <Block
                      occurrence={{ ...ghost, date: d }}
                      top={px(drag.start)}
                      height={Math.max(px(MIN_BLOCK), px(drag.duration))}
                      column={0}
                      columns={1}
                      timeFormat={settings.timeFormat}
                      ghost
                      overrideTime={timeFromMinutes(drag.start)}
                    />
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <p className="sr-only">{days.map((d) => describeDate(d, today)).join(', ')} 시간표</p>
    </div>
  )
}

function allFor(map: ReadonlyMap<ISODate, Occurrence[]>, taskId: string): Occurrence[] {
  const out: Occurrence[] = []
  for (const list of map.values()) for (const o of list) if (o.task.id === taskId) out.push(o)
  return out
}

interface BlockProps {
  occurrence: Occurrence
  top: number
  height: number
  column: number
  columns: number
  timeFormat: '12h' | '24h'
  ghost?: boolean
  /** 다른 곳으로 끌려가는 중인 원본 블록 */
  dimmed?: boolean
  overrideTime?: string
  onPointerDown?: (e: ReactPointerEvent, o: Occurrence, mode: 'move' | 'resize') => void
  onOpen?: () => void
}

function Block({ occurrence: o, top, height, column, columns, timeFormat, ghost, dimmed, overrideTime, onPointerDown, onOpen }: BlockProps) {
  const t: Task = o.task
  return (
    <div
      className="tblock"
      data-priority={t.priority}
      data-virtual={o.virtual}
      data-ghost={ghost}
      data-dimmed={dimmed}
      data-done={t.status === 'done'}
      role="button"
      tabIndex={0}
      aria-label={`${t.title} ${formatTime((overrideTime ?? t.startTime) as string, timeFormat)}`}
      style={{ top, height, left: `${(column / columns) * 100}%`, width: `calc(${100 / columns}% - 3px)` }}
      onPointerDown={(e) => onPointerDown?.(e, o, 'move')}
      onKeyDown={(e) => e.key === 'Enter' && onOpen?.()}
    >
      <strong>{t.title}</strong>
      {height > 34 ? <small>{formatTime((overrideTime ?? t.startTime) as string, timeFormat)}</small> : null}
      {!o.virtual && !ghost ? <span className="tblock__resize" onPointerDown={(e) => onPointerDown?.(e, o, 'resize')} aria-hidden="true" /> : null}
    </div>
  )
}

