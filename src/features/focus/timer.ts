// 집중 타이머 엔진. 순수 함수만 둔다.
// 시간은 setInterval 로 세지 않고 "시작 시각 + 누적 시간"의 차이로만 계산한다.
// 탭이 백그라운드에서 느려지거나 노트북이 잠들어도 남은 시간이 틀어지지 않게 하려는 것이다.
import type { ID, Settings } from '../../domain/types'

export type SessionKind = 'focus' | 'shortBreak' | 'longBreak' | 'stopwatch'
export type TimerPhase = 'idle' | 'running' | 'paused' | 'finished'
export type TimerMode = 'pomodoro' | 'stopwatch'
export type PomodoroConfig = Settings['pomodoro']

export const KIND_LABEL: Readonly<Record<SessionKind, string>> = {
  focus: '집중',
  shortBreak: '짧은 휴식',
  longBreak: '긴 휴식',
  stopwatch: '스톱워치',
}

const MS_PER_MIN = 60_000
const MS_PER_SEC = 1_000
/** 중단·건너뛰기로 끝난 세션은 이보다 짧으면 기록하지 않는다. 통계가 분 단위로 반올림하므로 30초가 1분의 경계다. */
const MIN_RECORD_SEC = 30
/** 자동 시작할 때 이 시간 안쪽으로 늦은 틱이면 끝난 시각에서 이어 시작해 시간이 새지 않게 한다. */
const AUTO_START_GRACE_MS = 60_000

export interface TimerState {
  phase: TimerPhase
  /** 진행 중이거나 마지막으로 끝난 세션 종류. idle 일 때는 사용자가 고른 모드(focus|stopwatch). */
  kind: SessionKind
  taskId: ID | null
  /** 현재 세션이 처음 시작된 시각(epoch ms) */
  startedAt: number | null
  /** 마지막으로 running 이 된 시각. running 이 아니면 null */
  runningSince: number | null
  /** runningSince 이전까지 쌓인 진행 시간 */
  accumulatedMs: number
  /** 목표 길이. 스톱워치는 null */
  targetMs: number | null
  /** 지금까지 끝까지 마친 집중 횟수. 긴 휴식 간격 계산에 쓴다. */
  focusDone: number
  /** finished 일 때 다음에 시작할 세션 */
  next: SessionKind | null
}

/** 저장할 FocusSession 의 id 를 뺀 내용 */
export interface TimerRecord {
  kind: 'pomodoro' | 'stopwatch'
  taskId: ID | null
  startedAt: number
  durationSec: number
  completed: boolean
}

export type EndReason = 'elapsed' | 'skipped' | 'stopped'

export interface EndedSession {
  kind: SessionKind
  reason: EndReason
  endedAt: number
  /** 집중·스톱워치만 기록한다. 휴식이거나 너무 짧으면 null */
  record: TimerRecord | null
}

export interface TimerOutcome {
  state: TimerState
  ended: EndedSession | null
}

export function createTimer(): TimerState {
  return {
    phase: 'idle',
    kind: 'focus',
    taskId: null,
    startedAt: null,
    runningSince: null,
    accumulatedMs: 0,
    targetMs: null,
    focusDone: 0,
    next: null,
  }
}

export function modeOf(state: TimerState): TimerMode {
  return state.kind === 'stopwatch' ? 'stopwatch' : 'pomodoro'
}

function wholeMinutes(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.round(value)) : 1
}

/** 세션 종류별 목표 길이. 스톱워치는 null. 설정값이 이상해도 최소 1분. */
export function durationMs(kind: SessionKind, cfg: PomodoroConfig): number | null {
  switch (kind) {
    case 'focus':
      return wholeMinutes(cfg.focusMin) * MS_PER_MIN
    case 'shortBreak':
      return wholeMinutes(cfg.shortBreakMin) * MS_PER_MIN
    case 'longBreak':
      return wholeMinutes(cfg.longBreakMin) * MS_PER_MIN
    case 'stopwatch':
      return null
  }
}

function rawElapsedMs(state: TimerState, now: number): number {
  if (state.phase !== 'running' || state.runningSince === null) return state.accumulatedMs
  return state.accumulatedMs + Math.max(0, now - state.runningSince)
}

/** 지금까지 진행한 시간. 목표가 있으면 목표를 넘기지 않는다(틱이 늦어도 화면이 음수가 되지 않게). */
export function elapsedMs(state: TimerState, now: number): number {
  const raw = rawElapsedMs(state, now)
  return state.targetMs === null ? raw : Math.min(raw, state.targetMs)
}

