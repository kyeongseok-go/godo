import { AlarmClock, Bell, CalendarClock, Flag, Hourglass, Lock, PauseCircle, Repeat2 } from 'lucide-react'
import { describeRule } from '../../domain/recurrence'
import { dateTone, describeDate, formatDuration, formatTime } from '../../domain/format'
import type { ISODate, Label, Project, Settings, Task } from '../../domain/types'

interface TaskMetaProps {
  task: Task
  today: ISODate
  settings: Settings
  project?: Project
  labels: readonly Label[]
  progress?: { done: number; total: number }
}

/** 행 아래에 나오는 한 줄 요약. 값이 있는 것만 보여서 빈 행은 조용하다. */
export function TaskMeta({ task, today, settings, project, labels, progress }: TaskMetaProps) {
  const date = task.startDate ?? null
  const items: React.ReactNode[] = []

  if (date) {
    const time = task.startTime ? ` ${formatTime(task.startTime, settings.timeFormat)}` : ''
    const part = !task.startTime && task.dayPart ? ` ${PART_LABEL[task.dayPart]}` : ''
    items.push(
      <span key="date" className="meta meta--date" data-tone={task.status === 'done' ? 'later' : dateTone(date, today)}>
        <CalendarClock size={12} aria-hidden="true" />
        {describeDate(date, today)}
        {time}
        {part}
      </span>,
    )
  }
  if (task.dueDate) {
    items.push(
      <span key="due" className="meta meta--due" data-tone={task.status === 'done' ? 'later' : dateTone(task.dueDate, today)}>
        <Flag size={12} aria-hidden="true" />
        마감 {describeDate(task.dueDate, today)}
      </span>,
    )
  }
  if (task.recurrence) {
    items.push(
      <span key="rec" className="meta">
        <Repeat2 size={12} aria-hidden="true" />
        {describeRule(task.recurrence, task.startDate ?? undefined)}
      </span>,
    )
  }
  if (task.estimateMin) {
    items.push(
      <span key="est" className="meta">
        <Hourglass size={12} aria-hidden="true" />
        {formatDuration(task.estimateMin)}
      </span>,
    )
  }
  if (task.reminders.length > 0) {
    items.push(
      <span key="rem" className="meta" title="알림 있음">
        <Bell size={12} aria-hidden="true" />
        {task.reminders.length > 1 ? task.reminders.length : null}
      </span>,
    )
  }
  if (task.postponeCount > 0) {
    items.push(
      <span key="post" className="meta meta--warn" title="미룬 횟수">
        <AlarmClock size={12} aria-hidden="true" />
        {task.postponeCount}번 미룸
      </span>,
    )
  }
  if (task.blockedBy.length > 0) {
    items.push(
      <span key="blk" className="meta" title="다른 할 일이 끝나야 시작할 수 있어요">
        <Lock size={12} aria-hidden="true" />
        막힘
      </span>,
    )
  }
  if (task.onHold) {
    items.push(
      <span key="hold" className="meta">
        <PauseCircle size={12} aria-hidden="true" />
        보류
      </span>,
    )
  }
  if (progress && progress.total > 0) {
    items.push(
      <span key="sub" className="meta">
        {progress.done}/{progress.total}
      </span>,
    )
  }
  for (const label of labels) {
    items.push(
      <span key={`l-${label.id}`} className="meta meta--label" style={{ ['--label-color' as string]: label.color }}>
        {label.name}
      </span>,
    )
  }
  if (project) {
    items.push(
      <span key="proj" className="meta meta--project">
        <i className="dot" style={{ background: project.color }} aria-hidden="true" />
        {project.name}
      </span>,
    )
  }

  if (items.length === 0) return null
  return <div className="task-meta">{items}</div>
}

const PART_LABEL = { morning: '오전', afternoon: '오후', evening: '저녁' } as const
