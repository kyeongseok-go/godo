import { useEffect } from 'react'
import type { Task, TimeOfDay } from '../../domain/types'
import { useApp } from '../../store/app'
import { notifyDue } from './browserNotify'
import { firedKeys } from './reminderState'
import { useReminderStore } from './reminderStore'
import type { ReminderStore } from './reminderStore'
import { dueReminders } from './schedule'
import type { DueReminder } from './schedule'

/** 앱이 열려 있는 동안 얼마나 자주 울릴 알림이 있는지 본다. */
export const CHECK_INTERVAL_MS = 30_000

export interface CheckInput {
  tasks: readonly Task[]
  workStart: TimeOfDay
  timeFormat: '12h' | '24h'
}

export interface CheckDeps {
  store: ReminderStore
  notify: (due: readonly DueReminder[]) => number
}

const defaultDeps: CheckDeps = { store: useReminderStore, notify: notifyDue }

/** 한 번 확인한다: 울릴 알림을 찾아 카드로 올리고 브라우저 알림을 보낸다. 울린 알림은 기록해 중복을 막는다. */
export function runReminderCheck(input: CheckInput, now: number, deps: CheckDeps = defaultDeps): DueReminder[] {
  // 다른 탭이 먼저 울린 알림을 놓치지 않도록 매번 저장된 상태를 다시 읽는다.
  deps.store.getState().refresh()
  const { state } = deps.store.getState()
  const due = dueReminders(input.tasks, {
    now,
    lastCheck: state.lastCheck,
    fired: firedKeys(state),
    snoozed: state.snoozed,
    workStart: input.workStart,
    timeFormat: input.timeFormat,
  })
  deps.store.getState().ingest(due, now)
  if (due.length > 0) deps.notify(due)
  return due
}

/** 저장소에서 지금 값을 읽어 확인 입력을 만든다. 테이블 참조가 같으면 배열을 다시 만들지 않는다. */
function makeInputReader(): () => CheckInput {
  let record: unknown
  let tasks: Task[] = []
  return () => {
    const { entities, settings } = useApp.getState()
    if (entities.tasks !== record) {
      record = entities.tasks
      tasks = Object.values(entities.tasks)
    }
    return { tasks, workStart: settings.workStart, timeFormat: settings.timeFormat }
  }
}

/**
 * 알림 엔진. Shell 에서 한 번만 호출한다.
 * 30초마다, 그리고 탭이 다시 보일 때(절전에서 깨어난 뒤 등) 확인한다.
 * 데이터를 다 읽기 전에 확인하면 "마지막 확인 시각"만 앞서 가서 놓친 알림이 사라지므로 ready 이후에만 돈다.
 * 작업·설정은 구독하지 않고 확인 시점에 저장소에서 읽는다. 작업이 바뀔 때마다 Shell 전체가 다시 그려지지 않게 하려는 것이다.
 */
export function useReminders(): void {
  const ready = useApp((s) => s.ready)

  useEffect(() => {
    if (!ready) return
    const readInput = makeInputReader()
    const check = (): void => {
      runReminderCheck(readInput(), Date.now())
    }
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') check()
    }
    check()
    const timer = setInterval(check, CHECK_INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [ready])
}
