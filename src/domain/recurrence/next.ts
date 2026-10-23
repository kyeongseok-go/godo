// 다음 회차 계산: 규칙 한 걸음(steps.ts) 위에 앵커·종료·건너뛰기·밀린 반복 처리를 얹는다.
import type { ISODate, RecurrenceRule } from '../types'
import { completionBase, stepDue } from './steps'

/** 건너뛴 날짜·밀린 회차를 따라가는 최대 걸음 수(무한 루프 방지). */
const MAX_STEPS = 1000

/** 다음 회차가 종료 조건을 넘었는가. count는 rule.doneCount가 이미 반영된 값으로 본다. */
export function isRecurrenceFinished(rule: RecurrenceRule, nextDate: ISODate): boolean {
  if (rule.end.type === 'until') return nextDate > rule.end.date
  if (rule.end.type === 'count') return (rule.doneCount ?? 0) >= rule.end.count
  return false
}

/**
 * floor(포함 안 함)보다 늦고 skipDates에 없는 첫 회차를 찾는다. 시리즈가 끝났으면 null.
 * 걸음 수 상한을 넘기면 시리즈를 끝내지 않고 floor 바로 다음 회차로 점프한다.
 */
export function findNextAfter(
  rule: RecurrenceRule,
  firstCandidate: ISODate,
  floor: ISODate,
): ISODate | null {
  const skipped = new Set(rule.skipDates ?? [])
  let candidate = firstCandidate
  let budget = MAX_STEPS
  let jumped = false
  for (;;) {
    if (isRecurrenceFinished(rule, candidate)) return null
    if (candidate > floor && !skipped.has(candidate)) return candidate
    if (budget-- <= 0) {
      if (jumped) return null
      jumped = true
      budget = MAX_STEPS
      if (candidate <= floor) {
        candidate = stepDue(rule, floor)
        continue
      }
    }
    candidate = stepDue(rule, candidate)
  }
}

/**
 * 완료했을 때의 다음 회차. 이번 완료를 doneCount에 더해 count 종료를 판정한다.
 * 'due'는 from 다음 회차를 구하되 completedOn 이후가 될 때까지 앞으로 감고,
 * 'completion'은 completedOn에서 interval만큼 더한 날을 쓴다. 시리즈가 끝났으면 null.
 */
export function nextOccurrence(rule: RecurrenceRule, from: ISODate, completedOn: ISODate): ISODate | null {
  const counted: RecurrenceRule = { ...rule, doneCount: (rule.doneCount ?? 0) + 1 }
  const first = rule.anchor === 'completion' ? completionBase(rule, completedOn) : stepDue(rule, from)
  return findNextAfter(counted, first, completedOn)
}
