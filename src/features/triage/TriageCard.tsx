import { Archive, CalendarClock, CalendarPlus, FolderInput, SkipForward, Sun, Trash2, Undo2 } from 'lucide-react'
import { daysBetween, todayOf } from '../../domain/date'
import type { ISODate, Project, Settings, Task } from '../../domain/types'
import { TaskMeta } from '../tasks/TaskMeta'
import '../plan/ritual.css'
import type { TriageDecision } from './logic'
import './triage.css'

interface TriageCardProps {
  task: Task
  today: ISODate
  settings: Settings
  quick: readonly Project[]
  canUndo: boolean
  onDecide: (decision: TriageDecision) => void
  onAccept: () => void
  onUndo: () => void
}

function Key({ children }: { children: string }) {
  return (
    <kbd className="keycap" aria-hidden="true">
      {children}
    </kbd>
  )
}

function ageText(task: Task, today: ISODate, dayStartHour: number): string {
  const ago = daysBetween(todayOf(new Date(task.createdAt), dayStartHour), today)
  if (ago <= 0) return '오늘 적었어요'
  return `${ago}일 전에 적었어요`
}

/** 항목 하나를 크게 보여 주고 키보드로 바로 처리하는 카드 */
export function TriageCard({ task, today, settings, quick, canUndo, onDecide, onAccept, onUndo }: TriageCardProps) {
  return (
    <article className="triage-card" aria-labelledby="triage-title">
      <p className="triage-card__kicker">{ageText(task, today, settings.dayStartHour)}</p>
      <h3 className="triage-card__title" id="triage-title">
        {task.title}
      </h3>
      {task.description.trim() !== '' ? <p className="triage-card__desc">{task.description}</p> : null}
      <TaskMeta task={task} today={today} settings={settings} labels={[]} />

      <div className="triage-card__actions">
        <button type="button" className="ritual-btn ritual-btn--primary" aria-keyshortcuts="A" onClick={onAccept}>
          <FolderInput size={17} aria-hidden="true" />
          수락(프로젝트 정하기)
          <Key>A</Key>
        </button>
        <button type="button" className="ritual-btn" aria-keyshortcuts="T" onClick={() => onDecide({ type: 'today' })}>
          <Sun size={17} aria-hidden="true" />
          오늘로
          <Key>T</Key>
        </button>
        <button type="button" className="ritual-btn" aria-keyshortcuts="M" onClick={() => onDecide({ type: 'tomorrow' })}>
          <CalendarPlus size={17} aria-hidden="true" />
          내일로
          <Key>M</Key>
        </button>
        <button type="button" className="ritual-btn" aria-keyshortcuts="S" onClick={() => onDecide({ type: 'someday' })}>
          <Archive size={17} aria-hidden="true" />
          언젠가
          <Key>S</Key>
        </button>
        <button type="button" className="ritual-btn ritual-btn--danger" aria-keyshortcuts="X" onClick={() => onDecide({ type: 'delete' })}>
          <Trash2 size={17} aria-hidden="true" />
          삭제
          <Key>X</Key>
        </button>
        <button type="button" className="ritual-btn ritual-btn--quiet" aria-keyshortcuts="N" onClick={() => onDecide({ type: 'skip' })}>
          <SkipForward size={17} aria-hidden="true" />
          건너뛰기
          <Key>N</Key>
        </button>
      </div>

      {quick.length > 0 ? (
        <div className="triage-quick">
          <h4 className="triage-quick__label">
            <CalendarClock size={14} aria-hidden="true" />
            번호 키로 바로 옮기기
          </h4>
          <div className="triage-chips" role="group" aria-label="프로젝트로 바로 옮기기">
            {quick.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className="triage-chip"
                onClick={() => onDecide({ type: 'accept', projectId: p.id, date: null })}
              >
                <kbd className="keycap" aria-hidden="true">
                  {i + 1}
                </kbd>
                <i style={{ background: p.color }} aria-hidden="true" />
                {p.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <button type="button" className="ritual-btn ritual-btn--quiet triage-card__undo" disabled={!canUndo} onClick={onUndo}>
        <Undo2 size={16} aria-hidden="true" />
        직전 결정 되돌리기
        <Key>⌫</Key>
      </button>
    </article>
  )
}
