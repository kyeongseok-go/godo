// F6: 빈 시간 자동 배치. 같은 입력이면 항상 같은 결과가 나오도록 모든 정렬에 id 까지 비교한다.
import { addDays, compareDate, minutesOfDay, timeFromMinutes, weekdayOf } from '../date'
import type { ID, ISODate, Task, TimeOfDay, Weekday } from '../types'
import { hasParkedAncestor, isBlocked } from './actionable'
import { scheduledOn, taskMinutes } from './capacity'
import { compareDateNullLast, indexById, isOpen, isParked } from './shared'

export interface BusyBlock {
  date: ISODate
  start: TimeOfDay
  end: TimeOfDay
}

export interface AutoPlaceOptions {
  today: ISODate
  nowTime: TimeOfDay
  horizonDays: number
  workStart: TimeOfDay
  workEnd: TimeOfDay
  bufferMin: number
  defaultMin: number
  /** 시작 시각을 맞추는 간격(분). 보통 15 */
  slotMin: number
  capacityMin: number
  workDays: Weekday[]
}

export interface Placement {
  taskId: ID
  date: ISODate
  startTime: TimeOfDay
  durationMin: number
}

export interface PlacementFailure {
  taskId: ID
  reason: string
}

interface Interval {
  start: number
  end: number
}

interface DayBoard {
  blocks: Interval[]
  plannedMin: number
}

type Board = Map<ISODate, DayBoard>

const DEADLINE_REASON = '마감 전에 들어갈 빈 시간이 없어요'

function dayOf(board: Board, date: ISODate): DayBoard {
  const existing = board.get(date)
  if (existing !== undefined) return existing
  const created: DayBoard = { blocks: [], plannedMin: 0 }
  board.set(date, created)
  return created
}

/**
 * 이미 자리가 잡힌 시간(외부 일정 + 시간이 있는 작업)을 날짜별로 모은다.
 * 외부 일정은 시간만 막고, 용량(plannedMin)에는 작업 시간만 센다.
 */
function buildBoard(tasks: readonly Task[], busy: readonly BusyBlock[], defaultMin: number): Board {
  const board: Board = new Map()
  for (const block of busy) {
    const start = minutesOfDay(block.start)
    const end = minutesOfDay(block.end)
    if (end > start) dayOf(board, block.date).blocks.push({ start, end })
  }
  for (const task of tasks) {
    const date = task.startDate ?? task.dueDate
    if (task.startTime === null || date === null || !scheduledOn(task, date)) continue
    const start = minutesOfDay(task.startTime)
    const minutes = taskMinutes(task, defaultMin)
    const day = dayOf(board, date)
    day.blocks.push({ start, end: start + minutes })
    day.plannedMin += minutes
  }
  return board
}

/** 배치 대상: 미완료·시간 미지정·보류/someday/막힘 아님. 열린 하위 작업이 있는 부모는 컨테이너라 리프만 배치한다. */
function pickCandidates(tasks: readonly Task[]): Task[] {
  const byId = indexById(tasks)
  const parentsWithOpenChild = new Set(
    tasks.filter((t) => isOpen(t) && t.parentId !== null).map((t) => t.parentId),
  )
  return tasks.filter(
    (t) =>
      isOpen(t) &&
      t.startTime === null &&
      !isParked(t) &&
      !parentsWithOpenChild.has(t.id) &&
      !isBlocked(t, byId) &&
      !hasParkedAncestor(t, byId),
  )
}

