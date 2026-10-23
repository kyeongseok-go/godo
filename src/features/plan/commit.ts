import { useApp } from '../../store/app'
import { isEmptyChangeSet } from '../../store/changes'
import type { ChangeSet } from '../../store/changes'
import { useToasts } from '../../ui/toast'

/** 변경을 commit 하고, 되돌릴 수 있는 토스트를 띄운다. 빈 변경이면 아무것도 하지 않는다. */
export function commitWithUndo(cs: ChangeSet, label: string, message: string): void {
  if (isEmptyChangeSet(cs)) return
  useApp.getState().commit(cs, label)
  useToasts.getState().push(message, {
    actionLabel: '되돌리기',
    onAction: () => {
      useApp.getState().undo()
    },
  })
}

/** 토스트 없이 commit 한다(체크 토글처럼 화면에 바로 보이는 변경) */
export function commitQuiet(cs: ChangeSet, label: string): void {
  useApp.getState().commit(cs, label)
}
