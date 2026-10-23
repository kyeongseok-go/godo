import { Archive, CalendarDays, Check, Inbox, Sun, Trash2, Undo2 } from 'lucide-react'
import { daysBetween } from '../../domain/date'
import { describeDate, formatDuration } from '../../domain/format'
import type { ReplanDecision } from '../../domain/planning'
import type { ISODate, Project, Task } from '../../domain/types'
import '../plan/ritual.css'
import './replan.css'

interface ReplanCardProps {
  task: Task
  project: Project | undefined
  today: ISODate
  archiveNote: string | null
  canUndo: boolean
  onDecide: (decision: ReplanDecision) => void
  onPickDate: () => void
  onUndo: () => void
}

function originalDateText(task: Task, today: ISODate): string {
  if (task.startDate === null) return '날짜 없음'
  const ago = daysBetween(task.startDate, today)
  const label = describeDate(task.startDate, today)
  return ago > 1 ? `${label} · ${ago}일 전` : label
}

function Key({ children }: { children: string }) {
  return (
    <kbd className="keycap" aria-hidden="true">
      {children}
    </kbd>
  )
}

/** 한 장짜리 결정 카드. 어떤 버튼이든 눌러도 다음 카드로 넘어가고, 직전 결정은 되돌릴 수 있다. */
export function ReplanCard({ task, project, today, archiveNote, canUndo, onDecide, onPickDate, onUndo }: ReplanCardProps) {
  const archive = archiveNote !== null
  return (
    <article className="replan-card" aria-labelledby="replan-title" data-archive={archive}>
      {archive ? (
        <p className="replan-card__archive" role="note">
          <Archive size={16} aria-hidden="true" />
          {archiveNote}
        </p>
      ) : null}
      <p className="replan-card__kicker">
        <span>원래 날짜</span> {originalDateText(task, today)}
      </p>
      <h2 className="replan-card__title" id="replan-title">
        {task.title}
      </h2>
      <dl className="replan-card__facts">
        <div>
          <dt>미룬 횟수</dt>
          <dd>{task.postponeCount}번</dd>
        </div>
        <div>
          <dt>프로젝트</dt>
          <dd>
            {project ? <i className="replan-card__dot" style={{ background: project.color }} aria-hidden="true" /> : null}
            {project?.name ?? '받은편지함'}
          </dd>
        </div>
        <div>
          <dt>예상 시간</dt>
          <dd>{task.estimateMin ? formatDuration(task.estimateMin) : '정하지 않음'}</dd>
        </div>
      </dl>
      <p className="replan-card__calm">괜찮아요, 미뤄도 돼요. 어디로 보낼지만 정하면 돼요.</p>

      <div className="replan-card__actions">
        <button
          type="button"
          className="ritual-btn ritual-btn--primary replan-card__wide"
          aria-keyshortcuts="T"
          onClick={() => onDecide({ type: 'reschedule', date: today })}
        >
          <Sun size={17} aria-hidden="true" />
          오늘로 다시 잡기
          <Key>T</Key>
        </button>
        <button type="button" className="ritual-btn" aria-keyshortcuts="D" onClick={onPickDate}>
          <CalendarDays size={17} aria-hidden="true" />
          다른 날로
          <Key>D</Key>
        </button>
        <button type="button" className="ritual-btn" aria-keyshortcuts="I" onClick={() => onDecide({ type: 'inbox' })}>
          <Inbox size={17} aria-hidden="true" />
          받은편지함으로
          <Key>I</Key>
        </button>
        <button type="button" className="ritual-btn" aria-keyshortcuts="E" onClick={() => onDecide({ type: 'done' })}>
          <Check size={17} aria-hidden="true" />
          완료
          <Key>E</Key>
        </button>
        <button
          type="button"
          className="ritual-btn ritual-btn--danger"
          aria-keyshortcuts="X"
          onClick={() => onDecide({ type: 'delete' })}
        >
          <Trash2 size={17} aria-hidden="true" />
          삭제
          <Key>X</Key>
        </button>
        <button
          type="button"
          className={archive ? 'ritual-btn ritual-btn--accent replan-card__wide' : 'ritual-btn replan-card__wide'}
          aria-keyshortcuts="S"
          onClick={() => onDecide({ type: 'someday' })}
        >
          <Archive size={17} aria-hidden="true" />
          {archive ? '언젠가로 보관' : '언젠가로'}
          <Key>S</Key>
        </button>
      </div>

      <button type="button" className="ritual-btn ritual-btn--quiet replan-card__undo" disabled={!canUndo} onClick={onUndo}>
        <Undo2 size={16} aria-hidden="true" />
        직전 결정 되돌리기
        <Key>⌫</Key>
      </button>
    </article>
  )
}
