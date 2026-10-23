import { useMemo } from 'react'
import { todayOf } from '../domain/date'
import type { ID, ISODate, Task } from '../domain/types'
import { mergeChangeSets } from '../store/changes'
import { useApp } from '../store/app'
import {
  cancelTask,
  completeTask,
  createTask,
  deleteTasks,
  duplicateTask,
  emptyTrash,
  indentTask,
  outdentTask,
  moveTask,
  patchTask,
  patchTasks,
  postponeTask,
  purgeTasks,
  reopenTask,
  restoreTask,
  skipRecurrence,
} from '../store/commands/taskCommands'
import type { MoveTarget } from '../store/commands/taskCommands'
import type { NewTaskInput } from '../store/commands/taskFactory'
import { useUI } from '../store/ui'
import { useToasts } from '../ui/toast'

/** 화면에서 쓰는 할 일 조작 모음. 매 호출마다 최신 상태를 읽고, 실행 취소 토스트를 띄운다. */
export function useTaskActions() {
  return useMemo(() => {
    const state = () => useApp.getState()
    const now = () => Date.now()
    const today = (): ISODate => todayOf(new Date(), state().settings.dayStartHour)
    const toast = useToasts.getState().push
    const undoToast = (message: string) =>
      toast(message, { actionLabel: '되돌리기', onAction: () => state().undo() })

    return {
      add(input: NewTaskInput): Task {
        const { changes, task } = createTask(state().entities, input, now())
        state().commit(changes, '할 일 추가')
        return task
      },
      patch(id: ID, patch: Partial<Task>, label = '할 일 수정'): void {
        state().commit(patchTask(state().entities, id, patch, now()), label)
      },
      patchMany(ids: readonly ID[], patch: Partial<Task>, label = '일괄 수정'): void {
        state().commit(patchTasks(state().entities, ids, patch, now()), label)
      },
      complete(id: ID): void {
        const task = state().entities.tasks[id]
        if (task && !task.recurrence) useUI.getState().markLingering(id)
        state().commit(completeTask(state().entities, id, today(), now()), '할 일 완료')
        if (task) undoToast(task.recurrence ? '다음 회차로 넘겼어요' : '완료했어요')
      },
      /** 여러 개를 한 번에 완료한다. 실행 취소 한 번, 알림 한 번으로 끝난다. */
      completeMany(ids: readonly ID[]): void {
        const completedOn = today()
        const sets = ids.map((id) => completeTask(state().entities, id, completedOn, now()))
        state().commit(mergeChangeSets(...sets), `${ids.length}개 완료`)
        undoToast(`${ids.length}개를 완료했어요`)
      },
      reopen(id: ID): void {
        state().commit(reopenTask(state().entities, id, now()), '다시 열기')
      },
      cancel(id: ID): void {
        state().commit(cancelTask(state().entities, id, now()), '계획 취소')
        undoToast('계획을 취소했어요')
      },
      skip(id: ID): void {
        state().commit(skipRecurrence(state().entities, id, now()), '이번 회차 건너뛰기')
        undoToast('이번 회차를 건너뛰었어요')
      },
      remove(ids: readonly ID[]): void {
        state().commit(deleteTasks(state().entities, ids, now()), '할 일 삭제')
        undoToast(ids.length > 1 ? `${ids.length}개를 휴지통으로 옮겼어요` : '휴지통으로 옮겼어요')
      },
      restore(id: ID): void {
        state().commit(restoreTask(state().entities, id, now()), '복원')
      },
      purge(ids: readonly ID[]): void {
        state().commit(purgeTasks(state().entities, ids), '영구 삭제')
      },
      emptyTrash(): void {
        state().commit(emptyTrash(state().entities), '휴지통 비우기')
      },
      duplicate(id: ID): ID | null {
        const { changes, newId } = duplicateTask(state().entities, id, now())
        state().commit(changes, '복제')
        return newId
      },
      move(id: ID, target: MoveTarget): void {
        state().commit(moveTask(state().entities, id, target, now()), '이동')
      },
      indent(id: ID): void {
        state().commit(indentTask(state().entities, id, now()), '들여쓰기')
      },
      outdent(id: ID): void {
        state().commit(outdentTask(state().entities, id, now()), '내어쓰기')
      },
      postpone(id: ID, toDate: ISODate): void {
        state().commit(postponeTask(state().entities, id, toDate, now()), '미루기')
      },
    }
  }, [])
}

export type TaskActions = ReturnType<typeof useTaskActions>
