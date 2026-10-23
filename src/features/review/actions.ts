// 리뷰 항목 처리: 항목 → ChangeSet 변환과 목록 정리. 순수 함수만 둔다.
import { nextWeekStart } from '../../domain/calendarGrid'
import type { ReviewItem, ReviewReason } from '../../domain/planning'
import type { EpochMs, ID, ISODate, Task } from '../../domain/types'
import { EMPTY_CHANGES } from '../../store/changes'
import type { ChangeSet, EntityState } from '../../store/changes'
import { cancelTask, deleteTasks, patchTask, postponeTask } from '../../store/commands/taskCommands'

export type ReviewActionKind = 'keep' | 'today' | 'nextWeek' | 'someday' | 'cancel' | 'delete'

export interface ReviewActionContext {
  today: ISODate
  weekStartsOn: 0 | 1
  nowMs: EpochMs
}

export interface ReviewActionMeta {
  kind: ReviewActionKind
  label: string
  /** 항목에 포커스했을 때 쓰는 한 글자 단축키. 실수로 지우지 않도록 삭제에는 두지 않는다. */
  key: string | null
  /** 토스트 앞부분 */
  done: string
}

export const REVIEW_ACTIONS: readonly ReviewActionMeta[] = [
  { kind: 'keep', label: '유지', key: 'k', done: '유지했어요' },
  { kind: 'today', label: '오늘로', key: 't', done: '오늘로 옮겼어요' },
  { kind: 'nextWeek', label: '다음 주로', key: 'w', done: '다음 주로 미뤘어요' },
  { kind: 'someday', label: '언젠가로', key: 's', done: '언젠가로 보냈어요' },
  { kind: 'cancel', label: '계획 취소', key: 'x', done: '계획을 취소했어요' },
  { kind: 'delete', label: '삭제', key: null, done: '삭제했어요' },
]

/**
 * 항목 하나를 처리하는 변경 집합. 기존 할 일 명령을 그대로 재사용한다.
 * - 유지: 내용은 두고 최종 수정 시각만 지금으로(묵음 판정에서 빠진다)
 * - 오늘로: 시작일만 오늘로(미룬 횟수는 늘리지 않는다)
 * - 다음 주로: 다음 주 첫날로 미루기(미룬 횟수 +1, 활동 기록)
 * - 언젠가로: 보관함으로 보내고 날짜를 비운다
 */
export function reviewChangeSet(
  state: EntityState,
  taskId: ID,
  kind: ReviewActionKind,
  ctx: ReviewActionContext,
): ChangeSet {
  if (!state.tasks[taskId]) return EMPTY_CHANGES
  switch (kind) {
    case 'keep':
      return patchTask(state, taskId, {}, ctx.nowMs)
    case 'today':
      return patchTask(state, taskId, { startDate: ctx.today, someday: false }, ctx.nowMs)
    case 'nextWeek':
      return postponeTask(state, taskId, nextWeekStart(ctx.today, ctx.weekStartsOn), ctx.nowMs)
    case 'someday':
      return patchTask(state, taskId, { someday: true, startDate: null }, ctx.nowMs)
    case 'cancel':
      return cancelTask(state, taskId, ctx.nowMs)
    case 'delete':
      return deleteTasks(state, [taskId], ctx.nowMs)
  }
}

interface KeyLike {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
}

/** 항목 안에서만 쓰는 단축키. 수식키 조합은 앱 전역 단축키에 맡긴다. */
export function reviewActionForKey(event: KeyLike): ReviewActionKind | null {
  if (event.metaKey || event.ctrlKey || event.altKey) return null
  const key = event.key.toLowerCase()
  return REVIEW_ACTIONS.find((action) => action.key === key)?.kind ?? null
}

const MAX_TITLE_CHARS = 24

export function reviewDoneMessage(kind: ReviewActionKind, title: string): string {
  const done = REVIEW_ACTIONS.find((action) => action.kind === kind)?.done ?? '처리했어요'
  const short = title.length > MAX_TITLE_CHARS ? `${title.slice(0, MAX_TITLE_CHARS - 1)}…` : title
  return `${done}: "${short}"`
}

export interface ReviewGroup {
  reason: ReviewReason
  title: string
  description: string
  items: ReviewItem[]
}

const GROUP_META: ReadonlyArray<Pick<ReviewGroup, 'reason' | 'title' | 'description'>> = [
  { reason: 'overdueDeadline', title: '마감이 지났어요', description: '마감일이 지났는데 아직 열려 있어요. 끝내거나, 날짜를 다시 잡거나, 내려놓으세요.' },
  { reason: 'postponed', title: '자주 미뤘어요', description: '여러 번 미룬 일이에요. 정말 할 일인지 정해 보세요.' },
  { reason: 'stale', title: '오래 묵었어요', description: '한동안 손대지 않은 일이에요.' },
  { reason: 'noNextAction', title: '다음 행동이 없어요', description: '하위 작업 중 지금 할 수 있는 게 없어요. 다음 행동을 정하거나 보류하세요.' },
]

const compareInGroup: Record<ReviewReason, (a: Task, b: Task) => number> = {
  overdueDeadline: (a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''),
  postponed: (a, b) => b.postponeCount - a.postponeCount,
  stale: (a, b) => a.updatedAt - b.updatedAt,
  noNextAction: (a, b) => a.order - b.order,
}

/** 사유별로 묶는다. 급한 순서로 늘어놓고, 비어 있는 묶음은 뺀다. */
export function groupByReason(items: readonly ReviewItem[]): ReviewGroup[] {
  return GROUP_META.flatMap((meta) => {
    const inGroup = items
      .filter((item) => item.reason === meta.reason)
      .sort((a, b) => compareInGroup[meta.reason](a.task, b.task))
    return inGroup.length === 0 ? [] : [{ ...meta, items: inGroup }]
  })
}

/**
 * 이번 화면에서 처리한 항목을 숨긴다. 처리 직후의 수정 시각을 기억해 두고, 그 기록이 그대로일 때만 숨긴다.
 * 실행 취소나 다른 수정으로 기록이 바뀌면 자동으로 다시 나타난다.
 */
export function visibleItems(items: readonly ReviewItem[], handled: Readonly<Record<ID, EpochMs>>): ReviewItem[] {
  return items.filter((item) => handled[item.task.id] !== item.task.updatedAt)
}

/** 처리한 항목 중 지금도 그 처리가 유효한 것(실행 취소되거나 다시 수정된 것은 뺀다)의 수 */
export function countHandled(
  handled: Readonly<Record<ID, EpochMs>>,
  tasks: Readonly<Record<ID, Task>>,
): number {
  return Object.entries(handled).filter(([id, updatedAt]) => tasks[id]?.updatedAt === updatedAt).length
}
