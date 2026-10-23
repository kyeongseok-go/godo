import { useCallback, useMemo, useState } from 'react'
import { replanCandidates } from '../../domain/planning'
import type { ReplanDecision } from '../../domain/planning'
import type { ISODate, Task } from '../../domain/types'
import { useEngineContext, useSettings, useToday } from '../../hooks/data'
import { useLookups } from '../../hooks/lookups'
import { useApp } from '../../store/app'
import { applyChangeSet } from '../../store/changes'
import { useToasts } from '../../ui/toast'
import {
  archiveMessage,
  autoResolveDecision,
  currentTaskId,
  flowProgress,
  recordDecision,
  replanChangeSet,
  startFlow,
  stripAutos,
  summarizeFlow,
  undoDecision,
  withAutoSkips,
} from './flow'
import type { ReplanFlow } from './flow'
import { ReplanCard } from './ReplanCard'
import { ReplanDatePanel } from './ReplanDatePanel'
import { ReplanSummary } from './ReplanSummary'
import { useDecisionKeys } from './useDecisionKeys'
import type { KeyHandlers } from './useDecisionKeys'
import './replan.css'

const DECISION_LABEL: Record<ReplanDecision['type'], string> = {
  reschedule: '미완료 정리: 다시 잡기',
  inbox: '미완료 정리: 받은편지함으로',
  done: '미완료 정리: 완료',
  delete: '미완료 정리: 삭제',
  someday: '미완료 정리: 언젠가로',
}

/** 시작할 때 정한 순서로 카드를 한 장씩 넘기는 세션. 결정마다 commit 하므로 실행 취소(⌘Z)도 그대로 된다. */
export function ReplanSession() {
  const ctx = useEngineContext()
  const settings = useSettings()
  const today = useToday()
  const lookups = useLookups()
  const [chosen, setChosen] = useState<ReplanFlow>(() => startFlow(replanCandidates(ctx)))
  const [pickingDate, setPickingDate] = useState(false)

  const tasksById = useApp((s) => s.entities.tasks)
  // 부모를 완료·삭제하면 자식 카드는 이미 끝난 것이라 저절로 넘긴다. 상태에는 고른 것만 두고 매번 도출한다.
  const flow = useMemo(
    () => withAutoSkips(chosen, (id) => autoResolveDecision(tasksById[id])),
    [chosen, tasksById],
  )
  const currentId = currentTaskId(flow)
  const live: Task | undefined = currentId === null ? undefined : tasksById[currentId]
  const progress = flowProgress(flow)
  const canUndo = flow.records.some((r) => r.auto !== true)

  const decide = useCallback(
    (decision: ReplanDecision) => {
      if (currentId === null) return
      const store = useApp.getState()
      const cs = replanChangeSet(store.entities, currentId, decision, today, Date.now())
      const { inverse } = applyChangeSet(store.entities, cs)
      store.commit(cs, DECISION_LABEL[decision.type])
      setPickingDate(false)
      setChosen(stripAutos(recordDecision(flow, { taskId: currentId, decision, inverse })))
    },
    [currentId, flow, today],
  )

  const pickDate = useCallback(
    (date: ISODate) => {
      if (date < today) {
        useToasts.getState().push('오늘 이후 날짜를 골라 주세요.')
        return
      }
      decide({ type: 'reschedule', date })
    },
    [decide, today],
  )

  const undo = useCallback(() => {
    const { flow: previous, record } = undoDecision(flow)
    if (record === null) return
    useApp.getState().commit(record.inverse, '미완료 정리 되돌리기')
    setPickingDate(false)
    setChosen(stripAutos(previous))
  }, [flow])

  const handlers = useMemo((): KeyHandlers => {
    if (pickingDate) return { escape: () => setPickingDate(false) }
    return {
      t: () => decide({ type: 'reschedule', date: today }),
      d: () => {
        if (currentId !== null) setPickingDate(true)
      },
      i: () => decide({ type: 'inbox' }),
      e: () => decide({ type: 'done' }),
      x: () => decide({ type: 'delete' }),
      s: () => decide({ type: 'someday' }),
      backspace: undo,
      z: undo,
    }
  }, [pickingDate, currentId, decide, undo, today])
  useDecisionKeys(handlers, { enabled: true })

  if (progress.finished) {
    return (
      <div className="replan">
        <ReplanSummary summary={summarizeFlow(flow, today)} canUndo={canUndo} onUndo={undo} />
      </div>
    )
  }

  const task = live
  return (
    <div className="replan">
      <div className="replan-progress" role="progressbar" aria-label="정리 진행" aria-valuemin={1} aria-valuemax={progress.total} aria-valuenow={progress.position}>
        <p className="replan-progress__count" aria-live="polite">
          <span className="replan-progress__now">{progress.position}</span>
          <span className="replan-progress__total"> / {progress.total}</span>
        </p>
        <div className="replan-progress__rule" aria-hidden="true">
          <span style={{ transform: `scaleX(${(progress.position - 1) / progress.total})` }} />
        </div>
      </div>
      {task ? (
        <div className="replan-stage" key={task.id}>
          {pickingDate ? (
            <ReplanDatePanel
              today={today}
              weekStartsOn={settings.weekStartsOn}
              onSelect={pickDate}
              onCancel={() => setPickingDate(false)}
            />
          ) : (
            <ReplanCard
              task={task}
              project={lookups.projects.get(task.projectId)}
              today={today}
              archiveNote={archiveMessage(task, today, settings.carryOverArchiveDays)}
              canUndo={canUndo}
              onDecide={decide}
              onPickDate={() => setPickingDate(true)}
              onUndo={undo}
            />
          )}
        </div>
      ) : null}
    </div>
  )
}
