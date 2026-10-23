import { Ban, Check, CalendarArrowDown, Cloud, Sun, Trash2 } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import type { ISODate, Settings, Task } from '../../domain/types'
import type { ReviewItem } from '../../domain/planning'
import type { Lookups } from '../../hooks/lookups'
import { TaskRow } from '../tasks/TaskRow'
import { REVIEW_ACTIONS, reviewActionForKey } from './actions'
import type { ReviewActionKind } from './actions'

const ICONS: Record<ReviewActionKind, typeof Check> = {
  keep: Check,
  today: Sun,
  nextWeek: CalendarArrowDown,
  someday: Cloud,
  cancel: Ban,
  delete: Trash2,
}

interface ReviewItemRowProps {
  item: ReviewItem
  today: ISODate
  settings: Settings
  lookups: Lookups
  onAction: (taskId: string, kind: ReviewActionKind) => void
  onOpen: (task: Task) => void
  onToggleDone: (task: Task, done: boolean) => void
}

const noop = (): void => undefined

function ActionButtons({ task, onAction }: { task: Task; onAction: ReviewItemRowProps['onAction'] }) {
  return (
    <div className="rv-item__actions" role="group" aria-label={`"${task.title}" 처리`}>
      {REVIEW_ACTIONS.map((action) => {
        const Icon = ICONS[action.kind]
        return (
          <button
            key={action.kind}
            type="button"
            className="rv-act"
            data-kind={action.kind}
            aria-label={`${action.label}: ${task.title}`}
            aria-keyshortcuts={action.key ?? undefined}
            onClick={() => onAction(task.id, action.kind)}
          >
            <Icon size={15} aria-hidden="true" />
            <span>{action.label}</span>
            {action.key ? <kbd aria-hidden="true">{action.key.toUpperCase()}</kbd> : null}
          </button>
        )
      })}
    </div>
  )
}

/** 항목 하나: 기존 TaskRow + 사유 + 한 번에 처리하는 버튼들. 단축키는 이 항목 안에서만 동작한다. */
export function ReviewItemRow({ item, today, settings, lookups, onAction, onOpen, onToggleDone }: ReviewItemRowProps) {
  const { task } = item
  const project = lookups.projects.get(task.projectId)

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('input, textarea, select, [contenteditable="true"]')) return
    const kind = reviewActionForKey(event)
    if (kind === null) return
    // 앱 전역 단축키(k: 이전 할 일, x: 선택 등)와 겹치므로 여기서 멈춘다.
    event.preventDefault()
    event.stopPropagation()
    onAction(task.id, kind)
  }

  return (
    <article className="rv-item" aria-label={task.title} onKeyDown={onKeyDown}>
      <div role="list" className="rv-item__row">
        <TaskRow
          node={{ task, children: [], depth: 0 }}
          today={today}
          settings={settings}
          lookups={lookups}
          showProject={false}
          collapsed={false}
          selected={false}
          focused={false}
          onToggleDone={onToggleDone}
          onOpen={onOpen}
          onToggleCollapse={noop}
          onToggleSelect={noop}
        />
      </div>
      <p className="rv-item__detail">
        <span>{item.detail}</span>
        {project ? (
          <span className="rv-item__project">
            <i className="dot" style={{ background: project.color }} aria-hidden="true" />
            {project.name}
          </span>
        ) : null}
      </p>
      <ActionButtons task={task} onAction={onAction} />
    </article>
  )
}
