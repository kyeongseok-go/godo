import { useCallback, useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { ID } from '../../domain/types'

/**
 * 처리한 항목이 사라지면 키보드 흐름이 끊기지 않도록 이웃 항목으로 포커스를 옮긴다.
 * 이웃이 없고 모두 처리했다면 완료 문구로 옮긴다(스크린 리더가 읽어 준다).
 */
export function useReviewFocus(
  order: readonly ID[],
  handledCount: number,
  container: RefObject<HTMLElement | null>,
  done: RefObject<HTMLElement | null>,
): (taskId: ID) => void {
  const pending = useRef<ID | null>(null)

  const remember = useCallback(
    (taskId: ID) => {
      const index = order.indexOf(taskId)
      pending.current = order[index + 1] ?? order[index - 1] ?? null
    },
    [order],
  )

  useEffect(() => {
    if (pending.current === null) {
      if (order.length === 0 && handledCount > 0) done.current?.focus()
      return
    }
    const row = container.current?.querySelector<HTMLElement>(`[data-task-id="${CSS.escape(pending.current)}"]`)
    row?.focus()
    pending.current = null
  }, [order, handledCount, container, done])

  return remember
}
