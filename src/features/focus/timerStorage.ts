import { z } from 'zod'
import type { TimerState } from './timer'

export const TIMER_STORAGE_KEY = 'godo.focus.timer.v1'

/** localStorage 의 일부. 접근이 막힌 환경에서는 null 로 두고 메모리만 쓴다. */
export type TimerStorage = Pick<Storage, 'getItem' | 'setItem'>

const kindSchema = z.enum(['focus', 'shortBreak', 'longBreak', 'stopwatch'])
const epoch = z.number().nonnegative().nullable()

const timerSchema = z.object({
  phase: z.enum(['idle', 'running', 'paused', 'finished']),
  kind: kindSchema,
  taskId: z.string().nullable(),
  startedAt: epoch,
  runningSince: epoch,
  accumulatedMs: z.number().nonnegative(),
  targetMs: z.number().nonnegative().nullable(),
  focusDone: z.number().int().nonnegative(),
  next: kindSchema.nullable(),
})

/** 저장된 값은 믿지 않는다. 모양이 맞고 단계별 필수 값이 있을 때만 상태로 인정한다. */
export function parseTimerState(raw: unknown): TimerState | null {
  const parsed = timerSchema.safeParse(raw)
  if (!parsed.success) return null
  const s = parsed.data
  if (s.phase === 'running' && (s.runningSince === null || s.startedAt === null)) return null
  if (s.phase === 'paused' && s.startedAt === null) return null
  if (s.phase === 'finished' && s.next === null) return null
  return s
}

export function readTimer(storage: TimerStorage | null): TimerState | null {
  if (!storage) return null
  try {
    const text = storage.getItem(TIMER_STORAGE_KEY)
    return text === null ? null : parseTimerState(JSON.parse(text) as unknown)
  } catch {
    // 저장소가 막혔거나 값이 깨졌다. 새 타이머로 시작하는 것이 안전한 복구다.
    return null
  }
}

/** 저장에 성공했는지 돌려준다. 실패해도 타이머는 메모리에서 계속 돈다. */
export function writeTimer(storage: TimerStorage | null, state: TimerState): boolean {
  if (!storage) return false
  try {
    storage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}
