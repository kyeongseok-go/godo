// 전역 집중 타이머 스토어. 페이지를 떠나도 타이머가 이어지고, 새로고침해도 복원된다.
// 여기서는 시간을 세지 않는다. 상태(타임스탬프)만 들고 있고, 화면 갱신용 틱은 컴포넌트가 돌린다.
import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'
import { applyFocusToTask } from '../../domain/stats'
import type { FocusSession, ID } from '../../domain/types'
import { useApp } from '../../store/app'
import type { AppStore } from '../../store/store'
import { newId } from '../../store/id'
import { alertTextFor, announceSessionEnd, primeAudio } from './alerts'
import type { SessionAlert } from './alerts'
import {
  createTimer,
  pauseTimer,
  resumeTimer,
  setMode as setTimerMode,
  setTask as setTimerTask,
  skipTimer,
  startTimer,
  stopTimer,
  tickTimer,
} from './timer'
import type { EndedSession, PomodoroConfig, TimerMode, TimerOutcome, TimerRecord, TimerState } from './timer'
import { TIMER_STORAGE_KEY, parseTimerState, readTimer, writeTimer } from './timerStorage'
import type { TimerStorage } from './timerStorage'

export interface FocusState {
  timer: TimerState
  start: () => void
  pause: () => void
  resume: () => void
  skip: () => void
  stop: () => void
  setMode: (mode: TimerMode) => void
  setTask: (taskId: ID | null) => void
  /** 화면 틱마다 호출한다. 시간이 다 찼는지 타임스탬프로 판정한다. */
  tick: (now?: number) => void
}

export type FocusStore = UseBoundStore<StoreApi<FocusState>>

export interface FocusDeps {
  app: AppStore
  storage: TimerStorage | null
  now: () => number
  newId: () => string
  announce: (alert: SessionAlert, soundOn: boolean) => void
  /** 사용자 제스처 안에서 오디오를 깨워 둔다 */
  prime: () => void
}

function persistedSession(record: TimerRecord, id: string, taskId: ID | null): FocusSession {
  return { id, taskId, kind: record.kind, startedAt: record.startedAt, durationSec: record.durationSec, completed: record.completed }
}

export function createFocusStore(deps: FocusDeps): FocusStore {
  const config = (): PomodoroConfig => deps.app.getState().settings.pomodoro

  /** 세션 하나와 연결된 할 일의 실제 시간을 한 번의 ChangeSet 으로 저장한다. */
  const saveRecord = (record: TimerRecord): void => {
    const app = deps.app.getState()
    // 연결했던 할 일이 지워졌다면 끊어진 참조를 남기지 않는다.
    const task = record.taskId ? app.entities.tasks[record.taskId] : undefined
    const session = persistedSession(record, deps.newId(), task?.id ?? null)
    // 끝까지 채운 세션만 할 일의 실제 시간에 더한다(통계의 완료 기준과 같다).
    const updated = task && session.completed ? applyFocusToTask(task, session) : task
    const taskPut = task && updated && updated !== task ? { tasks: [{ ...updated, updatedAt: deps.now() }] } : {}
    // 자동으로 일어나는 기록이라 실행 취소 목록에는 넣지 않는다. 사용자의 다른 실행 취소를 가로채면 안 된다.
    app.commit({ puts: { focusSessions: [session], ...taskPut }, deletes: {} }, '집중 기록', { history: false })
  }

  const store = create<FocusState>((set, get) => {
    const announceEnd = (state: TimerState, ended: EndedSession): void => {
      if (ended.reason !== 'elapsed') return
      const app = deps.app.getState()
      const title = state.taskId ? (app.entities.tasks[state.taskId]?.title ?? null) : null
      deps.announce(alertTextFor(ended, state.next, title), app.settings.pomodoro.sound)
    }

    const apply = (outcome: TimerOutcome): void => {
      if (outcome.state !== get().timer) set({ timer: outcome.state })
      if (!outcome.ended) return
      if (outcome.ended.record) saveRecord(outcome.ended.record)
      announceEnd(outcome.state, outcome.ended)
    }
    const change = (next: TimerState): void => {
      if (next !== get().timer) set({ timer: next })
    }

    return {
      timer: readTimer(deps.storage) ?? createTimer(),
      start: () => {
        deps.prime()
        change(startTimer(get().timer, deps.now(), config()))
      },
      pause: () => change(pauseTimer(get().timer, deps.now())),
      resume: () => change(resumeTimer(get().timer, deps.now())),
      skip: () => apply(skipTimer(get().timer, deps.now(), config())),
      stop: () => apply(stopTimer(get().timer, deps.now())),
      setMode: (mode) => change(setTimerMode(get().timer, mode)),
      setTask: (taskId) => change(setTimerTask(get().timer, taskId)),
      tick: (now = deps.now()) => apply(tickTimer(get().timer, now, config())),
    }
  })

  // 저장은 타이머가 바뀔 때만 한다. 실패해도(용량·차단) 타이머는 메모리에서 계속 돈다.
  store.subscribe((state, prev) => {
    if (state.timer !== prev.timer) writeTimer(deps.storage, state.timer)
  })
  return store
}

/** 다른 탭에서 바뀐 타이머를 받아들인다. 같은 타이머가 두 탭에서 따로 끝나 기록이 겹치는 것을 줄인다. */
export function syncAcrossTabs(store: FocusStore, target: Window): () => void {
  const onStorage = (event: StorageEvent): void => {
    if (event.key !== TIMER_STORAGE_KEY || event.newValue === null) return
    try {
      const incoming = parseTimerState(JSON.parse(event.newValue) as unknown)
      if (incoming) store.setState({ timer: incoming })
    } catch {
      // 깨진 값은 무시한다. 이 탭의 상태가 다음 변경 때 다시 저장되어 바로잡힌다.
    }
  }
  target.addEventListener('storage', onStorage)
  return () => target.removeEventListener('storage', onStorage)
}

function browserStorage(): TimerStorage | null {
  try {
    return window.localStorage
  } catch {
    // 개인정보 보호 모드나 쿠키 차단에서는 접근만으로 예외가 난다. 이때는 메모리에서만 돈다.
    return null
  }
}

function createDefaultStore(): FocusStore {
  const storage = browserStorage()
  const store = createFocusStore({
    app: useApp,
    storage,
    now: Date.now,
    newId,
    announce: announceSessionEnd,
    prime: primeAudio,
  })
  syncAcrossTabs(store, window)
  return store
}

export const useFocus = createDefaultStore()
