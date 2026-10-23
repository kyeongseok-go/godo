// F6: 빈 시간 자동 배치. 같은 입력이면 항상 같은 결과가 나오도록 모든 정렬에 id 까지 비교한다.
// F12: 시간대 템플릿(frames)이 있으면 조건에 맞는 일을 그 시간대 안에만 넣는다.
import { addDays, compareDate, minutesOfDay, timeFromMinutes, weekdayOf } from '../date'
import type { ID, ISODate, Task, TimeFrame, TimeOfDay, Weekday } from '../types'
import { hasParkedAncestor, isBlocked } from './actionable'
import { scheduledOn, taskMinutes } from './capacity'
import { describeFrame, frameWindows, framesForTask, longestWindowMin } from './frames'
import { compareDateNullLast, indexById, isOpen, isParked } from './shared'
import { findFreeStart } from './slots'
import type { BusyBlock, Interval } from './slots'

export type { BusyBlock } from './slots'

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
  /** F12 시간대 템플릿. 없으면 근무 시간 전체를 쓴다 */
  frames?: readonly TimeFrame[]
}

export interface Placement {
  taskId: ID
  date: ISODate
  startTime: TimeOfDay
  durationMin: number
  /** 어느 시간대 템플릿에 들어갔는지. 템플릿을 쓰지 않았으면 null */
  frameName: string | null
}

export interface PlacementFailure {
  taskId: ID
  reason: string
}

interface DayBoard {
  blocks: Interval[]
  plannedMin: number
}

type Board = Map<ISODate, DayBoard>

const DEADLINE_REASON = '마감 전에 들어갈 빈 시간이 없어요'
/** 실패 이유에 이름을 늘어놓지 않도록 앞의 몇 개만 적는다 */
const MAX_NAMED_FRAMES = 2

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

interface Found {
  date: ISODate
  start: number
  frameName: string | null
}

/** 하루 안에서 쓸 수 있는 창을 차례로 보며 가장 빠른 자리를 찾는다. */
function findOnDay(
  day: DayBoard,
  task: Task,
  minutes: number,
  date: ISODate,
  opts: AutoPlaceOptions,
  work: Interval,
): Omit<Found, 'date'> | null {
  const { windows } = frameWindows(task, opts.frames ?? [], date, minutes, work)
  for (const window of windows) {
    const start = findFreeStart(day.blocks, minutes, window.range, {
      slotMin: opts.slotMin,
      bufferMin: opts.bufferMin,
      notBefore: date === opts.today ? minutesOfDay(opts.nowTime) : undefined,
    })
    if (start !== null) return { start, frameName: window.frame?.name ?? null }
  }
  return null
}

function findSlot(
  board: Board,
  task: Task,
  minutes: number,
  first: ISODate,
  last: ISODate,
  opts: AutoPlaceOptions,
  work: Interval,
): Found | null {
  for (let date = first; compareDate(date, last) <= 0; date = addDays(date, 1)) {
    if (!opts.workDays.includes(weekdayOf(date))) continue
    const day = dayOf(board, date)
    if (day.plannedMin + minutes > opts.capacityMin) continue
    const found = findOnDay(day, task, minutes, date, opts, work)
    if (found !== null) return { date, ...found }
  }
  return null
}

/** 템플릿 이름 목록. "딥워크, 집중" 처럼 앞의 몇 개만 적는다. */
function nameFrames(frames: readonly TimeFrame[]): string {
  const names = frames.slice(0, MAX_NAMED_FRAMES).map((f) => f.name)
  return frames.length > MAX_NAMED_FRAMES ? `${names.join(', ')} 등` : names.join(', ')
}

/** 슬롯을 찾기 전에 어떻게 해도 안 들어가는 경우를 먼저 걸러 이유를 구체적으로 알려준다. */
function impossibleReason(
  task: Task,
  minutes: number,
  first: ISODate,
  horizonLast: ISODate,
  opts: AutoPlaceOptions,
  matching: readonly TimeFrame[],
): string | null {
  const windowMin = minutesOfDay(opts.workEnd) - minutesOfDay(opts.workStart)
  if (matching.length === 0 && windowMin <= 0) return '근무 시간이 올바르지 않아요'
  if (minutes > opts.capacityMin) return `하루 용량(${opts.capacityMin}분)보다 길어서 배치할 수 없어요`
  if (matching.length > 0) {
    const longest = longestWindowMin(matching)
    if (minutes > longest) {
      const where = matching.length === 1 ? describeFrame(matching[0]) : `${nameFrames(matching)} 시간대`
      return `${where}가 ${longest}분이라 ${minutes}분 일을 넣을 수 없어요`
    }
  } else if (minutes > windowMin) {
    return `근무 시간(${windowMin}분)보다 길어서 배치할 수 없어요`
  }
  if (first > horizonLast) return `시작일이 계획 기간(${opts.horizonDays}일) 밖이에요`
  // 마감이 이미 지난 작업도 규칙대로 실패로 둔다(마감일 이후로는 넣지 않는다)
  if (task.dueDate !== null && task.dueDate < first) return DEADLINE_REASON
  return null
}

/** 자리를 못 찾았을 때의 이유. 템플릿에 묶인 일은 어느 시간대가 막혔는지 알려준다. */
function notFoundReason(
  task: Task,
  horizonLast: ISODate,
  opts: AutoPlaceOptions,
  matching: readonly TimeFrame[],
): string {
  if (matching.length > 0) return `${nameFrames(matching)} 시간대에 들어갈 빈 시간이 없어요`
  if (task.dueDate !== null && task.dueDate <= horizonLast) return DEADLINE_REASON
  return `앞으로 ${opts.horizonDays}일 안에 들어갈 빈 시간이 없어요`
}

export function autoPlace(
  tasks: readonly Task[],
  busy: readonly BusyBlock[],
  opts: AutoPlaceOptions,
): { placements: Placement[]; failures: PlacementFailure[] } {
  // horizonDays 는 오늘을 포함한 일수다
  const horizonLast = addDays(opts.today, Math.max(1, opts.horizonDays) - 1)
  const board = buildBoard(tasks, busy, opts.defaultMin)
  const work: Interval = { start: minutesOfDay(opts.workStart), end: minutesOfDay(opts.workEnd) }
  const placements: Placement[] = []
  const failures: PlacementFailure[] = []

  const ordered = [...pickCandidates(tasks)].sort(compareCandidates(opts.defaultMin))
  for (const task of ordered) {
    const minutes = taskMinutes(task, opts.defaultMin)
    const matching = framesForTask(task, opts.frames ?? [], minutes)
    const first = task.startDate !== null && task.startDate > opts.today ? task.startDate : opts.today
    const blocked = impossibleReason(task, minutes, first, horizonLast, opts, matching)
    if (blocked !== null) {
      failures.push({ taskId: task.id, reason: blocked })
      continue
    }
    const last = task.dueDate !== null && task.dueDate < horizonLast ? task.dueDate : horizonLast
    const found = findSlot(board, task, minutes, first, last, opts, work)
    if (found === null) {
      failures.push({ taskId: task.id, reason: notFoundReason(task, horizonLast, opts, matching) })
      continue
    }
    const day = dayOf(board, found.date)
    day.blocks.push({ start: found.start, end: found.start + minutes })
    day.plannedMin += minutes
    placements.push({
      taskId: task.id,
      date: found.date,
      startTime: timeFromMinutes(found.start),
      durationMin: minutes,
      frameName: found.frameName,
    })
  }
  return { placements, failures }
}
