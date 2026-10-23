import { describeRule, presetRule, validateRule } from '../../domain/recurrence'
import { WEEKDAY_KO } from '../../domain/date'
import type { ISODate, RecurrenceFreq, RecurrenceRule, Weekday } from '../../domain/types'
import './repeat-editor.css'

interface RepeatEditorProps {
  rule: RecurrenceRule
  startDate: ISODate
  onChange: (rule: RecurrenceRule) => void
}

const FREQ_LABEL: Record<RecurrenceFreq, string> = { daily: '일', weekly: '주', monthly: '개월', yearly: '년' }
const WEEKDAY_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0]

/** 사용자 지정 반복 편집기. 바꿀 때마다 검증하고, 규칙 요약을 바로 보여준다. */
export function RepeatEditor({ rule, startDate, onChange }: RepeatEditorProps) {
  const check = validateRule(rule)
  const patch = (next: Partial<RecurrenceRule>) => onChange({ ...rule, ...next })

  const setFreq = (freq: RecurrenceFreq) => {
    const base = presetRule(freq === 'daily' ? 'daily' : freq === 'weekly' ? 'weekly' : freq === 'monthly' ? 'monthly' : 'yearly', startDate)
    onChange({ ...base, interval: rule.interval, anchor: rule.anchor, end: rule.end, resetSubtasks: rule.resetSubtasks })
  }

  const toggleDay = (d: Weekday) => {
    const days = rule.byWeekday ?? []
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d]
    patch({ byWeekday: next.length > 0 ? next : undefined })
  }

  const monthlyMode = rule.nth ? 'nth' : rule.byMonthDay === 'last' ? 'last' : 'day'
  const setMonthlyMode = (mode: string) => {
    const date = new Date(`${startDate}T00:00:00`)
    if (mode === 'last') patch({ byMonthDay: 'last', nth: undefined })
    else if (mode === 'nth') {
      const n = Math.min(4, Math.ceil(date.getDate() / 7)) as 1 | 2 | 3 | 4
      patch({ byMonthDay: undefined, nth: { n, weekday: date.getDay() as Weekday } })
    } else patch({ byMonthDay: date.getDate(), nth: undefined })
  }

  return (
    <div className="repeat">
      <div className="repeat__row">
        <label htmlFor="repeat-interval">매</label>
        <input
          id="repeat-interval"
          type="number"
          min={1}
          max={365}
          value={rule.interval}
          onChange={(e) => patch({ interval: Math.max(1, Number(e.target.value) || 1) })}
        />
        <select aria-label="반복 단위" value={rule.freq} onChange={(e) => setFreq(e.target.value as RecurrenceFreq)}>
          {(Object.keys(FREQ_LABEL) as RecurrenceFreq[]).map((f) => (
            <option key={f} value={f}>
              {FREQ_LABEL[f]}
            </option>
          ))}
        </select>
      </div>

      {rule.freq === 'weekly' ? (
        <div className="repeat__days" role="group" aria-label="요일">
          {WEEKDAY_ORDER.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={(rule.byWeekday ?? []).includes(d)}
              onClick={() => toggleDay(d)}
            >
              {WEEKDAY_KO[d]}
            </button>
          ))}
        </div>
      ) : null}

      {rule.freq === 'monthly' ? (
        <select aria-label="매월 기준" value={monthlyMode} onChange={(e) => setMonthlyMode(e.target.value)}>
          <option value="day">같은 날짜</option>
          <option value="last">마지막 날</option>
          <option value="nth">n번째 요일</option>
        </select>
      ) : null}

      <div className="repeat__row">
        <label htmlFor="repeat-anchor">다음 회차 기준</label>
        <select
          id="repeat-anchor"
          value={rule.anchor}
          onChange={(e) => patch({ anchor: e.target.value as RecurrenceRule['anchor'] })}
        >
          <option value="due">예정일 기준</option>
          <option value="completion">완료한 날 기준</option>
        </select>
      </div>

      <div className="repeat__row">
        <label htmlFor="repeat-end">종료</label>
        <select
          id="repeat-end"
          value={rule.end.type}
          onChange={(e) => {
            const t = e.target.value
            patch({ end: t === 'until' ? { type: 'until', date: startDate } : t === 'count' ? { type: 'count', count: 10 } : { type: 'never' } })
          }}
        >
          <option value="never">계속</option>
          <option value="until">날짜까지</option>
          <option value="count">횟수만큼</option>
        </select>
        {rule.end.type === 'until' ? (
          <input
            type="date"
            aria-label="종료 날짜"
            value={rule.end.date}
            onChange={(e) => e.target.value && patch({ end: { type: 'until', date: e.target.value } })}
          />
        ) : null}
        {rule.end.type === 'count' ? (
          <input
            type="number"
            min={1}
            aria-label="반복 횟수"
            value={rule.end.count}
            onChange={(e) => patch({ end: { type: 'count', count: Math.max(1, Number(e.target.value) || 1) } })}
          />
        ) : null}
      </div>

      <label className="repeat__check">
        <input
          type="checkbox"
          checked={rule.resetSubtasks}
          onChange={(e) => patch({ resetSubtasks: e.target.checked })}
        />
        완료하면 하위 작업을 처음 상태로 되돌리기
      </label>

      <p className="repeat__summary" data-invalid={!check.ok}>
        {check.ok ? describeRule(rule, startDate) : check.message}
      </p>
    </div>
  )
}