export function isDue(state: TimerState, now: number): boolean {
  return state.phase === 'running' && state.targetMs !== null && rawElapsedMs(state, now) >= state.targetMs
}

/** 화면에 크게 보일 시간: 스톱워치는 경과, 그 외는 남은 시간. 대기 중에는 시작하면 주어질 길이. */
export function displayMs(state: TimerState, now: number, cfg: PomodoroConfig): number {
  if (state.kind === 'stopwatch') return elapsedMs(state, now)
  if (state.phase === 'idle') return durationMs(state.kind, cfg) ?? 0
  if (state.phase === 'finished') return state.next ? (durationMs(state.next, cfg) ?? 0) : 0
  return Math.max(0, (state.targetMs ?? 0) - elapsedMs(state, now))
}

/** 진행 링에 쓰는 0~1. 목표가 없거나 아직 시작 전이면 0. */
export function progressOf(state: TimerState, now: number, cfg: PomodoroConfig): number {
  if (state.targetMs === null || (state.phase !== 'running' && state.phase !== 'paused')) return 0
  const total = state.targetMs > 0 ? state.targetMs : (durationMs(state.kind, cfg) ?? 1)
  return Math.min(1, Math.max(0, elapsedMs(state, now) / total))
}

export function nextHint(state: TimerState): string {
  return state.phase === 'finished' && state.next ? `다음: ${KIND_LABEL[state.next]}` : ''
}

function begin(state: TimerState, kind: SessionKind, at: number, cfg: PomodoroConfig): TimerState {
  return {
    ...state,
    phase: 'running',
    kind,
    startedAt: at,
    runningSince: at,
    accumulatedMs: 0,
    targetMs: durationMs(kind, cfg),
    next: null,
  }
}

function idleOf(state: TimerState, kind: SessionKind, focusDone: number): TimerState {
  return { ...createTimer(), kind, taskId: state.taskId, focusDone }
}

export function startTimer(state: TimerState, now: number, cfg: PomodoroConfig): TimerState {
  if (state.phase === 'idle') return begin(state, state.kind, now, cfg)
  if (state.phase === 'finished' && state.next) return begin(state, state.next, now, cfg)
  return state
}

export function pauseTimer(state: TimerState, now: number): TimerState {
  // 이미 목표를 넘겼으면 멈추지 않는다. 다음 틱이 완료 처리를 해야 기록이 사라지지 않는다.
  if (state.phase !== 'running' || isDue(state, now)) return state
  return { ...state, phase: 'paused', accumulatedMs: elapsedMs(state, now), runningSince: null }
}

export function resumeTimer(state: TimerState, now: number): TimerState {
  if (state.phase !== 'paused') return state
  return { ...state, phase: 'running', runningSince: now }
}

/** 대기·끝남 상태에서만 모드를 바꿀 수 있다. 진행 중에 바꾸면 기록이 어느 쪽인지 모호해진다. */
export function setMode(state: TimerState, mode: TimerMode): TimerState {
  if (state.phase !== 'idle' && state.phase !== 'finished') return state
  return idleOf(state, mode === 'stopwatch' ? 'stopwatch' : 'focus', state.focusDone)
}

export function setTask(state: TimerState, taskId: ID | null): TimerState {
  return state.taskId === taskId ? state : { ...state, taskId }
}

function toRecord(state: TimerState, elapsed: number, reason: EndReason): TimerRecord | null {
  if (state.kind !== 'focus' && state.kind !== 'stopwatch') return null
  if (state.startedAt === null) return null
  const durationSec = Math.round(elapsed / MS_PER_SEC)
  if (reason !== 'elapsed' && durationSec < MIN_RECORD_SEC) return null
  return {
    kind: state.kind === 'focus' ? 'pomodoro' : 'stopwatch',
    taskId: state.taskId,
    startedAt: state.startedAt,
    durationSec,
    // 스톱워치는 사용자가 멈추는 것이 곧 정상 종료다. 포모도로는 끝까지 채워야 완료다.
    completed: reason === 'elapsed' || state.kind === 'stopwatch',
  }
}

function dueAt(state: TimerState): number {
  return (state.runningSince ?? 0) + Math.max(0, (state.targetMs ?? 0) - state.accumulatedMs)
}

