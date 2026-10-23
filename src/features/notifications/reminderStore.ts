// 앱 안 알림 카드와 알림 처리 상태를 한곳에 둔다. 훅(울리기)과 카드 UI(미루기·닫기)가 같은 상태를 본다.
import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'
import { loadState, pruneState, recordFired, saveState, snoozeReminder } from './reminderState'
import type { ReminderState, StorageLike } from './reminderState'
import type { DueReminder } from './schedule'

export interface ReminderStoreState {
  cards: readonly DueReminder[]
  state: ReminderState
  /** 다른 탭이 저장한 처리 상태를 다시 읽는다. */
  refresh: () => void
  /** 방금 울린 알림을 카드로 보여 주고 처리 완료로 기록한다. */
  ingest: (due: readonly DueReminder[], now: number) => void
  snooze: (key: string, until: number) => void
  dismiss: (key: string) => void
  dismissAll: () => void
}

export type ReminderStore = UseBoundStore<StoreApi<ReminderStoreState>>

/** 같은 작업·같은 알림은 카드 하나만 둔다(지속 알림이 10분마다 쌓이는 것을 막는다). */
const groupOf = (key: string): string => key.split('|').slice(0, 2).join('|')

export function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function createReminderStore(storage: StorageLike | null): ReminderStore {
  return create<ReminderStoreState>((set, get) => {
    const commit = (state: ReminderState): void => {
      saveState(storage, state)
      set({ state })
    }

    return {
      cards: [],
      state: loadState(storage),
      refresh: () => {
        if (storage) set({ state: loadState(storage) })
      },
      ingest: (due, now) => {
        commit(pruneState(recordFired(get().state, due, now), now))
        if (due.length === 0) return
        const replaced = new Set(due.map((item) => groupOf(item.key)))
        set((s) => ({ cards: [...s.cards.filter((card) => !replaced.has(groupOf(card.key))), ...due] }))
      },
      snooze: (key, until) => {
        commit(snoozeReminder(get().state, key, until))
        set((s) => ({ cards: s.cards.filter((card) => card.key !== key) }))
      },
      dismiss: (key) => set((s) => ({ cards: s.cards.filter((card) => card.key !== key) })),
      dismissAll: () => set({ cards: [] }),
    }
  })
}

export const useReminderStore = createReminderStore(browserStorage())
