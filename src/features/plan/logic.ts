// F2·F4·F6: 아침 계획 / 저녁 회고의 순수 로직. 화면은 이 결과만 그린다.
import { daysBetween, minutesOfDay, timeFromMinutes, todayOf } from '../../domain/date'
import { formatDuration } from '../../domain/format'
import {
  autoPlace,
  buildToday,
  dayLoad,
  habitBlocksAsBusy,
  makeActionableChecker,
  planHabitBlocks,
  scheduledOn,
  suggestOffload,
  taskMinutes,
} from '../../domain/planning'
import type {
  BusyBlock,
  DayLoad,
  HabitBlockFailure,
  HabitBlockPlacement,
  Placement,
  PlacementFailure,
} from '../../domain/planning'
import type { DayPlan, EngineContext, Habit, ID, ISODate, Task, TimeFrame } from '../../domain/types'

export type PlanTab = 'morning' | 'evening'

/** 오후 3시부터는 저녁 회고 탭을 먼저 연다 */
const EVENING_START_HOUR = 15
export const MAX_HIGHLIGHTS = 3
const RECENT_REFLECTION_DAYS = 7
const SLOT_MIN = 15

export function defaultPlanTab(now: Date): PlanTab {
  return now.getHours() < EVENING_START_HOUR ? 'morning' : 'evening'
}

/** 같은 우선순위 규칙: 고정 → 우선순위(1이 먼저) → 직접 정한 순서 */
function byPlanOrder(a: Task, b: Task): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
  return a.priority - b.priority || a.order - b.order
}

export interface MorningCandidates {
  /** 이미 오늘로 잡힌 일(시간 지정 → 오전 → 오후 → 저녁 → 하루 중) */
  scheduled: Task[]
  /** 날짜가 없고 지금 할 수 있어서 오늘로 담을 수 있는 일 */
  available: Task[]
}

/**
 * 어제까지 밀린 일(기한 초과)은 일부러 뺀다. 그건 미완료 정리 세션이 맡는다.
 * 담을 후보는 시작일·마감일이 모두 없는 것만 본다 — 날짜가 있는 일은 이미 어딘가에 잡혀 있어서다.
 */
export function morningCandidates(ctx: EngineContext): MorningCandidates {
  const plan = buildToday(ctx)
  const scheduled = [...plan.timed, ...plan.morning, ...plan.afternoon, ...plan.evening, ...plan.anytime]
  const isReady = makeActionableChecker(ctx)
  const available = ctx.tasks
    .filter((t) => t.startDate === null && t.dueDate === null && isReady(t))
    .sort(byPlanOrder)
  return { scheduled, available }
}

export function toggleHighlight(
  current: readonly ID[],
  id: ID,
  max: number = MAX_HIGHLIGHTS,
): { ids: ID[]; rejected: boolean } {
  if (current.includes(id)) return { ids: current.filter((x) => x !== id), rejected: false }
  if (current.length >= max) return { ids: [...current], rejected: true }
  return { ids: [...current, id], rejected: false }
}

/** 오늘에서 빠진 일을 핵심 목록에서 걷어내고 중복·초과를 정리한다 */
export function sanitizeHighlights(ids: readonly ID[], validIds: ReadonlySet<ID>, max: number = MAX_HIGHLIGHTS): ID[] {
  const unique = ids.filter((id, i) => validIds.has(id) && ids.indexOf(id) === i)
  return unique.slice(0, max)
}

/** 그 날짜 용량을 넘겼을 때 내일로 밀 후보. 오늘의 핵심은 지킨다. */
export function offloadCandidates(
  tasks: readonly Task[],
  date: ISODate,
  capacityMin: number,
  defaultMin: number,
  highlightIds: readonly ID[],
): Task[] {
  const load = dayLoad(date, tasks, capacityMin, defaultMin)
  const onDate = tasks.filter((t) => scheduledOn(t, date))
  return suggestOffload(onDate, load.overMin, date, defaultMin, highlightIds)
}

