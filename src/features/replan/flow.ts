// F3: 미완료 정리 흐름의 순수 로직. 진행 상태 리듀서와 "결정 → ChangeSet" 변환을 둔다.
import { daysBetween } from '../../domain/date'
import { applyReplanDecision, shouldSuggestArchive } from '../../domain/planning'
import type { ReplanDecision } from '../../domain/planning'
import { INBOX_ID } from '../../domain/types'
import type { ID, ISODate, Task } from '../../domain/types'
import { EMPTY_CHANGES } from '../../store/changes'
import type { ChangeSet, EntityState } from '../../store/changes'
import { completeTask, deleteTasks, patchTask } from '../../store/commands/taskCommands'
import { activity } from '../../store/commands/taskFactory'
import {
  currentTaskId,
  flowProgress,
  recordDecision,
  startDecisionFlow,
  stripAutos,
  undoDecision,
  withAutoSkips,
} from './decisionFlow'
import type { DecisionFlow, DecisionRecord } from './decisionFlow'

export type ReplanRecord = DecisionRecord<ReplanDecision>
export type ReplanFlow = DecisionFlow<ReplanDecision>

export const startFlow = (candidates: readonly Task[]): ReplanFlow => startDecisionFlow<ReplanDecision>(candidates)
export { currentTaskId, flowProgress, recordDecision, stripAutos, undoDecision, withAutoSkips }

export interface ReplanSummary {
  total: number
  decided: number
  today: number
  otherDay: number
  inbox: number
  done: number
  someday: number
  deleted: number
}

export function summarizeFlow(flow: ReplanFlow, today: ISODate): ReplanSummary {
  const summary: ReplanSummary = {
    total: flow.queue.length,
    decided: flow.records.length,
    today: 0,
    otherDay: 0,
    inbox: 0,
    done: 0,
    someday: 0,
    deleted: 0,
  }
  return flow.records.reduce<ReplanSummary>((acc, { decision }) => {
    switch (decision.type) {
      case 'reschedule':
        return decision.date === today ? { ...acc, today: acc.today + 1 } : { ...acc, otherDay: acc.otherDay + 1 }
      case 'inbox':
        return { ...acc, inbox: acc.inbox + 1 }
      case 'done':
        return { ...acc, done: acc.done + 1 }
      case 'someday':
        return { ...acc, someday: acc.someday + 1 }
      case 'delete':
        return { ...acc, deleted: acc.deleted + 1 }
    }
  }, summary)
}

export function describeSummary(s: ReplanSummary): string {
  const parts: Array<[string, number]> = [
    ['오늘로', s.today],
    ['다른 날로', s.otherDay],
    ['받은편지함', s.inbox],
    ['완료', s.done],
    ['언젠가', s.someday],
    ['삭제', s.deleted],
  ]
  const shown = parts.filter(([, n]) => n > 0).map(([label, n]) => `${label} ${n}`)
  return `${s.total}개 중 ${shown.length > 0 ? shown.join(', ') : '아직 정리한 게 없어요'}`
}

/** 한 장의 결정을 변경 집합으로 바꾼다. 완료·삭제는 하위 작업과 반복까지 아는 기존 명령에 맡긴다. */
export function replanChangeSet(
  state: EntityState,
  taskId: ID,
  decision: ReplanDecision,
  today: ISODate,
  nowMs: number,
): ChangeSet {
  const task = state.tasks[taskId]
  if (!task) return EMPTY_CHANGES
  switch (decision.type) {
    case 'done':
      return completeTask(state, taskId, today, nowMs)
    case 'delete':
      return deleteTasks(state, [taskId], nowMs)
    case 'inbox':
      return moveToInbox(state, task, decision, nowMs)
    case 'reschedule': {
      const next = applyReplanDecision(task, decision, nowMs)
      const log = activity(taskId, 'postponed', `"${task.title}" ${decision.date}로 미룸`, nowMs)
      return { puts: { tasks: [next], activity: [log] }, deletes: {} }
    }
    case 'someday': {
      const next = applyReplanDecision(task, decision, nowMs)
      const log = activity(taskId, 'moved', `"${task.title}" 언젠가로 보관`, nowMs)
      return { puts: { tasks: [next], activity: [log] }, deletes: {} }
    }
  }
}

/** 받은편지함으로 옮길 때는 하위 작업을 함께 옮기고, 부모와는 떼어 낸다(다른 프로젝트 부모 밑에 남지 않게). */
function moveToInbox(state: EntityState, task: Task, decision: ReplanDecision, nowMs: number): ChangeSet {
  const moved = applyReplanDecision(task, decision, nowMs)
  return patchTask(
    state,
    task.id,
    {
      projectId: INBOX_ID,
      sectionId: null,
      parentId: null,
      startDate: moved.startDate,
      startTime: moved.startTime,
      dayPart: moved.dayPart,
    },
    nowMs,
  )
}

/** 카드를 보여주려는데 작업이 이미 끝났거나 사라졌다면 그에 맞는 결정을 돌려준다. */
export function autoResolveDecision(task: Task | undefined): ReplanDecision | null {
  if (task === undefined || task.deletedAt !== null) return { type: 'delete' }
  if (task.status === 'done') return { type: 'done' }
  if (task.status === 'canceled') return { type: 'delete' }
  return null
}

/** 보관 제안 띠에 쓸 문구. 제안 조건이 아니면 null. */
export function archiveMessage(task: Task, today: ISODate, archiveDays: number): string | null {
  if (!shouldSuggestArchive(task, today, archiveDays)) return null
  const days = task.startDate === null ? 0 : daysBetween(task.startDate, today)
  const byDays = archiveDays > 0 && days >= archiveDays
  if (byDays) return `${days}일째 못 하고 있어요. 보관할까요?`
  return `${task.postponeCount}번째 미루고 있어요. 보관할까요?`
}
