import { isTimeOfDay, minutesOfDay } from '../../domain/date'
import type { TimeOfDay } from '../../domain/types'

export type SnoozeChoice = '10m' | '1h' | 'tomorrow'

export const SNOOZE_CHOICES: ReadonlyArray<{ id: SnoozeChoice; label: string }> = [
  { id: '10m', label: '10분 뒤' },
  { id: '1h', label: '1시간 뒤' },
  { id: 'tomorrow', label: '내일 아침' },
]

const MINUTE_MS = 60_000
const FALLBACK_WORK_START: TimeOfDay = '09:00'

/** 미룬 알림이 다시 울릴 시각(epoch ms). 내일 아침은 업무 시작 시각을 따른다. */
export function snoozeUntil(choice: SnoozeChoice, now: number, workStart: TimeOfDay): number {
  if (choice === '10m') return now + 10 * MINUTE_MS
  if (choice === '1h') return now + 60 * MINUTE_MS
  const minutes = minutesOfDay(isTimeOfDay(workStart) ? workStart : FALLBACK_WORK_START)
  const today = new Date(now)
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, Math.floor(minutes / 60), minutes % 60).getTime()
}
