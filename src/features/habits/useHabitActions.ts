import { useMemo } from 'react'
import type { ISODate } from '../../domain/types'
import { useToday } from '../../hooks/data'
import { useApp } from '../../store/app'
import { useToasts } from '../../ui/toast'
import { deleteHabit, setHabitArchived, stepHabitDay, toggleHabitDay, writeHabitDay } from './commands'

export interface HabitActions {
  toggle: (id: string, date: ISODate) => void
  step: (id: string, date: ISODate, delta: number) => void
  write: (id: string, date: ISODate, value: number) => void
  archive: (id: string, archived: boolean) => void
  remove: (id: string, name: string) => void
}

/** 습관 기록·보관·삭제를 스토어에 반영한다. 모든 쓰기는 commit 한 곳으로 가서 실행 취소가 된다. */
export function useHabitActions(): HabitActions {
  const commit = useApp((s) => s.commit)
  const today = useToday()
  return useMemo(() => {
    const entities = () => useApp.getState().entities
    return {
      toggle: (id, date) => commit(toggleHabitDay(entities(), id, date, today), '습관 기록'),
      step: (id, date, delta) => commit(stepHabitDay(entities(), id, date, delta, today), '습관 기록'),
      write: (id, date, value) => commit(writeHabitDay(entities(), id, date, value, today), '습관 기록'),
      archive: (id, archived) =>
        commit(setHabitArchived(entities(), id, archived), archived ? '습관 보관' : '습관 복원'),
      remove: (id, name) => {
        commit(deleteHabit(entities(), id), '습관 삭제')
        useToasts.getState().push(`'${name}' 습관을 지웠어요`, {
          actionLabel: '되돌리기',
          onAction: () => useApp.getState().undo(),
        })
      },
    }
  }, [commit, today])
}
