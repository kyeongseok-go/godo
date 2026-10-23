import { useId, useState } from 'react'
import { useSettings } from '../../hooks/data'
import { useApp } from '../../store/app'
import type { PomodoroConfig } from './timer'

type NumericKey = 'focusMin' | 'shortBreakMin' | 'longBreakMin' | 'longBreakEvery'

interface FieldSpec {
  key: NumericKey
  label: string
  unit: string
  min: number
  max: number
}

const FIELDS: readonly FieldSpec[] = [
  { key: 'focusMin', label: '집중', unit: '분', min: 1, max: 180 },
  { key: 'shortBreakMin', label: '짧은 휴식', unit: '분', min: 1, max: 60 },
  { key: 'longBreakMin', label: '긴 휴식', unit: '분', min: 1, max: 120 },
  { key: 'longBreakEvery', label: '긴 휴식 간격', unit: '회', min: 2, max: 12 },
]

function saveSetting(patch: Partial<PomodoroConfig>): void {
  const state = useApp.getState()
  state.updateSettings({ pomodoro: { ...state.settings.pomodoro, ...patch } })
}

interface NumberFieldProps {
  spec: FieldSpec
  value: number
}

/** 입력 중에는 비워 둘 수 있어야 하므로 글자 상태를 따로 두고, 유효한 정수일 때만 저장한다. */
function NumberField({ spec, value }: NumberFieldProps) {
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? String(value)
  const parsed = Number(text)
  const isValid = text.trim() !== '' && Number.isInteger(parsed) && parsed >= spec.min && parsed <= spec.max

  return (
    <div className="focus-field">
      <label htmlFor={id}>{spec.label}</label>
      <div className="focus-field__input">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={spec.min}
          max={spec.max}
          value={text}
          aria-invalid={!isValid}
          aria-describedby={isValid ? undefined : `${id}-hint`}
          onChange={(e) => {
            setDraft(e.target.value)
            const next = Number(e.target.value)
            if (e.target.value.trim() !== '' && Number.isInteger(next) && next >= spec.min && next <= spec.max) {
              saveSetting({ [spec.key]: next })
            }
          }}
          onBlur={() => setDraft(null)}
        />
        <span>{spec.unit}</span>
      </div>
      {isValid ? null : (
        <p className="focus-field__hint" id={`${id}-hint`}>
          {spec.min}~{spec.max} 사이 정수로 입력하세요
        </p>
      )}
    </div>
  )
}

export function FocusSettings() {
  const config = useSettings().pomodoro

  return (
    <details className="focus-prefs">
      <summary className="focus-side-title">타이머 설정</summary>
      <div className="focus-prefs__grid">
        {FIELDS.map((spec) => (
          <NumberField key={spec.key} spec={spec} value={config[spec.key]} />
        ))}
      </div>
      <label className="focus-prefs__switch">
        <input type="checkbox" checked={config.autoStart} onChange={(e) => saveSetting({ autoStart: e.target.checked })} />
        다음 세션 자동 시작
      </label>
      <label className="focus-prefs__switch">
        <input type="checkbox" checked={config.sound} onChange={(e) => saveSetting({ sound: e.target.checked })} />
        끝나면 알림음 재생
      </label>
    </details>
  )
}
