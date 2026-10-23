// 설정 화면이 함께 쓰는 입력 조각. 전부 접근 가능한 이름과 키보드 조작을 갖춘다.
import { createContext, useContext, useId, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import type { SelectOption } from './options'

interface FieldIds {
  labelId: string
  controlId: string
  hintId: string
  errorId: string
}

const FieldContext = createContext<FieldIds | null>(null)

function useFieldIds(): FieldIds {
  const ids = useContext(FieldContext)
  if (!ids) throw new Error('입력 조각은 <Row> 안에서만 쓸 수 있어요')
  return ids
}

interface GroupProps {
  title: string
  description?: string
  children: ReactNode
}

/** 굵은 괘선으로 열리는 설정 묶음 */
export function Group({ title, description, children }: GroupProps) {
  const id = useId()
  return (
    <section className="st-group" aria-labelledby={id}>
      <h3 id={id} className="st-group__title">
        {title}
      </h3>
      {description ? <p className="st-group__desc">{description}</p> : null}
      <div className="st-group__rows">{children}</div>
    </section>
  )
}

interface RowProps {
  label: string
  hint?: string
  /** 라디오 그룹처럼 <label>로 묶을 수 없는 조작 요소일 때 켠다 */
  group?: boolean
  children: ReactNode
}

/** 왼쪽에 이름과 설명, 오른쪽에 조작 요소를 두는 한 줄 */
export function Row({ label, hint, group = false, children }: RowProps) {
  const base = useId()
  const ids: FieldIds = {
    labelId: `${base}-label`,
    controlId: `${base}-control`,
    hintId: `${base}-hint`,
    errorId: `${base}-error`,
  }
  return (
    <FieldContext.Provider value={ids}>
      <div className="st-row">
        <div className="st-row__text">
          {group ? (
            <span id={ids.labelId} className="st-row__label">
              {label}
            </span>
          ) : (
            <label id={ids.labelId} htmlFor={ids.controlId} className="st-row__label">
              {label}
            </label>
          )}
          {hint ? (
            <p id={ids.hintId} className="st-row__hint">
              {hint}
            </p>
          ) : null}
        </div>
        <div className="st-row__control">
          {children}
        </div>
      </div>
    </FieldContext.Provider>
  )
}

/** 조작할 것이 없는 안내 줄(크레딧 등) */
export function InfoRow({ label, hint, children }: Omit<RowProps, 'group'>) {
  return (
    <div className="st-row">
      <div className="st-row__text">
        <p className="st-row__label">{label}</p>
        {hint ? <p className="st-row__hint">{hint}</p> : null}
      </div>
      <div className="st-row__control">{children}</div>
    </div>
  )
}

function describedBy(ids: FieldIds, hasHint: boolean, hasError: boolean): string | undefined {
  const parts = [hasError ? ids.errorId : null, hasHint ? ids.hintId : null].filter((p): p is string => p !== null)
  return parts.length > 0 ? parts.join(' ') : undefined
}

interface SelectFieldProps {
  value: string
  options: readonly SelectOption[]
  onChange: (value: string) => void
  hasHint?: boolean
}

export function SelectField({ value, options, onChange, hasHint = false }: SelectFieldProps) {
  const ids = useFieldIds()
  const groups = [...new Set(options.flatMap((o) => (o.group ? [o.group] : [])))]
  const plain = options.filter((o) => !o.group)
  return (
    <select
      id={ids.controlId}
      className="st-select"
      value={value}
      aria-describedby={describedBy(ids, hasHint, false)}
      onChange={(e) => onChange(e.target.value)}
    >
      {plain.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
      {groups.map((group) => (
        <optgroup key={group} label={group}>
          {options
            .filter((o) => o.group === group)
            .map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  )
}

interface SegmentedProps<T extends string> {
  value: T
  options: ReadonlyArray<{ value: T; label: ReactNode; ariaLabel?: string }>
  onChange: (value: T) => void
  hasHint?: boolean
}

/** 라디오 그룹 패턴: 선택된 칸만 탭으로 들어가고, 화살표로 옮기면서 바로 선택한다. */
export function Segmented<T extends string>({ value, options, onChange, hasHint = false }: SegmentedProps<T>) {
  const ids = useFieldIds()
  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    const next = options[(index + step + options.length) % options.length]
    onChange(next.value)
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
    buttons?.[(index + step + options.length) % options.length]?.focus()
  }
  return (
    <div
      id={ids.controlId}
      className="st-seg"
      role="radiogroup"
      aria-labelledby={ids.labelId}
      aria-describedby={describedBy(ids, hasHint, false)}
    >
      {options.map((o, index) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          aria-label={o.ariaLabel}
          tabIndex={o.value === value ? 0 : -1}
          className="st-seg__item"
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => move(e, index)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  hasHint?: boolean
}

/** 켜짐/꺼짐을 색뿐 아니라 글자와 손잡이 위치로도 보여 주는 스위치 */
export function Switch({ checked, onChange, hasHint = false }: SwitchProps) {
  const ids = useFieldIds()
  return (
    <button
      id={ids.controlId}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={ids.labelId}
      aria-describedby={describedBy(ids, hasHint, false)}
      className="st-switch"
      onClick={() => onChange(!checked)}
    >
      <span className="st-switch__state" aria-hidden="true">
        {checked ? '켜짐' : '꺼짐'}
      </span>
      <span className="st-switch__track" aria-hidden="true">
        <span className="st-switch__thumb" />
      </span>
    </button>
  )
}

function FieldError({ message }: { message: string | null }) {
  const ids = useFieldIds()
  return message ? (
    <p id={ids.errorId} className="st-row__error" role="alert">
      {message}
    </p>
  ) : null
}

interface NumberFieldProps {
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onCommit: (value: number) => void
  hasHint?: boolean
}

/** 입력하는 동안은 초안을 들고 있다가, 범위 안의 정수일 때만 저장한다. 포커스를 잃으면 저장된 값으로 돌아간다. */
export function NumberField({ value, min, max, step = 1, unit, onCommit, hasHint = false }: NumberFieldProps) {
  const ids = useFieldIds()
  const [draft, setDraft] = useState<string | null>(null)
  const isValid = (raw: string): boolean => {
    const n = Number(raw)
    return raw.trim() !== '' && Number.isInteger(n) && n >= min && n <= max
  }
  const error = draft !== null && !isValid(draft) ? `${min}에서 ${max} 사이의 정수로 입력해 주세요` : null

  const change = (raw: string): void => {
    setDraft(raw)
    if (isValid(raw)) onCommit(Number(raw))
  }

  return (
    <>
      <span className="st-number">
        <input
          id={ids.controlId}
          className="st-input"
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          value={draft ?? String(value)}
          aria-invalid={error !== null}
          aria-describedby={describedBy(ids, hasHint, error !== null)}
          onChange={(e) => change(e.target.value)}
          onBlur={() => setDraft(null)}
        />
        {unit ? <span className="st-number__unit">{unit}</span> : null}
      </span>
      <FieldError message={error} />
    </>
  )
}

interface TimeFieldProps {
  value: string
  onCommit: (value: string) => void
  /** 올바르지 않으면 안내 문구를, 괜찮으면 null 을 돌려준다 */
  validate?: (value: string) => string | null
  hasHint?: boolean
}

export function TimeField({ value, onCommit, validate, hasHint = false }: TimeFieldProps) {
  const ids = useFieldIds()
  const [draft, setDraft] = useState<string | null>(null)
  const problem = (raw: string): string | null => (raw === '' ? '시각을 입력해 주세요' : (validate?.(raw) ?? null))
  const error = draft !== null ? problem(draft) : null

  const change = (raw: string): void => {
    setDraft(raw)
    if (problem(raw) === null) onCommit(raw)
  }

  return (
    <>
      <input
        id={ids.controlId}
        className="st-input st-input--time"
        type="time"
        value={draft ?? value}
        aria-invalid={error !== null}
        aria-describedby={describedBy(ids, hasHint, error !== null)}
        onChange={(e) => change(e.target.value)}
        onBlur={() => setDraft(null)}
      />
      <FieldError message={error} />
    </>
  )
}

interface TextFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  hasHint?: boolean
}

export function TextField({ value, onChange, placeholder, hasHint = false }: TextFieldProps) {
  const ids = useFieldIds()
  return (
    <input
      id={ids.controlId}
      className="st-input st-input--text"
      type="text"
      value={value}
      placeholder={placeholder}
      aria-describedby={describedBy(ids, hasHint, false)}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
