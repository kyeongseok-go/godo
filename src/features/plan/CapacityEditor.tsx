import { useState } from 'react'
import type { FormEvent } from 'react'
import { formatDuration } from '../../domain/format'
import type { ISODate } from '../../domain/types'
import { useApp } from '../../store/app'
import { setCapacity } from './commands'
import { commitQuiet } from './commit'
import { parseCapacityHours } from './logic'
import './ritual.css'

interface CapacityEditorProps {
  date: ISODate
  currentMin: number
  defaultMin: number
  hasOverride: boolean
  onDone: () => void
}

const toHours = (minutes: number): string => String(Math.round((minutes / 60) * 100) / 100)

/** 그날 용량만 바꾸는 작은 입력. "기본값으로"를 누르면 설정의 하루 용량을 따른다. */
export function CapacityEditor({ date, currentMin, defaultMin, hasOverride, onDone }: CapacityEditorProps) {
  const [text, setText] = useState(toHours(currentMin))
  const [error, setError] = useState<string | null>(null)

  const save = (event: FormEvent) => {
    event.preventDefault()
    const minutes = parseCapacityHours(text)
    if (minutes === null) {
      setError('0보다 크고 24 이하인 시간(예: 6 또는 5.5)을 넣어 주세요.')
      return
    }
    commitQuiet(setCapacity(useApp.getState().entities, date, minutes), '하루 용량 변경')
    onDone()
  }

  const reset = () => {
    commitQuiet(setCapacity(useApp.getState().entities, date, null), '하루 용량 기본값으로')
    onDone()
  }

  return (
    <form className="capedit" onSubmit={save}>
      <label className="capedit__field">
        <span>이 날 용량 (시간)</span>
        <input
          type="text"
          inputMode="decimal"
          value={text}
          autoFocus
          aria-invalid={error !== null}
          aria-describedby={error ? 'capedit-error' : undefined}
          onChange={(e) => {
            setText(e.target.value)
            setError(null)
          }}
        />
      </label>
      {error ? (
        <p className="capedit__error" id="capedit-error" role="alert">
          {error}
        </p>
      ) : (
        <p className="capedit__hint">이 날만 바뀌어요. 기본값은 {formatDuration(defaultMin)}예요.</p>
      )}
      <div className="capedit__actions">
        <button type="submit" className="ritual-btn ritual-btn--primary">
          저장
        </button>
        {hasOverride ? (
          <button type="button" className="ritual-btn" onClick={reset}>
            기본값으로
          </button>
        ) : null}
      </div>
    </form>
  )
}
