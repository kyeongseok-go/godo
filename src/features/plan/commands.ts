// 하루 계획(DayPlan)과 계획 화면이 쓰는 할 일 변경 명령. 전부 순수 함수이고, 저장·실행 취소는 commit 이 맡는다.
import type { Placement } from '../../domain/planning'
import type { DayPlan, ID, ISODate } from '../../domain/types'
import { EMPTY_CHANGES, mergeChangeSets } from '../../store/changes'
import type { ChangeSet, EntityState } from '../../store/changes'
import { patchTask, patchTasks, postponeTask } from '../../store/commands/taskCommands'
import { MAX_HIGHLIGHTS } from './logic'

export function emptyDayPlan(date: ISODate): DayPlan {
  return { date, capacityMin: null, highlightIds: [], morningDoneAt: null, eveningDoneAt: null, reflection: '' }
}

export function dayPlanOf(state: EntityState, date: ISODate): DayPlan {
  return state.dayPlans[date] ?? emptyDayPlan(date)
}

const putPlan = (plan: DayPlan): ChangeSet => ({ puts: { dayPlans: [plan] }, deletes: {} })

/** 그날 용량(분). null 이면 설정의 기본값으로 돌아간다. 0 이하는 의미가 없어 무시한다. */
export function setCapacity(state: EntityState, date: ISODate, capacityMin: number | null): ChangeSet {
  if (capacityMin !== null && !(capacityMin > 0)) return EMPTY_CHANGES
  return putPlan({ ...dayPlanOf(state, date), capacityMin })
}

export function setHighlights(state: EntityState, date: ISODate, ids: readonly ID[]): ChangeSet {
  const unique = ids.filter((id, i) => ids.indexOf(id) === i).slice(0, MAX_HIGHLIGHTS)
  return putPlan({ ...dayPlanOf(state, date), highlightIds: unique })
}

export function finishMorning(state: EntityState, date: ISODate, nowMs: number): ChangeSet {
  return putPlan({ ...dayPlanOf(state, date), morningDoneAt: nowMs })
}

/** 다시 고쳐 써도 처음 마친 시각은 그대로 둔다 */
export function finishEvening(state: EntityState, date: ISODate, reflection: string, nowMs: number): ChangeSet {
  const plan = dayPlanOf(state, date)
  return putPlan({ ...plan, reflection: reflection.trim(), eveningDoneAt: plan.eveningDoneAt ?? nowMs })
}

/** 오늘로 담기(date) 또는 날짜 비우기(null) */
export function scheduleTasks(state: EntityState, ids: readonly ID[], date: ISODate | null, nowMs: number): ChangeSet {
  return patchTasks(state, ids, { startDate: date }, nowMs)
}

/** 여러 일을 한 번에 다른 날로 민다. 미룬 횟수가 하나씩 올라간다. */
export function pushToDay(state: EntityState, ids: readonly ID[], date: ISODate, nowMs: number): ChangeSet {
  return mergeChangeSets(EMPTY_CHANGES, ...ids.map((id) => postponeTask(state, id, date, nowMs)))
}

/** 자동 배치 제안을 작업에 적는다. 시간과 함께 블록 길이도 확정한다. */
export function applyPlacements(state: EntityState, placements: readonly Placement[], nowMs: number): ChangeSet {
  return mergeChangeSets(
    EMPTY_CHANGES,
    ...placements.map((p) =>
      patchTask(state, p.taskId, { startDate: p.date, startTime: p.startTime, durationMin: p.durationMin }, nowMs),
    ),
  )
}
