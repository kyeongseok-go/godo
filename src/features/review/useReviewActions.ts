import { useCallback, useState } from 'react'
import { todayOf } from '../../domain/date'
import type { EpochMs, ID } from '../../domain/types'
import { useApp } from '../../store/app'
import { isEmptyChangeSet } from '../../store/changes'
import { useToasts } from '../../ui/toast'
import { REVIEW_ACTIONS, reviewChangeSet, reviewDoneMessage } from './actions'
import type { ReviewActionKind } from './actions'

const STALE_UNDO_MESSAGE = '그 뒤에 한 작업이 있어요. 가장 최근 것부터 되돌려 주세요. (실행 취소 단축키)'

/**
 * 리뷰 항목 하나를 처리한다: 변경 집합을 만들어 한 번에 커밋(실행 취소 가능)하고,
 * 처리 직후의 수정 시각을 기억해 목록에서 숨기며, 되돌리기 토스트를 띄운다.
 */
export function useReviewActions(): {
  apply: (taskId: ID, kind: ReviewActionKind) => void
  handled: Readonly<Record<ID, EpochMs>>
} {
  const [handled, setHandled] = useState<Readonly<Record<ID, EpochMs>>>({})

  const apply = useCallback((taskId: ID, kind: ReviewActionKind) => {
    const before = useApp.getState()
    const task = before.entities.tasks[taskId]
    if (!task) return
    const nowMs = Date.now()
    const changes = reviewChangeSet(before.entities, taskId, kind, {
      today: todayOf(new Date(nowMs), before.settings.dayStartHour),
      weekStartsOn: before.settings.weekStartsOn,
      nowMs,
    })
    if (isEmptyChangeSet(changes)) return

    const label = REVIEW_ACTIONS.find((action) => action.kind === kind)?.label ?? '처리'
    before.commit(changes, `리뷰: ${label}`)
    const after = useApp.getState()
    setHandled((prev) => ({ ...prev, [taskId]: after.entities.tasks[taskId]?.updatedAt ?? nowMs }))

    const depth = after.undoStack.length
    useToasts.getState().push(reviewDoneMessage(kind, task.title), {
      actionLabel: '되돌리기',
      onAction: () => {
        const current = useApp.getState()
        if (current.undoStack.length !== depth) {
          useToasts.getState().push(STALE_UNDO_MESSAGE)
          return
        }
        current.undo()
      },
    })
  }, [])

  return { apply, handled }
}