export interface PlacementInput {
  capacityMin: number
  workStart: string
  workEnd: string
  bufferMin: number
  defaultMin: number
  /** F12 시간대 템플릿 */
  frames?: readonly TimeFrame[]
  /** F12 유연한 습관 블록을 먼저 잡아 두려면 습관 목록을 넘긴다 */
  habits?: readonly Habit[]
}

export interface PlacementResult {
  placements: Placement[]
  failures: PlacementFailure[]
  /** 작업보다 먼저 자리를 잡은 습관 블록 */
  habitBlocks: HabitBlockPlacement[]
  habitFailures: HabitBlockFailure[]
}

/**
 * 오늘로 잡힌 일 중 시간이 없는 것만 오늘 빈 시간에 맞춘다.
 * 자동 배치 모듈은 날짜 없는 일까지 훑으므로, 오늘 일과 시간 막힘 정보만 골라서 넘긴다.
 * 습관 블록(F12)은 작업보다 먼저 자리를 잡고, 작업 배치는 그 자리를 피한다.
 */
export function planPlacements(ctx: EngineContext, input: PlacementInput): PlacementResult {
  const nowTime = timeFromMinutes(ctx.now.getHours() * 60 + ctx.now.getMinutes())
  const isReady = makeActionableChecker(ctx)
  const todays = ctx.tasks.filter((t) => scheduledOn(t, ctx.today) && (t.startTime !== null || isReady(t)))
  const habitPlan = planHabitBlocks(input.habits ?? [], busyFromTimedTasks(todays, ctx.today, input.defaultMin), {
    date: ctx.today,
    nowTime,
    bufferMin: input.bufferMin,
    slotMin: SLOT_MIN,
  })
  const result = autoPlace(todays, habitBlocksAsBusy(habitPlan.blocks), {
    today: ctx.today,
    nowTime,
    horizonDays: 1,
    workStart: input.workStart,
    workEnd: input.workEnd,
    bufferMin: input.bufferMin,
    defaultMin: input.defaultMin,
    slotMin: SLOT_MIN,
    capacityMin: input.capacityMin,
    workDays: [0, 1, 2, 3, 4, 5, 6],
    frames: input.frames,
  })
  return {
    placements: result.placements,
    failures: result.failures.map(todayWording),
    habitBlocks: habitPlan.blocks,
    habitFailures: habitPlan.failures,
  }
}

/** 이미 시각이 정해진 작업. 습관 블록이 그 자리를 피하도록 넘긴다. */
export function busyFromTimedTasks(tasks: readonly Task[], date: ISODate, defaultMin: number): BusyBlock[] {
  return tasks.flatMap((task) => {
    if (task.startTime === null) return []
    const start = minutesOfDay(task.startTime)
    return [{ date, start: task.startTime, end: timeFromMinutes(start + taskMinutes(task, defaultMin)) }]
  })
}

/** 계획 기간이 하루뿐이라 "앞으로 1일 안에"는 어색하다. 오늘 화면에 맞게 바꿔 말한다. */
function todayWording(failure: PlacementFailure): PlacementFailure {
  return { ...failure, reason: failure.reason.replace('앞으로 1일 안에', '오늘 안에') }
}

export interface PlacementPreview {
  placement: Placement
  task: Task
  endTime: string
}

export function previewPlacements(placements: readonly Placement[], tasks: readonly Task[]): PlacementPreview[] {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  return placements
    .flatMap((placement) => {
      const task = byId.get(placement.taskId)
      if (task === undefined) return []
      const endTime = timeFromMinutes(minutesOfDay(placement.startTime) + placement.durationMin)
      return [{ placement, task, endTime }]
    })
    .sort((a, b) => a.placement.startTime.localeCompare(b.placement.startTime))
}