/** 마감 임박 > 우선순위 > 예상 시간이 긴 것. 나머지는 order, id 로 고정한다. */
function compareCandidates(defaultMin: number): (a: Task, b: Task) => number {
  return (a, b) =>
    compareDateNullLast(a.dueDate, b.dueDate) ||
    a.priority - b.priority ||
    taskMinutes(b, defaultMin) - taskMinutes(a, defaultMin) ||
    a.order - b.order ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

/**
 * 새 블록 [start, end) 이 기존 블록과 부딪히는가. 모든 블록 뒤에는 bufferMin 이 붙으므로
 * 새 블록의 끝 + 버퍼가 기존 시작을 넘거나, 기존 끝 + 버퍼가 새 시작을 넘으면 충돌이다.
 */
function conflicts(blocks: readonly Interval[], start: number, end: number, bufferMin: number): boolean {
  return blocks.some((b) => end + bufferMin > b.start && start < b.end + bufferMin)
}

function findStartOnDay(day: DayBoard, minutes: number, opts: AutoPlaceOptions, isToday: boolean): number | null {
  const slot = Math.max(1, Math.floor(opts.slotMin))
  const workEnd = minutesOfDay(opts.workEnd)
  let lower = minutesOfDay(opts.workStart)
  if (isToday) lower = Math.max(lower, minutesOfDay(opts.nowTime))
  for (let start = Math.ceil(lower / slot) * slot; start + minutes <= workEnd; start += slot) {
    if (!conflicts(day.blocks, start, start + minutes, opts.bufferMin)) return start
  }
  return null
}

interface Found {
  date: ISODate
  start: number
}

function findSlot(
  board: Board,
  minutes: number,
  first: ISODate,
  last: ISODate,
  opts: AutoPlaceOptions,
): Found | null {
  for (let date = first; compareDate(date, last) <= 0; date = addDays(date, 1)) {
    if (!opts.workDays.includes(weekdayOf(date))) continue
    const day = dayOf(board, date)
    if (day.plannedMin + minutes > opts.capacityMin) continue
    const start = findStartOnDay(day, minutes, opts, date === opts.today)
    if (start !== null) return { date, start }
  }
  return null
}

/** 슬롯을 찾기 전에 어떻게 해도 안 들어가는 경우를 먼저 걸러 이유를 구체적으로 알려준다. */
function impossibleReason(
  task: Task,
  minutes: number,
  first: ISODate,
  horizonLast: ISODate,
  opts: AutoPlaceOptions,
): string | null {
  const windowMin = minutesOfDay(opts.workEnd) - minutesOfDay(opts.workStart)
  if (windowMin <= 0) return '근무 시간이 올바르지 않아요'
  if (minutes > opts.capacityMin) return `하루 용량(${opts.capacityMin}분)보다 길어서 배치할 수 없어요`
  if (minutes > windowMin) return `근무 시간(${windowMin}분)보다 길어서 배치할 수 없어요`
  if (first > horizonLast) return `시작일이 계획 기간(${opts.horizonDays}일) 밖이에요`
  // 마감이 이미 지난 작업도 규칙대로 실패로 둔다(마감일 이후로는 넣지 않는다)
  if (task.dueDate !== null && task.dueDate < first) return DEADLINE_REASON
  return null
}

export function autoPlace(
  tasks: readonly Task[],
  busy: readonly BusyBlock[],
  opts: AutoPlaceOptions,
): { placements: Placement[]; failures: PlacementFailure[] } {
  // horizonDays 는 오늘을 포함한 일수다
  const horizonLast = addDays(opts.today, Math.max(1, opts.horizonDays) - 1)
  const board = buildBoard(tasks, busy, opts.defaultMin)
  const placements: Placement[] = []
  const failures: PlacementFailure[] = []

  const ordered = [...pickCandidates(tasks)].sort(compareCandidates(opts.defaultMin))
  for (const task of ordered) {
    const minutes = taskMinutes(task, opts.defaultMin)
    const first = task.startDate !== null && task.startDate > opts.today ? task.startDate : opts.today
    const blocked = impossibleReason(task, minutes, first, horizonLast, opts)
    if (blocked !== null) {
      failures.push({ taskId: task.id, reason: blocked })
      continue
    }
    const last = task.dueDate !== null && task.dueDate < horizonLast ? task.dueDate : horizonLast
    const found = findSlot(board, minutes, first, last, opts)
    if (found === null) {
      const byDeadline = task.dueDate !== null && task.dueDate <= horizonLast
      const reason = byDeadline ? DEADLINE_REASON : `앞으로 ${opts.horizonDays}일 안에 들어갈 빈 시간이 없어요`
      failures.push({ taskId: task.id, reason })
      continue
    }
    const day = dayOf(board, found.date)
    day.blocks.push({ start: found.start, end: found.start + minutes })
    day.plannedMin += minutes
    placements.push({ taskId: task.id, date: found.date, startTime: timeFromMinutes(found.start), durationMin: minutes })
  }
  return { placements, failures }
}
