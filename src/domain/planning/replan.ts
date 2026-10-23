// F3: 미완료 이월 결정
import { compareDate, daysBetween } from '../date'
import { INBOX_ID } from '../types'
import type { EngineContext, ISODate, EpochMs, Task } from '../types'
import { compareByPlanOrder, isOpen, isParked } from './shared'

export type ReplanDecision =
  | { type: 'reschedule'; date: ISODate }
  | { type: 'inbox' }
  | { type: 'done' }
  | { type: 'delete' }
  | { type: 'someday' }

/** 이만큼 미루면 날짜와 상관없이 보관을 제안한다 */
const ARCHIVE_POSTPONE_COUNT = 5

/**
 * 이월 대상: 시작일이 지난 미완료(최상위·하위·반복 모두), 오래된 순.
 * 마감일만 지난 작업은 시작일이 없어 "다시 잡을 날짜"가 없으므로 리뷰(F10)가 맡는다.
 * 보류·someday 는 일부러 빼 둔 것이라 제외한다.
 */
export function replanCandidates(ctx: EngineContext): Task[] {
  return ctx.tasks
    .filter((t) => isOpen(t) && !isParked(t) && t.startDate !== null && t.startDate < ctx.today)
    .sort((a, b) => compareDate(a.startDate ?? '', b.startDate ?? '') || compareByPlanOrder(a, b))
}

/**
 * 결정을 적용한 새 작업을 돌려준다. 반복 작업을 'done' 으로 처리했을 때 다음 회차를 만드는 일은
 * 반복 모듈의 몫이라 여기서는 상태만 바꾼다.
 */
export function applyReplanDecision(task: Task, decision: ReplanDecision, nowMs: EpochMs): Task {
  const touched = { ...task, updatedAt: nowMs }
  switch (decision.type) {
    case 'reschedule':
      return { ...touched, startDate: decision.date, postponeCount: task.postponeCount + 1 }
    case 'inbox':
      // 섹션은 이전 프로젝트 소속이라 같이 비운다
      return { ...touched, startDate: null, startTime: null, dayPart: null, projectId: INBOX_ID, sectionId: null }
    case 'done':
      return { ...touched, status: 'done', completedAt: nowMs }
    case 'delete':
      return { ...touched, deletedAt: nowMs }
    case 'someday':
      // 날짜 없이 시각만 남으면 의미가 없어 함께 비운다
      return { ...touched, someday: true, startDate: null, startTime: null, dayPart: null }
  }
}

/** 오래 이월됐거나 자주 미룬 작업에 보관을 제안할지. archiveDays 가 0 이하이면 날짜 규칙은 끈다. */
export function shouldSuggestArchive(task: Task, today: ISODate, archiveDays: number): boolean {
  if (!isOpen(task)) return false
  if (task.postponeCount >= ARCHIVE_POSTPONE_COUNT) return true
  if (archiveDays <= 0 || task.startDate === null) return false
  return daysBetween(task.startDate, today) >= archiveDays
}
