import { Repeat2, X } from 'lucide-react'
import { useState } from 'react'
import type { RefObject } from 'react'
import { addDays, addMonths } from '../../domain/date'
import { nextWeekStart, upcomingSaturday } from '../../domain/calendarGrid'
import { describeRule, presetRule } from '../../domain/recurrence'
import type { DayPart, ISODate, RecurrenceRule, Task, TimeOfDay } from '../../domain/types'
import { Popover } from '../../ui/Popover'
import { CalendarGrid } from './CalendarGrid'
import { RepeatEditor } from './RepeatEditor'
import './date-popover.css'

export type SchedulePatch = Pick<Task, 'startDate' | 'startTime' | 'durationMin' | 'dayPart' | 'recurrence' | 'someday'>

interface DatePopoverProps {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
  value: SchedulePatch
  today: ISODate
  weekStartsOn: 0 | 1
  onChange: (patch: Partial<SchedulePatch>) => void
}

const DURATIONS = [0, 15, 30, 45, 60, 90, 120, 180] as const
const PARTS: ReadonlyArray<{ id: DayPart; label: string }> = [
  { id: 'morning', label: '오전' },
  { id: 'afternoon', label: '오후' },
  { id: 'evening', label: '저녁' },
]
const PRESETS = [
  { id: 'none', label: '반복 안 함' },
  { id: 'daily', label: '매일' },
  { id: 'weekdays', label: '평일마다' },
  { id: 'weekly', label: '매주' },
  { id: 'monthly', label: '매월' },
  { id: 'yearly', label: '매년' },
  { id: 'custom', label: '사용자 지정…' },
] as const

/** 시작일·시각·소요시간·하루 중 구간·반복을 한 팝오버에서 고른다. 바꾸는 즉시 반영한다. */
export function DatePopover({ open, anchorRef, onClose, value, today, weekStartsOn, onChange }: DatePopoverProps) {
  const [custom, setCustom] = useState(false)
  const base = value.startDate ?? today

  const quick: ReadonlyArray<{ label: string; date: ISODate | null }> = [
    { label: '오늘', date: today },
    { label: '내일', date: addDays(today, 1) },
    { label: '이번 주말', date: upcomingSaturday(today) },
    { label: '다음 주', date: nextWeekStart(today, weekStartsOn) },
    { label: '다음 달', date: addMonths(today, 1) },
    { label: '날짜 없음', date: null },
  ]

  const pickDate = (date: ISODate | null) => {
    onChange({ startDate: date, someday: false, ...(date === null ? { startTime: null, dayPart: null, recurrence: null } : {}) })
  }

  const presetId = value.recurrence
    ? isSameAsPreset(value.recurrence, base)
    : 'none'
  // 프리셋에 없는 규칙(예: 2주마다 화·목)은 select 에서 '사용자 지정'을 다시 고를 수 없으니 처음부터 편집기를 보여 준다.
  const isCustom = custom || presetId === 'custom'

  const choosePreset = (id: string) => {
    if (id === 'none') {
      onChange({ recurrence: null })
      setCustom(false)
    } else if (id === 'custom') {
      onChange({ recurrence: value.recurrence ?? presetRule('weekly', base), startDate: value.startDate ?? base })
      setCustom(true)
    } else {
      onChange({
        recurrence: presetRule(id as 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly', base),
        startDate: value.startDate ?? base,
      })
      setCustom(false)
    }
  }

  return (
    <Popover open={open} anchorRef={anchorRef} onClose={onClose} label="날짜 선택">
      <div className="datepop">
        <div className="datepop__quick">
          {quick.map((q) => (
            <button
              key={q.label}
              type="button"
              className="chip-btn"
              data-active={q.date === value.startDate && !value.someday}
              onClick={() => pickDate(q.date)}
            >
              {q.label}
            </button>
          ))}
          <button
            type="button"
            className="chip-btn"
            data-active={value.someday}
            onClick={() => onChange({ someday: !value.someday, startDate: null })}
          >
            언젠가
          </button>
        </div>

        <CalendarGrid selected={value.startDate} today={today} weekStartsOn={weekStartsOn} onSelect={pickDate} />

        <div className="datepop__row">
          <label htmlFor="dp-time">시각</label>
          <input
            id="dp-time"
            type="time"
            value={value.startTime ?? ''}
            onChange={(e) =>
              onChange({
                startTime: (e.target.value || null) as TimeOfDay | null,
                startDate: value.startDate ?? today,
                dayPart: e.target.value ? null : value.dayPart,
              })
            }
          />
          {value.startTime ? (
            <button type="button" className="icon-btn" aria-label="시각 지우기" onClick={() => onChange({ startTime: null, durationMin: null })}>
              <X size={14} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {!value.startTime ? (
          <div className="datepop__row" role="group" aria-label="하루 중 구간">
            <span>하루 중</span>
            <div className="seg">
              {PARTS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={value.dayPart === p.id}
                  onClick={() => onChange({ dayPart: value.dayPart === p.id ? null : p.id, startDate: value.startDate ?? today })}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="datepop__row">
            <label htmlFor="dp-dur">소요 시간</label>
            <select
              id="dp-dur"
              value={value.durationMin ?? 0}
              onChange={(e) => onChange({ durationMin: Number(e.target.value) || null })}
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d === 0 ? '없음' : d >= 60 && d % 60 === 0 ? `${d / 60}시간` : d > 60 ? `${Math.floor(d / 60)}시간 ${d % 60}분` : `${d}분`}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="datepop__row">
          <Repeat2 size={14} aria-hidden="true" />
          <select aria-label="반복" value={isCustom ? 'custom' : presetId} onChange={(e) => choosePreset(e.target.value)}>
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {value.recurrence && !isCustom ? (
          <p className="datepop__summary">{describeRule(value.recurrence, base)}</p>
        ) : null}
        {value.recurrence && isCustom ? (
          <RepeatEditor rule={value.recurrence} startDate={base} onChange={(rule) => onChange({ recurrence: rule })} />
        ) : null}
      </div>
    </Popover>
  )
}

/** 현재 규칙이 프리셋과 같으면 그 프리셋 id를, 아니면 'custom'을 돌려준다 */
function isSameAsPreset(rule: RecurrenceRule, start: ISODate): string {
  for (const id of ['daily', 'weekdays', 'weekly', 'monthly', 'yearly'] as const) {
    const preset = presetRule(id, start)
    if (JSON.stringify({ ...preset, doneCount: undefined }) === JSON.stringify({ ...rule, doneCount: undefined })) return id
  }
  return 'custom'
}
