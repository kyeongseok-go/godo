// 알림이 어디까지 처리됐는지(마지막 확인 시각, 이미 울린 key, 미룬 알림)를 다루는 순수 로직과 저장 도우미.
// 저장소는 인자로 받는다. 접근이 막힌 환경(사생활 보호 창 등)에서도 앱이 멈추지 않게 모든 접근을 try/catch 로 감싼다.
import { baseKey } from './schedule'
import type { DueReminder } from './schedule'

export const STORAGE_KEY = 'pace.reminders.v1'
/** 이 시간이 지난 기록은 정리한다. 놓친 알림 복구 한도(24시간)보다 길어야 중복 알림이 생기지 않는다. */
const RETENTION_MS = 48 * 60 * 60_000

export interface StorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export interface ReminderState {
  lastCheck: number
  /** 울린 key → 울린 시각 */
  fired: Readonly<Record<string, number>>
  /** 기본 key → 다시 울릴 시각 */
  snoozed: Readonly<Record<string, number>>
}

export function emptyState(): ReminderState {
  return { lastCheck: 0, fired: {}, snoozed: {} }
}

function numberRecord(value: unknown): Record<string, number> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const entries = Object.entries(value).filter((entry): entry is [string, number] => Number.isFinite(entry[1]))
  return Object.fromEntries(entries)
}

/** 저장소에서 읽은 값은 믿지 않고 하나씩 검증한다. */
export function parseState(raw: unknown): ReminderState {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return emptyState()
  const record = raw as Record<string, unknown>
  const lastCheck = typeof record.lastCheck === 'number' && Number.isFinite(record.lastCheck) ? record.lastCheck : 0
  return { lastCheck, fired: numberRecord(record.fired), snoozed: numberRecord(record.snoozed) }
}

export function loadState(storage: StorageLike | null): ReminderState {
  if (!storage) return emptyState()
  try {
    const text = storage.getItem(STORAGE_KEY)
    return text ? parseState(JSON.parse(text)) : emptyState()
  } catch {
    return emptyState()
  }
}

/** 저장에 성공했는지 돌려준다. 실패해도 이번 실행 동안은 메모리 상태로 계속 동작한다. */
export function saveState(storage: StorageLike | null, state: ReminderState): boolean {
  if (!storage) return false
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export function firedKeys(state: ReminderState): Set<string> {
  return new Set(Object.keys(state.fired))
}

export function recordFired(state: ReminderState, due: readonly DueReminder[], now: number): ReminderState {
  const fired = { ...state.fired, ...Object.fromEntries(due.map((item) => [item.key, now])) }
  return { ...state, fired, lastCheck: now }
}

export function snoozeReminder(state: ReminderState, key: string, until: number): ReminderState {
  return { ...state, snoozed: { ...state.snoozed, [baseKey(key)]: until } }
}

export function pruneState(state: ReminderState, now: number): ReminderState {
  const cutoff = now - RETENTION_MS
  const keep = (record: Readonly<Record<string, number>>): Record<string, number> =>
    Object.fromEntries(Object.entries(record).filter(([, at]) => at >= cutoff))
  const fired = keep(state.fired)
  const snoozed = keep(state.snoozed)
  const unchanged =
    Object.keys(fired).length === Object.keys(state.fired).length &&
    Object.keys(snoozed).length === Object.keys(state.snoozed).length
  return unchanged ? state : { ...state, fired, snoozed }
}
