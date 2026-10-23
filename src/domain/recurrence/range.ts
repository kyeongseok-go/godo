// 달력 표시용: 현재 회차부터 범위 안의 모든 회차를 펼친다.
import type { ISODate, Task } from '../types'
import { isRecurrenceFinished } from './next'
import { stepDue, withMonthDayAnchor } from './steps'

const MAX_RESULTS = 400
/** 아주 오래된 시작일에서 먼 창을 요청해도 계산이 끝나도록 훑는 횟수에 둔 상한. */
const MAX_SCANNED = 20_000

/**
 * [from, to] 범위(양 끝 포함)의 회차 날짜. 현재 회차(startDate, 없으면 dueDate)부터 규칙대로 펼친다.
 * skipDates는 건너뛰고 횟수도 쓰지 않는다. count는 doneCount를 뺀 남은 횟수만큼만 낸다.
 * 완료일 기준 규칙도 미래 회차는 완료 시점을 알 수 없으므로 interval 간격으로 어림한다.
 */
export function occurrencesInRange(task: Task, from: ISODate, to: ISODate): ISODate[] {
  const start = task.startDate ?? task.dueDate
  // 펼치는 동안 31일이 28일로 밀린 채 굳지 않도록 현재 회차를 기준 일로 박아 둔다.
  const rule = task.recurrence === null || start === null ? task.recurrence : withMonthDayAnchor(task.recurrence, start)
  if (rule === null || start === null || from > to) return []

  const skipped = new Set(rule.skipDates ?? [])
  const remaining = rule.end.type === 'count' ? rule.end.count - (rule.doneCount ?? 0) : Infinity
  const result: ISODate[] = []
  let used = 0
  let current = start
  for (let scanned = 0; scanned < MAX_SCANNED; scanned++) {
    if (current > to || result.length >= MAX_RESULTS) break
    if (rule.end.type === 'until' && isRecurrenceFinished(rule, current)) break
    if (!skipped.has(current)) {
      if (used >= remaining) break
      used++
      if (current >= from) result.push(current)
    }
    current = stepDue(rule, current)
  }
  return result
}
