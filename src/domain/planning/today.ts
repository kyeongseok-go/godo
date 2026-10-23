// C1·F5: 오늘 화면 = 기한 초과 + 시간 블록 + 하루 안 구간
import { compareDate } from '../date'
import type { EngineContext, Task } from '../types'
import { isActionableIn } from './actionable'
import { compareByPlanOrder, effectiveDate, indexById } from './shared'

export interface TodayPlan {
  overdue: Task[]
  morning: Task[]
  afternoon: Task[]
  evening: Task[]
  anytime: Task[]
  timed: Task[]
}

const byPlanOrder = (a: Task, b: Task): number => compareByPlanOrder(a, b)

function byEffectiveDate(a: Task, b: Task): number {
  // overdue 로 분류된 작업은 기준 날짜가 반드시 있다
  const diff = compareDate(effectiveDate(a) ?? '', effectiveDate(b) ?? '')
  return diff !== 0 ? diff : compareByPlanOrder(a, b)
}

function byStartTime(a: Task, b: Task): number {
  const left = a.startTime ?? ''
  const right = b.startTime ?? ''
  if (left !== right) return left < right ? -1 : 1
  return compareByPlanOrder(a, b)
}

export function buildToday(ctx: EngineContext): TodayPlan {
  const byId = indexById(ctx.tasks)
  const plan: TodayPlan = { overdue: [], morning: [], afternoon: [], evening: [], anytime: [], timed: [] }

  for (const task of ctx.tasks) {
    if (!isActionableIn(task, ctx.today, byId)) continue
    const date = effectiveDate(task)
    if (date === null || date > ctx.today) continue
    if (date < ctx.today) plan.overdue.push(task)
    else if (task.startTime !== null) plan.timed.push(task)
    else plan[task.dayPart ?? 'anytime'].push(task)
  }

  return {
    overdue: plan.overdue.sort(byEffectiveDate),
    morning: plan.morning.sort(byPlanOrder),
    afternoon: plan.afternoon.sort(byPlanOrder),
    evening: plan.evening.sort(byPlanOrder),
    anytime: plan.anytime.sort(byPlanOrder),
    timed: plan.timed.sort(byStartTime),
  }
}
