import type { ReactNode } from 'react'
import { formatDuration, formatTime } from '../../domain/format'
import { taskMinutes } from '../../domain/planning'
import type { Task } from '../../domain/types'
import { useSettings } from '../../hooks/data'
import { useLookups } from '../../hooks/lookups'

interface PlanLineProps {
  task: Task
  /** 제목 앞(체크·별 같은 조작) */
  lead?: ReactNode
  /** 제목 뒤(내일로·언젠가 같은 조작) */
  trail?: ReactNode
  /** 예상 시간 대신 보여줄 글(예: 실제 소요) */
  note?: string
}

/** 계획 화면의 한 줄: 제목, 프로젝트, 시각, 예상 시간. 조작은 호출 측이 끼워 넣는다. */
export function PlanLine({ task, lead, trail, note }: PlanLineProps) {
  const settings = useSettings()
  const project = useLookups().projects.get(task.projectId)
  const minutes = taskMinutes(task, settings.defaultDurationMin)
  return (
    <li className="plan-line" data-done={task.status === 'done'}>
      {lead}
      <div className="plan-line__body">
        <p className="plan-line__title">{task.title}</p>
        <p className="plan-line__meta">
          {project ? (
            <span className="plan-line__project">
              <i style={{ background: project.color }} aria-hidden="true" />
              {project.name}
            </span>
          ) : null}
          {task.startTime ? <span>{formatTime(task.startTime, settings.timeFormat)}</span> : null}
          <span>{note ?? `예상 ${formatDuration(minutes)}`}</span>
          {task.postponeCount > 0 ? <span>{task.postponeCount}번 미룸</span> : null}
        </p>
      </div>
      {trail}
    </li>
  )
}
