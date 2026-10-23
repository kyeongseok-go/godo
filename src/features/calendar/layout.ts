// 캘린더 계산 로직. 화면과 분리해 두어 겹침 배치·반복 전개를 테스트로 검증한다.
import { addDays, compareDate, minutesOfDay } from '../../domain/date'
import { occurrencesInRange } from '../../domain/recurrence'
import type { ID, ISODate, Task } from '../../domain/types'

export interface TimeSpan {
  id: ID
  start: number // 하루 시작 기준 분
  end: number
}

export interface PlacedSpan extends TimeSpan {
  column: number
  columns: number
}

/**
 * 겹치는 일정을 나란히 놓기 위한 열 배정. 서로 겹치는 묶음마다 필요한 열 수를 같게 맞춘다.
 * 시작이 빠른 순, 같으면 긴 것 먼저 놓는다.
 */
export function layoutSpans(spans: readonly TimeSpan[]): PlacedSpan[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start || b.end - a.end || a.id.localeCompare(b.id))
  const placed: PlacedSpan[] = []
  let cluster: PlacedSpan[] = []
  let clusterEnd = -1
  let columnEnds: number[] = []

  const closeCluster = () => {
    for (const p of cluster) p.columns = columnEnds.length
    placed.push(...cluster)
    cluster = []
    columnEnds = []
    clusterEnd = -1
  }

  for (const span of sorted) {
    if (cluster.length > 0 && span.start >= clusterEnd) closeCluster()
    let column = columnEnds.findIndex((end) => end <= span.start)
    if (column === -1) {
      column = columnEnds.length
      columnEnds.push(span.end)
    } else columnEnds[column] = span.end
    cluster.push({ ...span, column, columns: 1 })
    clusterEnd = Math.max(clusterEnd, span.end)
  }
  closeCluster()
  return placed
}

export const snapMinutes = (minutes: number, step = 15): number => Math.round(minutes / step) * step

export const clampMinutes = (minutes: number): number => Math.max(0, Math.min(24 * 60, minutes))

export interface Occurrence {
  task: Task
  date: ISODate
  /** 반복 규칙으로 계산된 가상 회차(실제 시작일이 아님). 드래그로 옮길 수 없다. */
  virtual: boolean
}

const isVisible = (t: Task): boolean => t.deletedAt === null && t.status !== 'canceled' && !t.someday

/**
 * [from, to] 안의 날짜별 일정. 시작일이 있는 작업은 그 날에, 마감일만 있는 작업은 마감일에,
 * 반복 작업은 규칙에 따라 앞으로의 회차에도 가상으로 나타난다.
 */
export function occurrencesByDate(tasks: readonly Task[], from: ISODate, to: ISODate): Map<ISODate, Occurrence[]> {
  const out = new Map<ISODate, Occurrence[]>()
  const push = (date: ISODate, o: Occurrence) => out.set(date, [...(out.get(date) ?? []), o])

  for (const task of tasks) {
    if (!isVisible(task)) continue
    const own = task.startDate ?? task.dueDate
    if (own && compareDate(own, from) >= 0 && compareDate(own, to) <= 0) push(own, { task, date: own, virtual: false })
    if (task.recurrence && task.status !== 'done' && task.startDate) {
      for (const d of occurrencesInRange(task, from, to)) {
        if (d !== own) push(d, { task, date: d, virtual: true })
      }
    }
  }
  for (const list of out.values()) {
    list.sort((a, b) => timeKey(a.task) - timeKey(b.task) || a.task.priority - b.task.priority || a.task.order - b.task.order)
  }
  return out
}

/** 시각이 없는 작업은 하루 맨 앞(-1)에 둔다 */
const timeKey = (t: Task): number => (t.startTime ? minutesOfDay(t.startTime) : -1)

/** 시간 블록의 길이(분). 시간이 없으면 예상 시간, 그것도 없으면 기본값 */
export function blockMinutes(task: Task, defaultMin: number): number {
  return task.durationMin ?? task.estimateMin ?? defaultMin
}

/** 보이는 범위(start..end)의 날짜 배열 */
export function dateRange(start: ISODate, days: number): ISODate[] {
  return Array.from({ length: days }, (_, i) => addDays(start, i))
}
