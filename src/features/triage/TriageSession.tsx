import { X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { INBOX_ID } from '../../domain/types'
import type { ID, ISODate, Task } from '../../domain/types'
import { useEngineContext, useSettings, useTable, useToday } from '../../hooks/data'
import { useApp } from '../../store/app'
import { applyChangeSet } from '../../store/changes'
import {
  currentTaskId,
  flowProgress,
  recordDecision,
  startDecisionFlow,
  stripAutos,
  undoDecision,
  withAutoSkips,
} from '../replan/decisionFlow'
import { useDecisionKeys } from '../replan/useDecisionKeys'
import type { KeyHandlers } from '../replan/useDecisionKeys'
import '../plan/ritual.css'
import { triageChangeSet } from './commands'
import { describeTriageSummary, projectChoices, quickDates, summarizeTriage, triageQueue } from './logic'
import type { TriageDecision, TriageFlow } from './logic'
import { TriageAccept } from './TriageAccept'
import { TriageCard } from './TriageCard'
import './triage.css'

const LABEL: Record<TriageDecision['type'], string> = {
  accept: '받은편지함 정리: 프로젝트로',
  today: '받은편지함 정리: 오늘로',
  tomorrow: '받은편지함 정리: 내일로',
  someday: '받은편지함 정리: 언젠가로',
  delete: '받은편지함 정리: 삭제',
  skip: '받은편지함 정리: 건너뛰기',
}

interface AcceptDraft {
  projectId: ID | null
  date: ISODate | null
}

const isGone = (task: Task | undefined): boolean =>
  task === undefined || task.deletedAt !== null || !(task.status === 'todo' || task.status === 'active') || task.projectId !== INBOX_ID

interface TriageSessionProps {
  onClose: () => void
}

/** 열릴 때 받은편지함을 한 번 훑어 줄을 세우고, 결정마다 commit 한다(실행 취소 가능). */
export function TriageSession({ onClose }: TriageSessionProps) {
  const ctx = useEngineContext()
  const settings = useSettings()
  const today = useToday()
  const projects = useTable('projects')
  const [chosen, setChosen] = useState<TriageFlow>(() => startDecisionFlow<TriageDecision>(triageQueue(ctx)))
  const [draft, setDraft] = useState<AcceptDraft | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)

  const quick = useMemo(() => projectChoices(projects), [projects])
  const tasksById = useApp((s) => s.entities.tasks)
  // 다른 곳에서 이미 처리돼 받은편지함을 떠난 항목은 저절로 넘긴다. 상태에는 고른 것만 두고 매번 도출한다.
  const flow = useMemo(
    () => withAutoSkips(chosen, (id): TriageDecision | null => (isGone(tasksById[id]) ? { type: 'skip' } : null)),
    [chosen, tasksById],
  )
  const currentId = currentTaskId(flow)
  const live = currentId === null ? undefined : tasksById[currentId]
  const progress = flowProgress(flow)
  const canUndo = flow.records.some((r) => r.auto !== true)

  // 대화상자가 처음 열릴 때도 첫 포커스가 카드 영역에 가도록 autofocus 속성을 단다
  const markStage = useCallback((el: HTMLDivElement | null) => {
    stageRef.current = el
    el?.setAttribute('autofocus', '')
  }, [])

  // 카드가 바뀌어도 포커스가 닫기 버튼으로 튀지 않도록 카드 영역에 둔다
  const stageKey = `${live?.id ?? ''}:${draft === null ? 'card' : 'accept'}`
  useEffect(() => {
    stageRef.current?.focus({ preventScroll: true })
  }, [stageKey])

  const decide = useCallback(
    (decision: TriageDecision) => {
      if (currentId === null) return
      const store = useApp.getState()
      const cs = triageChangeSet(store.entities, currentId, decision, today, Date.now())
      const { inverse } = applyChangeSet(store.entities, cs)
      store.commit(cs, LABEL[decision.type])
      setDraft(null)
      setChosen(stripAutos(recordDecision(flow, { taskId: currentId, decision, inverse })))
    },
    [currentId, flow, today],
  )

  const undo = useCallback(() => {
    const { flow: previous, record } = undoDecision(flow)
    if (record === null) return
    useApp.getState().commit(record.inverse, '받은편지함 정리 되돌리기')
    setDraft(null)
    setChosen(stripAutos(previous))
  }, [flow])

  const confirm = useCallback(() => {
    if (draft?.projectId) decide({ type: 'accept', projectId: draft.projectId, date: draft.date })
  }, [draft, decide])

  const dates = useMemo(() => quickDates(today, settings.weekStartsOn), [today, settings.weekStartsOn])

  const handlers = useMemo((): KeyHandlers => {
    const byNumber = (n: number): (() => void) => {
      const project = quick[n - 1]
      if (!project) return () => undefined
      return draft
        ? () => setDraft({ ...draft, projectId: project.id })
        : () => decide({ type: 'accept', projectId: project.id, date: null })
    }
    const numbers: KeyHandlers = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [String(i + 1), byNumber(i + 1)]))
    if (draft) {
      const dateKeys: KeyHandlers = Object.fromEntries(
        dates.map((d) => [d.key, () => setDraft({ ...draft, date: draft.date === d.date ? null : d.date })]),
      )
      return { ...numbers, ...dateKeys, 0: () => setDraft({ ...draft, date: null }), enter: confirm, escape: () => setDraft(null) }
    }
    return {
      ...numbers,
      a: () => setDraft({ projectId: null, date: null }),
      enter: () => setDraft({ projectId: null, date: null }),
      t: () => decide({ type: 'today' }),
      m: () => decide({ type: 'tomorrow' }),
      s: () => decide({ type: 'someday' }),
      x: () => decide({ type: 'delete' }),
      n: () => decide({ type: 'skip' }),
      arrowright: () => decide({ type: 'skip' }),
      backspace: undo,
      z: undo,
    }
  }, [draft, quick, dates, decide, undo, confirm])
  useDecisionKeys(handlers, { enabled: true, allowInDialog: true })

  return (
    <div className="triage">
      <header className="triage__head">
        <div>
          <p className="triage__kicker">받은편지함 정리</p>
          {progress.total > 0 && !progress.finished ? (
            <p className="triage__count" aria-live="polite">
              <span>{progress.position}</span> / {progress.total}
            </p>
          ) : null}
        </div>
        <button type="button" className="icon-btn triage__close" aria-label="정리 닫기" onClick={onClose}>
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      {progress.finished ? (
        <Finished flow={flow} canUndo={canUndo} onUndo={undo} onClose={onClose} />
      ) : live ? (
        <div className="triage__stage" key={live.id} ref={markStage} tabIndex={-1}>
          {draft ? (
            <TriageAccept
              projects={projects}
              quick={quick}
              today={today}
              weekStartsOn={settings.weekStartsOn}
              projectId={draft.projectId}
              date={draft.date}
              onProject={(id) => setDraft({ ...draft, projectId: id })}
              onDate={(date) => setDraft({ ...draft, date })}
              onConfirm={confirm}
              onCancel={() => setDraft(null)}
            />
          ) : (
            <TriageCard
              task={live}
              today={today}
              settings={settings}
              quick={quick}
              canUndo={canUndo}
              onDecide={decide}
              onAccept={() => setDraft({ projectId: null, date: null })}
              onUndo={undo}
            />
          )}
        </div>
      ) : null}
    </div>
  )
}

interface FinishedProps {
  flow: TriageFlow
  canUndo: boolean
  onUndo: () => void
  onClose: () => void
}

function Finished({ flow, canUndo, onUndo, onClose }: FinishedProps) {
  const summary = summarizeTriage(flow)
  const empty = summary.total === 0
  return (
    <section className="triage-done" aria-labelledby="triage-done-title">
      <h3 className="triage-done__title" id="triage-done-title">
        {empty ? '받은편지함이 비었어요.' : describeTriageSummary(summary)}
      </h3>
      <p className="triage-done__calm">{empty ? '떠오르는 건 일단 여기에 던져 두세요.' : '수고했어요. 건너뛴 건 다음에 봐도 돼요.'}</p>
      <div className="triage-done__actions">
        <button type="button" className="ritual-btn ritual-btn--primary" onClick={onClose}>
          닫기
        </button>
        {empty ? null : (
          <button type="button" className="ritual-btn ritual-btn--quiet" disabled={!canUndo} onClick={onUndo}>
            마지막 결정 되돌리기
          </button>
        )}
      </div>
    </section>
  )
}
