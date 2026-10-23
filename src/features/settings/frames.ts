// F12 시간대 템플릿 목록을 다루는 순수 함수. 화면은 이 결과만 저장한다.
import { minutesOfDay } from '../../domain/date'
import type { ID, Label, Priority, TimeFrame, Weekday } from '../../domain/types'

const ORDER_STEP = 1000
export const MAX_FRAMES = 12
export const PRIORITIES: readonly Priority[] = [1, 2, 3, 4]

/** 새 시간대의 기본값. 근무 시간 앞쪽 세 시간을 평일에 쓰는 모양으로 시작한다. */
export function newFrame(id: ID, frames: readonly TimeFrame[]): TimeFrame {
  return {
    id,
    name: '새 시간대',
    days: [1, 2, 3, 4, 5],
    start: '09:00',
    end: '12:00',
    match: { labelIds: [], priorities: [], minMinutes: null },
    order: frames.reduce((max, f) => Math.max(max, f.order), 0) + ORDER_STEP,
  }
}

export function addFrame(frames: readonly TimeFrame[], frame: TimeFrame): TimeFrame[] {
  return frames.length >= MAX_FRAMES ? [...frames] : [...frames, frame]
}

export function removeFrame(frames: readonly TimeFrame[], id: ID): TimeFrame[] {
  return frames.filter((f) => f.id !== id)
}

export function patchFrame(frames: readonly TimeFrame[], id: ID, patch: Partial<TimeFrame>): TimeFrame[] {
  return frames.map((f) => (f.id === id ? { ...f, ...patch, id: f.id } : f))
}

export function toggleFrameDay(frames: readonly TimeFrame[], id: ID, day: Weekday): TimeFrame[] {
  return frames.map((f) =>
    f.id === id ? { ...f, days: f.days.includes(day) ? f.days.filter((d) => d !== day) : [...f.days, day].sort((a, b) => a - b) } : f,
  )
}

export function toggleFrameLabel(frames: readonly TimeFrame[], id: ID, labelId: ID): TimeFrame[] {
  return frames.map((f) => {
    if (f.id !== id) return f
    const { labelIds } = f.match
    const next = labelIds.includes(labelId) ? labelIds.filter((l) => l !== labelId) : [...labelIds, labelId]
    return { ...f, match: { ...f.match, labelIds: next } }
  })
}

export function toggleFramePriority(frames: readonly TimeFrame[], id: ID, priority: Priority): TimeFrame[] {
  return frames.map((f) => {
    if (f.id !== id) return f
    const { priorities } = f.match
    const next = priorities.includes(priority)
      ? priorities.filter((p) => p !== priority)
      : [...priorities, priority].sort((a, b) => a - b)
    return { ...f, match: { ...f.match, priorities: next } }
  })
}

/** 저장해도 쓸모가 없는 시간대라면 이유를 돌려준다. 저장은 막지 않고 안내만 한다. */
export function frameProblem(frame: TimeFrame): string | null {
  if (frame.name.trim() === '') return '이름이 비어 있어요'
  if (frame.days.length === 0) return '쓰는 요일이 없어서 쓰이지 않아요'
  if (minutesOfDay(frame.start) >= minutesOfDay(frame.end)) return '종료 시각이 시작 시각보다 늦어야 해요'
  const span = minutesOfDay(frame.end) - minutesOfDay(frame.start)
  const { minMinutes } = frame.match
  if (minMinutes !== null && minMinutes > span) return `최소 길이(${minMinutes}분)가 시간대(${span}분)보다 길어요`
  return null
}

/** 조건을 사람 말로. 조건이 없으면 "모든 일". */
export function describeFrameMatch(frame: TimeFrame, labels: readonly Label[]): string {
  const names = frame.match.labelIds.map((id) => labels.find((l) => l.id === id)?.name ?? '사라진 라벨')
  const parts: string[] = []
  if (names.length > 0) parts.push(`@${names.join(', @')}`)
  if (frame.match.priorities.length > 0) parts.push(frame.match.priorities.map((p) => `P${p}`).join(', '))
  if (frame.match.minMinutes !== null) parts.push(`${frame.match.minMinutes}분 이상`)
  return parts.length === 0 ? '모든 일' : parts.join(' · ')
}

export interface FramePreset {
  name: string
  start: string
  end: string
  days: Weekday[]
  minMinutes: number | null
  priorities: Priority[]
}

/** 처음 쓰는 사람이 바로 고를 수 있는 조합. 라벨은 환경마다 달라서 쓰지 않는다. */
export const FRAME_PRESETS: readonly FramePreset[] = [
  { name: '딥워크', start: '09:00', end: '12:00', days: [1, 2, 3, 4, 5], minMinutes: 60, priorities: [] },
  { name: '잡무', start: '14:00', end: '18:00', days: [1, 2, 3, 4, 5], minMinutes: null, priorities: [3, 4] },
]

export function framesFromPresets(presets: readonly FramePreset[], ids: readonly ID[]): TimeFrame[] {
  return presets.slice(0, ids.length).map((preset, i) => ({
    id: ids[i],
    name: preset.name,
    days: [...preset.days],
    start: preset.start,
    end: preset.end,
    match: { labelIds: [], priorities: [...preset.priorities], minMinutes: preset.minMinutes },
    order: (i + 1) * ORDER_STEP,
  }))
}