function endSession(state: TimerState, now: number, reason: EndReason): EndedSession {
  const elapsed = reason === 'elapsed' ? (state.targetMs ?? 0) : elapsedMs(state, now)
  return {
    kind: state.kind,
    reason,
    endedAt: reason === 'elapsed' ? dueAt(state) : now,
    record: toRecord(state, elapsed, reason),
  }
}

/** 세션이 끝난 뒤 다음 세션으로 넘어간다. 자동 시작이면 바로 시작하고, 아니면 finished 로 안내한다. */
function advance(
  state: TimerState,
  next: SessionKind,
  focusDone: number,
  at: number,
  cfg: PomodoroConfig,
): TimerState {
  const settled: TimerState = {
    ...state,
    focusDone,
    startedAt: null,
    runningSince: null,
    accumulatedMs: 0,
    targetMs: null,
  }
  if (cfg.autoStart) return begin(settled, next, at, cfg)
  return { ...settled, phase: 'finished', next }
}

function afterFocusDone(focusDone: number, cfg: PomodoroConfig): SessionKind {
  const every = Math.max(1, Math.round(Number.isFinite(cfg.longBreakEvery) ? cfg.longBreakEvery : 1))
  return focusDone % every === 0 ? 'longBreak' : 'shortBreak'
}

/** 시간이 다 찼을 때의 다음 단계. 집중이면 횟수를 올리고, 휴식이면 집중으로 돌아간다. */
function nextAfterElapsed(state: TimerState, cfg: PomodoroConfig): { next: SessionKind; focusDone: number } {
  if (state.kind !== 'focus') return { next: 'focus', focusDone: state.focusDone }
  const focusDone = state.focusDone + 1
  return { next: afterFocusDone(focusDone, cfg), focusDone }
}

function finishDue(state: TimerState, now: number, cfg: PomodoroConfig): TimerOutcome {
  const ended = endSession(state, now, 'elapsed')
  const { next, focusDone } = nextAfterElapsed(state, cfg)
  const at = now - ended.endedAt <= AUTO_START_GRACE_MS ? ended.endedAt : now
  return { state: advance(state, next, focusDone, at, cfg), ended }
}

/** 틱마다 호출한다. 시간이 다 찼으면 세션을 끝내고, 아니면 같은 상태를 그대로 돌려준다. */
export function tickTimer(state: TimerState, now: number, cfg: PomodoroConfig): TimerOutcome {
  if (!isDue(state, now)) return { state, ended: null }
  return finishDue(state, now, cfg)
}

function stopInto(state: TimerState, ended: EndedSession | null): TimerOutcome {
  const kind = state.kind === 'stopwatch' ? 'stopwatch' : 'focus'
  return { state: idleOf(state, kind, 0), ended }
}

/** 중단: 진행 중인 세션을 끝내고 처음(대기)으로 돌아간다. 집중 사이클도 처음부터 다시 센다. */
export function stopTimer(state: TimerState, now: number): TimerOutcome {
  if (state.phase === 'idle') return { state, ended: null }
  if (state.phase === 'finished') return stopInto(state, null)
  const reason: EndReason = isDue(state, now) ? 'elapsed' : 'stopped'
  return stopInto(state, endSession(state, now, reason))
}

/**
 * 건너뛰기: 지금 세션을 끝내고 다음으로 넘어간다.
 * 끝까지 못 채운 집중은 기록만 남기고(미완료) 횟수에는 넣지 않는다. 스톱워치는 중단과 같다.
 */
export function skipTimer(state: TimerState, now: number, cfg: PomodoroConfig): TimerOutcome {
  if (state.phase === 'idle') return { state, ended: null }
  if (state.phase === 'finished') return skipOffered(state, now, cfg)
  if (state.kind === 'stopwatch') return stopTimer(state, now)
  if (isDue(state, now)) return finishDue(state, now, cfg)

  const ended = endSession(state, now, 'skipped')
  const next: SessionKind = state.kind === 'focus' ? 'shortBreak' : 'focus'
  return { state: advance(state, next, state.focusDone, now, cfg), ended }
}

/** 안내 중인 휴식을 건너뛰고 집중으로 넘어간다. 안내 중인 것이 이미 집중이면 할 일이 없다. */
function skipOffered(state: TimerState, now: number, cfg: PomodoroConfig): TimerOutcome {
  if (state.next === null || state.next === 'focus') return { state, ended: null }
  return { state: advance({ ...state, kind: state.next }, 'focus', state.focusDone, now, cfg), ended: null }
}
