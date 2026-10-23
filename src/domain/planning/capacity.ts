// F2: 하루 용량과 초과 시 덜어낼 후보
import { daysBetween } from '../date'
import type { ID, ISODate, Task } from '../types'
import { isOpen } from './shared'

export interface DayLoad {
  date: ISODate
  plannedMin: number
  capacityMin: number
  overMin: number
  ratio: number
  level: 'ok' | 'near' | 'over'
}

/** 85% 미만이면 여유, 100%까지는 주의, 넘으면 초과 */
const NEAR_RATIO = 0.85

/**
 * 그 날짜에 계획된 작업인가. 용량 계산이 쓰는 유일한 규칙이다.
 * 시작일이 있으면 시작일 기준, 없으면 마감일 기준. 지난 날짜의 이월분(overdue)은 포함하지 않는다.
 * 보류·someday 는 계획에서 뺀 것이므로 제외한다.
 */
export function scheduledOn(task: Task, date: ISODate): boolean {
  if (!isOpen(task) || task.onHold || task.someday) return false
  return (task.startDate ?? task.dueDate) === date
}

/** 소요 시간. 0 이하는 값이 없는 것으로 본다(0분 블록은 배치할 수 없어서). */
export function taskMinutes(task: Task, defaultMin: number): number {
  if (task.durationMin !== null && task.durationMin > 0) return task.durationMin
  if (task.estimateMin !== null && task.estimateMin > 0) return task.estimateMin
  return defaultMin
}

function classify(ratio: number): DayLoad['level'] {
  if (ratio < NEAR_RATIO) return 'ok'
  return ratio <= 1 ? 'near' : 'over'
}

export function dayLoad(
  date: ISODate,
  tasks: readonly Task[],
  capacityMin: number,
  defaultMin: number,
): DayLoad {
  const plannedMin = tasks
    .filter((t) => scheduledOn(t, date))
    .reduce((sum, t) => sum + taskMinutes(t, defaultMin), 0)
  // 용량 0 에서 계획이 있으면 무한대(=초과), 없으면 0
  const ratio = capacityMin > 0 ? plannedMin / capacityMin : plannedMin > 0 ? Infinity : 0
  return {
    date,
    plannedMin,
    capacityMin,
    overMin: Math.max(0, plannedMin - capacityMin),
    ratio,
    level: classify(ratio),
  }
}

/**
 * 초과분을 덜어낼 후보를 덜 급한 순으로 고른다.
 * 정렬: 마감 없음 → 마감이 먼 순 → 낮은 우선순위(4→1) → 예상 시간이 큰 순.
 * 고정(pinned)과 오늘의 핵심(excludeIds)은 후보에서 뺀다. 핵심 목록은 Task 에 없어서 호출 측이 넘긴다.
 */
export function suggestOffload(
  tasks: readonly Task[],
  overMin: number,
  today: ISODate,
  defaultMin: number,
  excludeIds: readonly ID[] = [],
): Task[] {
  if (overMin <= 0) return []
  const excluded = new Set(excludeIds)
  const candidates = tasks
    .filter((t) => !t.pinned && !excluded.has(t.id))
    .sort(
      (a, b) =>
        compareNumber(offloadRank(a, today), offloadRank(b, today)) ||
        b.priority - a.priority ||
        taskMinutes(b, defaultMin) - taskMinutes(a, defaultMin),
    )

  const picked: Task[] = []
  let freed = 0
  for (const task of candidates) {
    if (freed >= overMin) break
    picked.push(task)
    freed += taskMinutes(task, defaultMin)
  }
  return picked
}

function compareNumber(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** 마감 없음은 맨 앞, 마감이 있으면 오늘로부터 멀수록 앞(작은 값) */
function offloadRank(task: Task, today: ISODate): number {
  return task.dueDate === null ? Number.NEGATIVE_INFINITY : -daysBetween(today, task.dueDate)
}
