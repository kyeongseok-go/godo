// F12: 작업 유형별 시간대 템플릿. "딥워크는 오전, 잡무는 오후"를 자동 배치가 지키게 한다.
import { minutesOfDay, weekdayOf } from '../date'
import type { ISODate, Task, TimeFrame } from '../types'
import type { Interval } from './slots'

/** 시작이 종료보다 빠르고 쓰는 요일이 있는 시간대만 쓸모가 있다. */
function isUsable(frame: TimeFrame): boolean {
  return frame.days.length > 0 && minutesOfDay(frame.start) < minutesOfDay(frame.end)
}

function matches(task: Task, frame: TimeFrame, minutes: number): boolean {
  const { labelIds, priorities, minMinutes } = frame.match
  if (labelIds.length > 0 && !labelIds.some((id) => task.labelIds.includes(id))) return false
  if (priorities.length > 0 && !priorities.includes(task.priority)) return false
  if (minMinutes !== null && minutes < minMinutes) return false
  return true
}

/**
 * 그 일에 해당하는 시간대 템플릿을 order 순으로. 조건이 모두 비어 있는 템플릿은 모든 일에 해당한다.
 * 비어 있는 배열이면 템플릿 제약이 없다는 뜻이다(근무 시간 전체를 쓴다).
 */
export function framesForTask(task: Task, frames: readonly TimeFrame[], minutes: number): TimeFrame[] {
  return frames
    .filter((frame) => isUsable(frame) && matches(task, frame, minutes))
    .sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

export interface FrameWindow {
  /** null 이면 템플릿이 아니라 근무 시간 */
  frame: TimeFrame | null
  range: Interval
}

export interface FrameWindows {
  /** 템플릿 제약이 걸렸는가. 걸렸으면 날짜에 따라 창이 없을 수도 있다 */
  constrained: boolean
  /** 그 날짜에 쓸 수 있는 창. 이른 시각부터 시도한다 */
  windows: FrameWindow[]
}

/**
 * 그 일을 그 날짜에 넣을 수 있는 시간 창들.
 * 템플릿은 일부러 정한 시간이라 근무 시간 밖이어도 그대로 쓴다.
 */
export function frameWindows(
  task: Task,
  frames: readonly TimeFrame[],
  date: ISODate,
  minutes: number,
  fallback: Interval,
): FrameWindows {
  const matching = framesForTask(task, frames, minutes)
  if (matching.length === 0) return { constrained: false, windows: [{ frame: null, range: fallback }] }
  const weekday = weekdayOf(date)
  const windows = matching
    .filter((frame) => frame.days.includes(weekday))
    .map((frame) => ({ frame, range: { start: minutesOfDay(frame.start), end: minutesOfDay(frame.end) } }))
    .sort((a, b) => a.range.start - b.range.start || a.range.end - b.range.end)
  return { constrained: true, windows }
}

/** 가장 긴 창의 길이(분). 어떤 창에도 안 들어가는 일을 미리 걸러낼 때 쓴다. */
export function longestWindowMin(frames: readonly TimeFrame[]): number {
  return frames.reduce((max, f) => Math.max(max, minutesOfDay(f.end) - minutesOfDay(f.start)), 0)
}

/** 사람에게 보여 줄 시간대 이름과 시각. 예) 딥워크(09:00–12:00) */
export function describeFrame(frame: TimeFrame): string {
  return `${frame.name}(${frame.start}–${frame.end})`
}
