import { Check } from 'lucide-react'
import type { ID, ISODate, Project } from '../../domain/types'
import '../plan/ritual.css'
import { allProjectChoices, QUICK_PROJECT_COUNT, quickDates } from './logic'
import './triage.css'

interface TriageAcceptProps {
  projects: readonly Project[]
  quick: readonly Project[]
  today: ISODate
  weekStartsOn: 0 | 1
  projectId: ID | null
  date: ISODate | null
  onProject: (id: ID) => void
  onDate: (date: ISODate | null) => void
  onConfirm: () => void
  onCancel: () => void
}

/** "수락"을 눌렀을 때: 프로젝트(숫자 키)와 날짜(T·M·W·0)를 정하고 Enter 로 옮긴다 */
export function TriageAccept(props: TriageAcceptProps) {
  const { projects, quick, today, weekStartsOn, projectId, date } = props
  const extra = allProjectChoices(projects).slice(QUICK_PROJECT_COUNT)
  const dates = quickDates(today, weekStartsOn)

  return (
    <section className="triage-accept" aria-label="프로젝트와 날짜 정하기">
      <div>
        <h3 className="triage-accept__label">어느 프로젝트로?</h3>
        <div className="triage-chips" role="group" aria-label="프로젝트">
          {quick.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className="triage-chip"
              aria-pressed={projectId === p.id}
              onClick={() => props.onProject(p.id)}
            >
              <kbd className="keycap" aria-hidden="true">
                {i + 1}
              </kbd>
              <i style={{ background: p.color }} aria-hidden="true" />
              {p.name}
            </button>
          ))}
        </div>
        {extra.length > 0 ? (
          <label className="triage-accept__more">
            <span className="sr-only">다른 프로젝트 고르기</span>
            <select value={extra.some((p) => p.id === projectId) ? (projectId ?? '') : ''} onChange={(e) => e.target.value && props.onProject(e.target.value)}>
              <option value="">그 밖의 프로젝트…</option>
              {extra.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {quick.length === 0 ? <p className="triage-accept__empty">프로젝트가 아직 없어요. 사이드바에서 만들 수 있어요.</p> : null}
      </div>
      <div>
        <h3 className="triage-accept__label">언제 할까요? (고르지 않아도 돼요)</h3>
        <div className="triage-chips" role="group" aria-label="날짜">
          {dates.map((d) => (
            <button
              key={d.key}
              type="button"
              className="triage-chip"
              aria-pressed={date === d.date}
              onClick={() => props.onDate(date === d.date ? null : d.date)}
            >
              <kbd className="keycap" aria-hidden="true">
                {d.key.toUpperCase()}
              </kbd>
              {d.label}
            </button>
          ))}
          <button type="button" className="triage-chip" aria-pressed={date === null} onClick={() => props.onDate(null)}>
            <kbd className="keycap" aria-hidden="true">
              0
            </kbd>
            날짜 없음
          </button>
        </div>
      </div>
      <div className="triage-accept__actions">
        <button type="button" className="ritual-btn ritual-btn--primary" disabled={projectId === null} onClick={props.onConfirm}>
          <Check size={17} aria-hidden="true" />
          옮기기
          <kbd className="keycap" aria-hidden="true">
            ↵
          </kbd>
        </button>
        <button type="button" className="ritual-btn ritual-btn--quiet" onClick={props.onCancel}>
          돌아가기
          <kbd className="keycap" aria-hidden="true">
            Esc
          </kbd>
        </button>
      </div>
    </section>
  )
}
