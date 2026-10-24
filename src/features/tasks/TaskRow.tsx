import { ChevronRight, Pin } from 'lucide-react'
import { memo } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { useJustChanged } from '../../hooks/flash'
import { useLookups } from '../../hooks/lookups'
import type { Lookups } from '../../hooks/lookups'
import type { ISODate, Settings, Task } from '../../domain/types'
import type { TaskNode } from '../../domain/views'
import { countDescendants } from '../../domain/views'
import { Checkbox } from '../../ui/Checkbox'
import { TaskMeta } from './TaskMeta'
import './task-row.css'

export interface TaskRowProps {
  node: TaskNode
  today: ISODate
  settings: Settings
  /** 프로젝트 이름 칩을 보일지(프로젝트 밖 목록에서 켠다) */
  showProject: boolean
  collapsed: boolean
  selected: boolean
  focused: boolean
  onToggleDone: (task: Task, done: boolean) => void
  onOpen: (task: Task) => void
  onToggleCollapse: (task: Task) => void
  onToggleSelect: (task: Task) => void
  /** 방금 목록에 들어온 행인지. 참이면 한 번 올라오며 나타난다. */
  fresh?: boolean
  /** 드래그 핸들 등 호출 측이 끼워 넣는 요소 */
  handle?: ReactNode
  lookups?: Lookups
}

function TaskRowBase(props: TaskRowProps) {
  const { node, today, settings, showProject, collapsed, selected, focused } = props
  const { task } = node
  const own = useLookups()
  const lookups = props.lookups ?? own
  const hasChildren = node.children.length > 0
  const progress = hasChildren ? countDescendants(node) : undefined
  const done = task.status === 'done'
  const canceled = task.status === 'canceled'
  // 방금 상태가 바뀐 줄만 한 번 밝아졌다 가라앉는다. 어느 줄을 눌렀는지가 손가락을 떼도 남는다.
  const flash = useJustChanged(task.status)

  const labels = task.labelIds.flatMap((id) => {
    const l = lookups.labels.get(id)
    return l ? [l] : []
  })

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter') {
      e.preventDefault()
      props.onOpen(task)
    } else if (e.key === ' ') {
      e.preventDefault()
      props.onToggleSelect(task)
    }
  }

  return (
    <div
      className="task-row"
      tabIndex={0}
      data-task-id={task.id}
      data-done={done}
      data-fresh={props.fresh || undefined}
      data-flash={flash || undefined}
      data-canceled={canceled}
      data-selected={selected}
      data-focused={focused}
      data-depth={node.depth}
      style={{ ['--depth' as string]: node.depth }}
      onKeyDown={onKeyDown}
      onClick={() => props.onOpen(task)}
    >
      {props.handle}
      {hasChildren ? (
        <button
          type="button"
          className="task-row__chevron"
          data-visible
          data-open={!collapsed}
          aria-label={collapsed ? '하위 작업 펼치기' : '하위 작업 접기'}
          aria-expanded={!collapsed}
          onClick={(e) => {
            e.stopPropagation()
            props.onToggleCollapse(task)
          }}
        >
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      ) : (
        <span className="task-row__chevron" aria-hidden="true" />
      )}
      <Checkbox
        checked={done}
        canceled={canceled}
        priority={task.priority}
        label={done ? `"${task.title}" 완료 취소` : `"${task.title}" 완료`}
        onChange={(next) => props.onToggleDone(task, next)}
      />
      <div className="task-row__body">
        <div className="task-row__title">
          {task.pinned ? <Pin size={12} className="task-row__pin" aria-label="고정됨" /> : null}
          <span>{task.title}</span>
        </div>
        <TaskMeta
          task={task}
          today={today}
          settings={settings}
          project={showProject ? lookups.projects.get(task.projectId) : undefined}
          labels={labels}
          progress={progress}
        />
      </div>
    </div>
  )
}

export const TaskRow = memo(TaskRowBase)