export interface EveningSummary {
  done: Task[]
  /** 예상 시간이 있는 완료 작업의 합계(분) */
  estimateMin: number
  /** 그날 기록된 실제 시간의 합계(분) */
  actualMin: number
  /** 실제 시간이 기록되지 않은 완료 작업 수. 합계가 실제보다 작을 수 있음을 알릴 때 쓴다. */
  untrackedCount: number
  unfinished: Task[]
}

export function eveningSummary(tasks: readonly Task[], today: ISODate, dayStartHour: number): EveningSummary {
  const done = tasks
    .filter((t) => isDoneOn(t, today, dayStartHour))
    .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0))
  const estimateMin = done.reduce((sum, t) => sum + (t.estimateMin ?? t.durationMin ?? 0), 0)
  const actualMin = done.reduce((sum, t) => sum + (t.actualMin[today] ?? 0), 0)
  const untrackedCount = done.filter((t) => (t.actualMin[today] ?? 0) <= 0).length
  const unfinished = scheduledTasks(tasks, today)
  return { done, estimateMin, actualMin, untrackedCount, unfinished }
}

/** 그날 잡힌 열린 일. 시간이 있는 것을 시각 순으로 먼저, 나머지는 우선순위 순 */
export function scheduledTasks(tasks: readonly Task[], date: ISODate): Task[] {
  return tasks.filter((t) => scheduledOn(t, date)).sort(byTimeThenPlanOrder)
}

function isDoneOn(task: Task, day: ISODate, dayStartHour: number): boolean {
  if (task.status !== 'done' || task.deletedAt !== null || task.completedAt === null) return false
  return todayOf(new Date(task.completedAt), dayStartHour) === day
}

function byTimeThenPlanOrder(a: Task, b: Task): number {
  if (a.startTime !== b.startTime) {
    if (a.startTime === null) return 1
    if (b.startTime === null) return -1
    return a.startTime < b.startTime ? -1 : 1
  }
  return byPlanOrder(a, b)
}

/** 오늘을 뺀 지난 N일의 회고 중 글이 있는 것, 최근 날짜부터 */
export function recentReflections(
  plans: readonly DayPlan[],
  today: ISODate,
  days: number = RECENT_REFLECTION_DAYS,
): DayPlan[] {
  return plans
    .filter((p) => {
      const ago = daysBetween(p.date, today)
      return ago >= 1 && ago <= days && p.reflection.trim() !== ''
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}

export interface LoadText {
  used: string
  total: string
  note: string
}

/** 용량 막대 옆 문구. 넘쳤을 때도 질책하는 말투를 쓰지 않는다. */
export function describeLoad(load: DayLoad): LoadText {
  const used = formatDuration(load.plannedMin)
  const total = formatDuration(load.capacityMin)
  if (load.level === 'over') return { used, total, note: `${formatDuration(load.overMin)} 넘쳤어요` }
  if (load.level === 'near') return { used, total, note: '거의 찼어요' }
  if (load.plannedMin === 0) return { used, total, note: '아직 비어 있어요' }
  return { used, total, note: `${formatDuration(load.capacityMin - load.plannedMin)} 여유` }
}

const MAX_CAPACITY_HOURS = 24

/** 시간 단위 입력("6", "5.5", "4,5")을 분으로. 0 이하이거나 하루를 넘으면 null */
export function parseCapacityHours(text: string): number | null {
  const hours = Number(text.trim().replace(',', '.'))
  if (text.trim() === '' || !Number.isFinite(hours)) return null
  if (hours <= 0 || hours > MAX_CAPACITY_HOURS) return null
  return Math.round(hours * 60)
}

/** 오늘의 핵심 중 끝낸 수. 사라진 작업은 세지 않는다. */
export function highlightProgress(ids: readonly ID[], tasks: readonly Task[]): { done: number; total: number } {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const found = ids.flatMap((id) => byId.get(id) ?? [])
  return { done: found.filter((t) => t.status === 'done').length, total: found.length }
}
