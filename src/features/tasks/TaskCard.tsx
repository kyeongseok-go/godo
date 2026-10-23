import { memo } from 'react'
import { useLookups } from '../../hooks/lookups'
import { useSettings, useToday } from '../../hooks/data'
import { useTaskActions } from '../../hooks/actions'
import { useOpenTask } from '../../hooks/openTask'
import type { Task } from '../../domain/types'
import { Checkbox } from '../../ui/Checkbox'
import { TaskMeta } from './TaskMeta'
import './task-card.css'

interface TaskCardProps {
  task: Task
  showProject?: boolean
  dragging?: boolean
}

/** 칸반·매트릭스·캘린더 안에서 쓰는 작은 카드 */
function TaskCardBase({ task, showProject = false, dragging = false }: TaskCardProps) {
  const lookups = useLookups()
  const today = useToday()
  const settings = useSettings()
  const actions = useTaskActions()
  const { open } = useOpenTask()
  const labels = task.labelIds.flatMap((id) => lookups.labels.get(id) ?? [])
  const done = task.status === 'done'

  return (
    <div
      className="tcard"
      data-priority={task.priority}
      data-done={done}
      data-dragging={dragging}
      data-task-id={task.id}
      tabIndex={0}
      onClick={() => open(task.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) open(task.id)
      }}
    >
      <Checkbox
        checked={done}
        priority={task.priority}
        label={done ? `"${task.title}" 완료 취소` : `"${task.title}" 완료`}
        onChange={(next) => (next ? actions.complete(task.id) : actions.reopen(task.id))}
      />
      <div className="tcard__body">
        <p className="tcard__title">{task.title}</p>
        <TaskMeta
          task={task}
          today={today}
          settings={settings}
          project={showProject ? lookups.projects.get(task.projectId) : undefined}
          labels={labels}
        />
      </div>
    </div>
  )
}

export const TaskCard = memo(TaskCardBase)
