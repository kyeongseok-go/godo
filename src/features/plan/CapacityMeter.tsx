import { useMemo, useRef, useState } from 'react'
import { dayLoad } from '../../domain/planning'
import type { ISODate } from '../../domain/types'
import { useSettings, useTable } from '../../hooks/data'
import { useApp } from '../../store/app'
import { Popover } from '../../ui/Popover'
import { CapacityEditor } from './CapacityEditor'
import { describeLoad } from './logic'
import './plan.css'

interface CapacityMeterProps {
  date: ISODate
}

/**
 * 하루 용량 막대. 계획된 시간 합계 / 용량을 보여주고, 넘치면 주홍색과 "N 넘쳤어요" 문구로 알린다.
 * 용량 숫자를 누르면 그날 용량만 바꿀 수 있다. 오늘 화면에도 이 컴포넌트를 그대로 끼워 쓴다.
 */
export function CapacityMeter({ date }: CapacityMeterProps) {
  const tasks = useTable('tasks')
  const settings = useSettings()
  const override = useApp((s) => s.entities.dayPlans[date]?.capacityMin ?? null)
  const capacityMin = override ?? settings.dailyCapacityMin
  const [editing, setEditing] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)

  const load = useMemo(
    () => dayLoad(date, tasks, capacityMin, settings.defaultDurationMin),
    [date, tasks, capacityMin, settings.defaultDurationMin],
  )
  const text = describeLoad(load)
  // 넘친 날은 막대 폭을 계획 합계에 맞추고, 용량 지점을 눈금으로 남긴다
  const track = Math.max(load.plannedMin, load.capacityMin, 1)
  const fill = load.plannedMin / track
  const markAt = (load.capacityMin / track) * 100

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
        className="capmeter__track"
        role="meter"
        aria-label="계획한 시간"
        aria-valuemin={0}
        aria-valuemax={Math.max(load.capacityMin, load.plannedMin)}
        aria-valuenow={load.plannedMin}
        aria-valuetext={`${text.used} / ${text.total}. ${text.note}`}
      >
        <span className="capmeter__fill" style={{ transform: `scaleX(${fill})` }} />
        {load.level === 'over' ? <span className="capmeter__mark" style={{ left: `${markAt}%` }} /> : null}
      </div>
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
