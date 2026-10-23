// 반복 작업의 완료·건너뛰기. 같은 id를 유지한 채 날짜와 규칙만 갱신한 새 객체를 돌려준다.
import { addDays, daysBetween, toISODate } from '../date'
import type { EpochMs, ISODate, RecurrenceRule, Task } from '../types'
import { findNextAfter, nextOccurrence } from './next'
import { stepDue, withMonthDayAnchor } from './steps'

function moveToOccurrence(task: Task, base: ISODate, next: ISODate, rule: RecurrenceRule, nowMs: EpochMs): Task {
  const shiftDays = daysBetween(base, next)
  return {
    ...task,
    startDate: next,
    dueDate: task.dueDate === null ? null : addDays(task.dueDate, shiftDays),
    recurrence: rule,
    status: 'todo',
    postponeCount: 0,
    completedAt: null,
    updatedAt: nowMs,
  }
}

/** 반복 작업 완료. 시리즈가 끝났거나 반복 규칙이 없으면 null(호출 측이 일반 완료 처리). */
export function advanceRecurringTask(task: Task, completedOn: ISODate, nowMs: EpochMs): Task | null {
  const rule = task.recurrence
  if (rule === null) return null
  const base = task.startDate ?? task.dueDate ?? completedOn
  const next = nextOccurrence(rule, base, completedOn)
  if (next === null) return null
  // 기준 일을 규칙에 남겨 둔다. 다음 완료 때도 원래 일(31일, 2월 29일)을 기억한다.
  const anchored = withMonthDayAnchor(rule, base)
  return moveToOccurrence(task, base, next, { ...anchored, doneCount: (anchored.doneCount ?? 0) + 1 }, nowMs)
}

/**
 * 이번 회차만 건너뛴다. doneCount는 올리지 않고 skipDates에 현재 회차를 기록한다.
 * 완료한 날이 없으므로 anchor와 관계없이 현재 회차에서 규칙대로 한 걸음 나아간다.
 */
export function skipOccurrence(task: Task, nowMs: EpochMs): Task | null {
  const stored = task.recurrence
  if (stored === null) return null
  const base = task.startDate ?? task.dueDate ?? toISODate(new Date(nowMs))
  const rule = withMonthDayAnchor(stored, base)
  const next = findNextAfter(rule, stepDue(rule, base), base)
  if (next === null) return null
  const skipDates = rule.skipDates ?? []
  const nextRule: RecurrenceRule = {
    ...rule,
    skipDates: skipDates.includes(base) ? [...skipDates] : [...skipDates, base],
  }
  return moveToOccurrence(task, base, next, nextRule, nowMs)
}
