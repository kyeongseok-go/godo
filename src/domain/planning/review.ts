// F10: 주기적 리뷰 — 묵은 것·자주 미룬 것·다음 행동이 없는 것
import { daysBetween } from '../date'
import type { EngineContext, ID, ISODate, Task } from '../types'
import { isActionableIn } from './actionable'
import { DAY_MS, indexById, isOpen, isParked } from './shared'

export type ReviewReason = 'stale' | 'postponed' | 'noNextAction' | 'overdueDeadline'

export interface ReviewItem {
  task: Task
  reason: ReviewReason
  detail: string
}

export interface ReviewOptions {
  staleDays: number
  postponeThreshold: number
}

function groupChildren(tasks: readonly Task[]): Map<ID, Task[]> {
  const map = new Map<ID, Task[]>()
  for (const task of tasks) {
    if (task.parentId === null) continue
    map.set(task.parentId, [...(map.get(task.parentId) ?? []), task])
  }
  return map
}

/** 열린 하위 작업이 있는데 그중 지금 할 수 있는 것이 하나도 없는 부모 */
function lacksNextAction(
  task: Task,
  today: ISODate,
  byId: ReadonlyMap<ID, Task>,
  children: ReadonlyMap<ID, Task[]>,
): boolean {
  const open = (children.get(task.id) ?? []).filter(isOpen)
  return open.length > 0 && !open.some((child) => isActionableIn(child, today, byId))
}

/**
 * 한 작업에 사유가 여러 개면 하나만 고른다: 마감 초과 > 많이 미룸 > 묵음 > 다음 행동 없음.
 * (다음 행동 없음은 명세의 우선순위에 없어서 가장 뒤에 둔다.)
 * 보류·someday 는 일부러 치워 둔 것이라 리뷰 대상에서 뺀다.
 */
export function reviewCandidates(ctx: EngineContext, opts: ReviewOptions): ReviewItem[] {
  const byId = indexById(ctx.tasks)
  const children = groupChildren(ctx.tasks)
  const nowMs = ctx.now.getTime()
  const items: ReviewItem[] = []

  for (const task of ctx.tasks) {
    if (!isOpen(task) || isParked(task)) continue
    const idleDays = Math.floor((nowMs - task.updatedAt) / DAY_MS)

    if (task.dueDate !== null && task.dueDate < ctx.today) {
      const late = daysBetween(task.dueDate, ctx.today)
      items.push({ task, reason: 'overdueDeadline', detail: `마감일(${task.dueDate})이 ${late}일 지났어요` })
    } else if (task.postponeCount >= opts.postponeThreshold) {
      items.push({ task, reason: 'postponed', detail: `${task.postponeCount}번 미뤘어요` })
    } else if (task.startDate === null && idleDays >= opts.staleDays) {
      items.push({ task, reason: 'stale', detail: `${idleDays}일 동안 손대지 않았어요` })
    } else if (lacksNextAction(task, ctx.today, byId, children)) {
      items.push({ task, reason: 'noNextAction', detail: '하위 작업 중 지금 할 수 있는 것이 없어요' })
    }
  }
  return items
}
