import { useMemo, useRef, useState } from 'react'
import { timeFromMinutes } from '../../domain/date'
import { formatTime } from '../../domain/format'
import { dayLoad } from '../../domain/planning'
import type { ISODate } from '../../domain/types'
import { useNow, useSettings, useTable, useToday } from '../../hooks/data'
import { useApp } from '../../store/app'
import { Popover } from '../../ui/Popover'
import { CapacityEditor } from './CapacityEditor'
import { describeLoad } from './logic'
import { ribbonPlacement, ribbonPoint, ribbonSegments, ribbonTicks, ribbonWindow } from './ribbon'
import './plan.css'

interface CapacityMeterProps {
  date: ISODate
}

/**
 * 하루 리본: 그날의 시간대를 가로 한 줄로 펼쳐, 시각이 정해진 일이 어디에 앉아 있는지와
 * 계획한 시간 합계 / 용량을 함께 보여 준다. 오늘이면 지금 시각을 호박색 눈금으로 짚는다.
 * 용량 숫자를 누르면 그날 용량만 바꿀 수 있다.
 */
export function CapacityMeter({ date }: CapacityMeterProps) {
  const tasks = useTable('tasks')
  const settings = useSettings()
  const today = useToday()
  const now = useNow()
  const override = useApp((s) => s.entities.dayPlans[date]?.capacityMin ?? null)
  const capacityMin = override ?? settings.dailyCapacityMin
  const [editing, setEditing] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)

  const load = useMemo(
    () => dayLoad(date, tasks, capacityMin, settings.defaultDurationMin),
    [date, tasks, capacityMin, settings.defaultDurationMin],
  )
  const text = describeLoad(load)

  const nowMin = date === today ? now.getHours() * 60 + now.getMinutes() : null
  const segments = useMemo(
    () => ribbonSegments(tasks, date, settings.defaultDurationMin),
    [tasks, date, settings.defaultDurationMin],
  )
  const window = useMemo(
    () => ribbonWindow(settings.workStart, settings.workEnd, segments, nowMin),
    [settings.workStart, settings.workEnd, segments, nowMin],
  )
  const ticks = useMemo(() => ribbonTicks(window), [window])
  const nowAt = nowMin === null ? null : ribbonPoint(window, nowMin)

  return (
    <section className="capmeter" data-level={load.level} aria-label="하루 용량">
      <div className="capmeter__head">
        <p className="capmeter__figures">
          <strong>{text.used}</strong>
          <span aria-hidden="true"> / </span>
          <button
            ref={anchorRef}
            type="button"
            className="capmeter__cap"
            aria-label={`하루 용량 ${text.total}, 눌러서 바꾸기`}
            aria-expanded={editing}
            onClick={() => setEditing((v) => !v)}
          >
            {text.total}
          </button>
        </p>
        <p className="capmeter__note" aria-live="polite">
          {text.note}
        </p>
      </div>

      <div
        className="capmeter__ribbon"
        role="meter"
        aria-label="계획한 시간"
        aria-valuemin={0}
        aria-valuemax={Math.max(load.capacityMin, load.plannedMin)}
        aria-valuenow={load.plannedMin}
        aria-valuetext={`${text.used} / ${text.total}. ${text.note}`}
      >
        {nowAt !== null ? <span className="capmeter__past" style={{ width: `${nowAt}%` }} /> : null}
        {ticks.map((tick) => (
          <span key={tick.atMin} className="capmeter__tick" style={{ left: `${tick.left}%` }} data-label={tick.label} />
        ))}
        {segments.map((segment) => {
          const { left, width } = ribbonPlacement(window, segment.startMin, segment.endMin)
          if (width <= 0) return null
          return (
            <span
              key={segment.id}
              className="capmeter__seg"
              data-priority={segment.priority}
              data-done={segment.done}
              style={{ left: `${left}%`, width: `${width}%` }}
            />
          )
        })}
        {nowAt !== null ? (
          <span className="capmeter__now" data-flip={nowAt > 70} style={{ left: `${nowAt}%` }}>
            <span className="capmeter__now-time">{formatTime(timeFromMinutes(nowMin as number), settings.timeFormat)}</span>
          </span>
        ) : null}
      </div>

      <p className="capmeter__range" aria-hidden="true">
        <span>{formatTime(timeFromMinutes(window.startMin), settings.timeFormat)}</span>
        <span>{formatTime(timeFromMinutes(Math.min(window.endMin, 24 * 60 - 1)), settings.timeFormat)}</span>
      </p>

      <Popover open={editing} anchorRef={anchorRef} onClose={() => setEditing(false)} label="하루 용량 바꾸기">
        <CapacityEditor
          date={date}
          currentMin={capacityMin}
          defaultMin={settings.dailyCapacityMin}
          hasOverride={override !== null}
          onDone={() => setEditing(false)}
        />
      </Popover>
    </section>
  )
}
