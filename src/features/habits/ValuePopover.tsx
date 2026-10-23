import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { habitValue } from '../../domain/stats'
import type { Habit, ISODate } from '../../domain/types'
import { Popover } from '../../ui/Popover'
import { formatMonthDay } from './habitView'

interface ValuePopoverProps {
  habit: Habit | null
  date: ISODate
  anchorRef: RefObject<HTMLElement | null>
  onSave: (value: number) => void
  onClose: () => void
}

/** count 습관의 하루 값을 직접 입력한다. 0 으로 저장하면 그날 기록이 지워진다. */
export function ValuePopover({ habit, date, anchorRef, onSave, onClose }: ValuePopoverProps) {
  return (
    <Popover open={habit !== null} anchorRef={anchorRef} onClose={onClose} label="값 입력">
      {habit ? <ValueForm key={`${habit.id}:${date}`} habit={habit} date={date} onSave={onSave} onClose={onClose} /> : null}
    </Popover>
  )
}

interface ValueFormProps {
  habit: Habit
  date: ISODate
  onSave: (value: number) => void
  onClose: () => void
}

function ValueForm({ habit, date, onSave, onClose }: ValueFormProps) {
  const [text, setText] = useState(() => String(habitValue(habit, date)))
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => inputRef.current?.select(), [])

  const parsed = Number(text)
  const valid = text.trim() !== '' && Number.isFinite(parsed) && parsed >= 0
  const submit = (value: number) => {
    onSave(value)
    onClose()
  }

  return (
    <form
      className="hvalue"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) submit(parsed)
      }}
    >
      <label className="hvalue__label" htmlFor="habit-value-input">
        {habit.name} · {formatMonthDay(date)}
      </label>
      <div className="hvalue__row">
        <input
          id="habit-value-input"
          ref={inputRef}
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-invalid={!valid}
        />
        <span className="hvalue__unit">
          / {habit.goal.target}
          {habit.goal.unit ?? ''}
        </span>
      </div>
      <div className="hvalue__actions">
        <button type="button" className="btn-ghost" onClick={() => submit(0)}>
          지우기
        </button>
        <button type="submit" className="btn-accent" disabled={!valid}>
          저장
        </button>
      </div>
    </form>
  )
}
