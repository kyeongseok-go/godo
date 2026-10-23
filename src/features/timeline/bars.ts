// 타임라인 막대 계산. 시작일~마감일을 보이는 날짜 범위 안의 칸 번호로 바꾼다.
import { addDays, compareDate, daysBetween } from '../../domain/date'
import type { ISODate, Task } from '../../domain/types'

export interface Bar {
  /** 보이는 범위 안의 첫 칸(0부터) */
  from: number
  /** 마지막 칸(포함) */
  to: number
  /** 시작이 범위 왼쪽 밖으로 잘렸는지 */
  clippedStart: boolean
  clippedEnd: boolean
  /** 마감일이 없어 하루짜리로 그린 막대(끝을 끌어 늘릴 수 있다) */
  singleDay: boolean
}

/** 막대가 차지하는 구간: 시작일 ~ 마감일. 시작일만 있으면 하루, 마감일만 있으면 마감일 하루. */
export function taskSpan(task: Pick<Task, 'startDate' | 'dueDate'>): { start: ISODate; end: ISODate; singleDay: boolean } | null {
  const { startDate, dueDate } = task
  if (!startDate && !dueDate) return null
  if (startDate && dueDate) {
    return compareDate(dueDate, startDate) >= 0
      ? { start: startDate, end: dueDate, singleDay: false }
      : { start: startDate, end: startDate, singleDay: true }
  }
  const only = (startDate ?? dueDate) as ISODate
  return { start: only, end: only, singleDay: true }
}

export function barFor(task: Pick<Task, 'startDate' | 'dueDate'>, rangeStart: ISODate, days: number): Bar | null {
  const span = taskSpan(task)
  if (!span) return null
  const from = daysBetween(rangeStart, span.start)
  const to = daysBetween(rangeStart, span.end)
  if (to < 0 || from > days - 1) return null
  return {
    from: Math.max(0, from),
    to: Math.min(days - 1, to),
    clippedStart: from < 0,
    clippedEnd: to > days - 1,
    singleDay: span.singleDay,
  }
}

/** 막대를 N일 옮길 때의 새 날짜들. 마감일이 있으면 같이 옮긴다. */
export function shiftSpan(task: Pick<Task, 'startDate' | 'dueDate'>, delta: number): Partial<Pick<Task, 'startDate' | 'dueDate'>> {
  const patch: Partial<Pick<Task, 'startDate' | 'dueDate'>> = {}
  if (task.startDate) patch.startDate = addDays(task.startDate, delta)
  if (task.dueDate) patch.dueDate = addDays(task.dueDate, delta)
  return patch
}

/** 오른쪽 끝을 끌어 마감일을 정한다. 시작일보다 앞서지 못한다. */
export function resizeEnd(task: Pick<Task, 'startDate' | 'dueDate'>, newEnd: ISODate): Partial<Pick<Task, 'startDate' | 'dueDate'>> {
  const start = task.startDate ?? task.dueDate
  if (!start) return { startDate: newEnd, dueDate: newEnd }
  return { dueDate: compareDate(newEnd, start) < 0 ? start : newEnd }
}
