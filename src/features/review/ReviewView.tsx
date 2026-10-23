import { useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { reviewCandidates } from '../../domain/planning'
import type { ReviewOptions } from '../../domain/planning'
import type { ID, Task } from '../../domain/types'
import { useTaskActions } from '../../hooks/actions'
import { useEngineContext, useSettings } from '../../hooks/data'
import { useLookups } from '../../hooks/lookups'
import { useOpenTask } from '../../hooks/openTask'
import { useApp } from '../../store/app'
import { countHandled, groupByReason, visibleItems } from './actions'
import type { ReviewActionKind } from './actions'
import { parseReviewParams, writeReviewParams } from './params'
import { ReviewCriteria } from './ReviewCriteria'
import { ReviewDone } from './ReviewDone'
import { ReviewGroupSection } from './ReviewGroupSection'
import { useReviewActions } from './useReviewActions'
import { useReviewFocus } from './useReviewFocus'
import './review.css'

export function ReviewView() {
  const [search, setSearch] = useSearchParams()
  const ctx = useEngineContext()
  const settings = useSettings()
  const lookups = useLookups()
  const taskActions = useTaskActions()
  const { open } = useOpenTask()
  const { apply, handled } = useReviewActions()
  const containerRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef<HTMLDivElement>(null)

  const options = useMemo(() => parseReviewParams(search), [search])
  const items = useMemo(() => visibleItems(reviewCandidates(ctx, options), handled), [ctx, options, handled])
  const groups = useMemo(() => groupByReason(items), [items])
  const order = useMemo(() => groups.flatMap((group) => group.items.map((item) => item.task.id)), [groups])
  const tasksById = useApp((s) => s.entities.tasks)
  const handledCount = countHandled(handled, tasksById)
  const rememberFocus = useReviewFocus(order, handledCount, containerRef, doneRef)

  const setOptions = useCallback(
    (next: ReviewOptions) => setSearch(writeReviewParams(next, search), { replace: true }),
    [search, setSearch],
  )
  const onAction = useCallback(
    (taskId: ID, kind: ReviewActionKind) => {
      rememberFocus(taskId)
      apply(taskId, kind)
    },
    [apply, rememberFocus],
  )
  const onToggleDone = useCallback(
    (task: Task, done: boolean) => (done ? taskActions.complete(task.id) : taskActions.reopen(task.id)),
    [taskActions],
  )

  return (
    <div className="rv" ref={containerRef}>
      <ReviewCriteria value={options} onChange={setOptions} />
      {groups.length === 0 ? (
        <ReviewDone ref={doneRef} handledCount={handledCount} />
      ) : (
        groups.map((group) => (
          <ReviewGroupSection
            key={group.reason}
            group={group}
            today={ctx.today}
            settings={settings}
            lookups={lookups}
            onAction={onAction}
            onOpen={(task) => open(task.id)}
            onToggleDone={onToggleDone}
          />
        ))
      )}
    </div>
  )
}
