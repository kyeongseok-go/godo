// 하루 리본: 그날의 시간대를 가로 한 줄로 펼쳐 시각이 정해진 일이 어디에 앉아 있는지 보여 준다.
// 화면은 여기서 나온 비율만 그린다.
import { minutesOfDay } from '../../domain/date'
import { scheduledOn, taskMinutes } from '../../domain/planning'
import type { ID, ISODate, Priority, Task } from '../../domain/types'

export interface RibbonSegment {
  id: ID
  title: string
  priority: Priority
  done: boolean
  startMin: number
  endMin: number
}

export interface RibbonWindow {
  startMin: number
  endMin: number
}

const DAY_END = 24 * 60
/** 창이 너무 좁으면 눈금이 의미를 잃는다. 최소 이만큼은 펼친다. */
const MIN_SPAN_MIN = 240

/**
 * 그 날짜에 시각이 정해진 일. 이른 시각부터, 같으면 긴 일부터.
 * 끝낸 일도 그린다. 하루가 어떻게 흘렀는지가 리본이 보여 줄 것이기 때문이다.
 */
export function ribbonSegments(tasks: readonly Task[], date: ISODate, defaultMin: number): RibbonSegment[] {
  const onDate = (t: Task): boolean =>
    scheduledOn(t, date) || (t.status === 'done' && t.deletedAt === null && (t.startDate ?? t.dueDate) === date)
  return tasks
    .filter((t) => t.deletedAt === null && t.startTime !== null && onDate(t))
    .map((t) => {
      const startMin = minutesOfDay(t.startTime as string)
      return {
        id: t.id,
        title: t.title,
        priority: t.priority,
        done: t.status === 'done',
        startMin,
        endMin: Math.min(DAY_END, startMin + taskMinutes(t, defaultMin)),
      }
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin || (a.id < b.id ? -1 : 1))
}

/**
 * 리본이 덮을 시간대. 근무 시간을 기본으로 하되, 그 밖에 잡힌 일과 지금 시각까지 담는다.
 * 하루 전체(0~24시)를 그리면 정작 일이 있는 구간이 뭉개져서다.
 */
export function ribbonWindow(
  workStart: string,
  workEnd: string,
  segments: readonly RibbonSegment[],
  nowMin: number | null,
): RibbonWindow {
  // 정시에 맞춰 끊는다. 지금 시각이 창 끝에 딱 붙어 눈금이 잘리지 않게 하려는 것이기도 하다.
  const rawStart = Math.min(minutesOfDay(workStart), ...segments.map((s) => s.startMin), nowMin ?? DAY_END)
  const rawEnd = Math.max(minutesOfDay(workEnd), ...segments.map((s) => s.endMin), nowMin ?? 0)
  const start = Math.max(0, Math.floor(rawStart / 60) * 60)
  const end = Math.min(DAY_END, Math.ceil(rawEnd / 60) * 60)
  if (end - start >= MIN_SPAN_MIN) return { startMin: start, endMin: end }
  // 좁을 때는 뒤쪽으로 먼저 늘리고, 하루 끝에 닿으면 앞쪽으로 늘린다
  const endWanted = Math.min(DAY_END, start + MIN_SPAN_MIN)
  return { startMin: Math.max(0, endWanted - MIN_SPAN_MIN), endMin: endWanted }
}

/** 창 안에서의 위치를 0~100 백분율로. 창 밖은 잘라 낸다. */
export function ribbonPlacement(window: RibbonWindow, startMin: number, endMin: number): { left: number; width: number } {
  const span = Math.max(1, window.endMin - window.startMin)
  const from = Math.max(window.startMin, Math.min(startMin, window.endMin))
  const to = Math.max(from, Math.min(endMin, window.endMin))
  return { left: ((from - window.startMin) / span) * 100, width: ((to - from) / span) * 100 }
}

/** 창 안에서의 한 시점 위치. 창 밖이면 null(지금 시각 표시를 숨긴다). */
export function ribbonPoint(window: RibbonWindow, atMin: number): number | null {
  if (atMin < window.startMin || atMin > window.endMin) return null
  const span = Math.max(1, window.endMin - window.startMin)
  return ((atMin - window.startMin) / span) * 100
}

/** 창을 가로지르는 정시 눈금. 창이 길면 2시간, 더 길면 3시간 간격으로 띄운다. */
export function ribbonTicks(window: RibbonWindow): Array<{ atMin: number; left: number; label: string }> {
  const span = window.endMin - window.startMin
  const stepH = span > 12 * 60 ? 3 : span > 7 * 60 ? 2 : 1
  const first = Math.ceil(window.startMin / 60 / stepH) * stepH * 60
  const ticks: Array<{ atMin: number; left: number; label: string }> = []
  for (let atMin = first; atMin <= window.endMin; atMin += stepH * 60) {
    const left = ribbonPoint(window, atMin)
    if (left !== null) ticks.push({ atMin, left, label: String(atMin / 60).padStart(2, '0') })
  }
  return ticks
}
