// F8: 받은편지함 처리 모드의 순수 로직
import { addDays } from '../../domain/date'
import { nextWeekStart } from '../../domain/calendarGrid'
import { INBOX_ID } from '../../domain/types'
import type { EngineContext, ID, ISODate, Project, Task } from '../../domain/types'
import type { DecisionFlow, DecisionRecord } from '../replan/decisionFlow'

export type TriageDecision =
  | { type: 'accept'; projectId: ID; /** null 이면 날짜는 정하지 않는다 */ date: ISODate | null }
  | { type: 'today' }
  | { type: 'tomorrow' }
  | { type: 'someday' }
  | { type: 'delete' }
  | { type: 'skip' }

export type TriageRecord = DecisionRecord<TriageDecision>
export type TriageFlow = DecisionFlow<TriageDecision>

/** 번호 키(1~9)로 고를 수 있는 프로젝트 수 */
export const QUICK_PROJECT_COUNT = 9

/**
 * 처리할 항목: 받은편지함의 열린 최상위 작업 중 날짜도 "언젠가" 표시도 없는 것.
 * 날짜가 있으면 이미 어딘가에 잡아 둔 것으로 보고, 하위 작업은 부모와 함께 움직이므로 뺀다.
 */
export function triageQueue(ctx: EngineContext): Task[] {
  return ctx.tasks
    .filter(
      (t) =>
        t.projectId === INBOX_ID &&
        t.parentId === null &&
        (t.status === 'todo' || t.status === 'active') &&
        t.deletedAt === null &&
        !t.someday &&
        t.startDate === null,
    )
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
}

function selectableProjects(projects: readonly Project[]): Project[] {
  return projects
    .filter((p) => p.id !== INBOX_ID && !p.isFolder && !p.archived && p.deletedAt === null)
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.order - b.order)
}

/** 번호 키에 묶을 프로젝트. 즐겨찾기가 앞에 온다. */
export function projectChoices(projects: readonly Project[]): Project[] {
  return selectableProjects(projects).slice(0, QUICK_PROJECT_COUNT)
}

/** 번호 키에 들어가지 못한 나머지까지 포함한 전체 후보 */
export function allProjectChoices(projects: readonly Project[]): Project[] {
  return selectableProjects(projects)
}

export interface QuickDate {
  key: 't' | 'm' | 'w'
  label: string
  date: ISODate
}

export function quickDates(today: ISODate, weekStartsOn: 0 | 1): QuickDate[] {
  return [
    { key: 't', label: '오늘', date: today },
    { key: 'm', label: '내일', date: addDays(today, 1) },
    { key: 'w', label: '다음 주', date: nextWeekStart(today, weekStartsOn) },
  ]
}

export interface TriageSummary {
  total: number
  decided: number
  moved: number
  today: number
  tomorrow: number
  someday: number
  deleted: number
  skipped: number
}

export function summarizeTriage(flow: TriageFlow): TriageSummary {
  const base: TriageSummary = {
    total: flow.queue.length,
    decided: flow.records.length,
    moved: 0,
    today: 0,
    tomorrow: 0,
    someday: 0,
    deleted: 0,
    skipped: 0,
  }
  const key = {
    accept: 'moved',
    today: 'today',
    tomorrow: 'tomorrow',
    someday: 'someday',
    delete: 'deleted',
    skip: 'skipped',
  } as const
  return flow.records.reduce<TriageSummary>((acc, { decision }) => {
    const field = key[decision.type]
    return { ...acc, [field]: acc[field] + 1 }
  }, base)
}

export function describeTriageSummary(s: TriageSummary): string {
  const parts: Array<[string, number]> = [
    ['프로젝트로', s.moved],
    ['오늘', s.today],
    ['내일', s.tomorrow],
    ['언젠가', s.someday],
    ['삭제', s.deleted],
    ['건너뜀', s.skipped],
  ]
  const shown = parts.filter(([, n]) => n > 0).map(([label, n]) => `${label} ${n}`)
  return `${s.total}개 중 ${shown.length > 0 ? shown.join(', ') : '아직 정리한 게 없어요'}`
}
