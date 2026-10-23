// 알림이 울릴 시각을 계산하는 순수 로직. 현재 시각·저장소는 모두 인자로 받는다.
import { isISODate, isTimeOfDay, minutesOfDay } from '../../domain/date'
import { formatTime } from '../../domain/format'
import type { EpochMs, ID, ISODate, Task, TimeOfDay } from '../../domain/types'

export const DEFAULT_WORK_START: TimeOfDay = '09:00'
/** 앱이 꺼져 있던 동안 놓친 알림을 되살리는 한도 */
export const LOOKBACK_MS = 24 * 60 * 60_000
/** 지속 알림이 다시 울리는 간격 */
export const REPEAT_INTERVAL_MS = 10 * 60_000

const MINUTE_MS = 60_000
const MINUTES_PER_DAY = 1440
const KEY_PARTS = 3

export interface ScheduleOptions {
  /** 시각 없이 날짜만 있는 작업의 기준 시각. 설정의 업무 시작 시각 */
  workStart?: TimeOfDay
}

export interface ReminderEntry {
  reminderId: ID
  /** `${taskId}|${reminderId}|${회차 날짜}`. 같은 회차의 같은 알림은 항상 같은 key 다. */
  key: string
  at: EpochMs
  /** 상대 알림의 앞당김(분). 절대 알림은 null */
  offsetMin: number | null
}

export interface DueReminder {
  key: string
  taskId: ID
  title: string
  at: EpochMs
  body: string
}

export interface DueOptions extends ScheduleOptions {
  now: EpochMs
  /** 마지막으로 확인한 시각. 이 시각보다 뒤에 울릴 알림만 대상이다. */
  lastCheck: EpochMs
  /** 이미 울린 key */
  fired: ReadonlySet<string>
  /** 미룬 알림: 기본 key → 다시 울릴 시각 */
  snoozed?: Readonly<Record<string, EpochMs>>
  timeFormat?: '12h' | '24h'
}

/** 완료·취소·삭제·보류·언젠가 작업에는 알림을 울리지 않는다. */
export function isReminderEligible(task: Task): boolean {
  return task.status !== 'done' && task.status !== 'canceled' && task.deletedAt === null && !task.onHold && !task.someday
}

/** 스누즈·지속 알림 접미사를 떼고 `taskId|reminderId|날짜` 만 남긴다. */
export function baseKey(key: string): string {
  return key.split('|').slice(0, KEY_PARTS).join('|')
}

/** 화면에 떠 있는 알림 카드가 아직 유효한가: 작업이 살아 있고 같은 회차여야 한다(반복 작업은 완료하면 회차가 바뀐다). */
export function isReminderLive(task: Task | undefined, key: string): boolean {
  return task !== undefined && isReminderEligible(task) && key.split('|')[KEY_PARTS - 1] === task.startDate
}

function localEpoch(date: ISODate, time: TimeOfDay): EpochMs {
  const [year, month, day] = date.split('-').map(Number)
  const minutes = minutesOfDay(time)
  return new Date(year, month - 1, day, Math.floor(minutes / 60), minutes % 60).getTime()
}

/** 작업의 각 알림이 울릴 시각과 key. 현재 회차(startDate)만 본다. */
export function reminderEntries(task: Task, opts: ScheduleOptions = {}): ReminderEntry[] {
  if (!isReminderEligible(task) || !task.startDate || !isISODate(task.startDate)) return []
  const workStart = isTimeOfDay(opts.workStart) ? opts.workStart : DEFAULT_WORK_START
  const startAt = localEpoch(task.startDate, isTimeOfDay(task.startTime) ? task.startTime : workStart)
  const entries: ReminderEntry[] = []
  for (const reminder of task.reminders) {
    const key = `${task.id}|${reminder.id}|${task.startDate}`
    if (reminder.kind === 'absolute') {
      if (Number.isFinite(reminder.at)) entries.push({ reminderId: reminder.id, key, at: reminder.at, offsetMin: null })
    } else if (Number.isFinite(reminder.offsetMin)) {
      const at = startAt - reminder.offsetMin * MINUTE_MS
      entries.push({ reminderId: reminder.id, key, at, offsetMin: reminder.offsetMin })
    }
  }
  return entries
}

export function reminderTimes(task: Task, opts: ScheduleOptions = {}): number[] {
  return reminderEntries(task, opts).map((entry) => entry.at)
}

function offsetText(offsetMin: number): string {
  if (offsetMin % MINUTES_PER_DAY === 0) {
    const days = offsetMin / MINUTES_PER_DAY
    return days === 1 ? '하루 전' : `${days}일 전`
  }
  const hours = Math.floor(offsetMin / 60)
  const minutes = offsetMin % 60
  if (hours === 0) return `${minutes}분 전`
  return minutes === 0 ? `${hours}시간 전` : `${hours}시간 ${minutes}분 전`
}

function describeStart(task: Task, entry: ReminderEntry, format: '12h' | '24h'): string {
  const [, month, day] = (task.startDate ?? '').split('-').map(Number)
  const what = isTimeOfDay(task.startTime) ? `${formatTime(task.startTime, format)} 시작` : `${month}월 ${day}일 할 일`
  return entry.offsetMin !== null && entry.offsetMin > 0 ? `${what} · ${offsetText(entry.offsetMin)}` : what
}

interface Occurrence {
  key: string
  at: EpochMs
  round: number
}

/**
 * 기준 시각(anchor)에서 시작하는 알림 중 이번 확인 구간에 걸린 회차를 고른다.
 * 지속 알림은 놓친 회차가 여러 개여도 가장 최근 한 건만 낸다(알림 폭주 방지).
 */
function pickOccurrence(anchor: EpochMs, key: string, persistent: boolean, lastCheck: EpochMs, now: EpochMs): Occurrence | null {
  if (anchor > now) return null
  if (!persistent) {
    const lower = Math.max(lastCheck, now - LOOKBACK_MS)
    return anchor > lower ? { key, at: anchor, round: 0 } : null
  }
  const round = Math.floor((now - anchor) / REPEAT_INTERVAL_MS)
  const at = anchor + round * REPEAT_INTERVAL_MS
  if (at <= lastCheck) return null
  return { key: round === 0 ? key : `${key}|${round}`, at, round }
}

function bodyOf(task: Task, entry: ReminderEntry, occurrence: Occurrence, isWake: boolean, format: '12h' | '24h'): string {
  const base = describeStart(task, entry, format)
  if (occurrence.round > 0) return `아직 완료하지 않았어요 · ${base}`
  return isWake ? `미뤄 둔 알림 · ${base}` : base
}

export function dueReminders(tasks: readonly Task[], opts: DueOptions): DueReminder[] {
  const { now, lastCheck, fired, snoozed = {}, timeFormat = '24h' } = opts
  const due: DueReminder[] = []
  for (const task of tasks) {
    for (const entry of reminderEntries(task, opts)) {
      const until = snoozed[entry.key]
      const isWake = typeof until === 'number' && Number.isFinite(until)
      const anchor = isWake ? until : entry.at
      const key = isWake ? `${entry.key}|z${until}` : entry.key
      const occurrence = pickOccurrence(anchor, key, task.persistentReminder, lastCheck, now)
      if (!occurrence || fired.has(occurrence.key)) continue
      due.push({
        key: occurrence.key,
        taskId: task.id,
        title: task.title,
        at: occurrence.at,
        body: bodyOf(task, entry, occurrence, isWake, timeFormat),
      })
    }
  }
  return due.sort((a, b) => a.at - b.at || a.key.localeCompare(b.key))
}
