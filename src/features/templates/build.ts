// 작업·프로젝트를 템플릿 payload 로 직렬화한다. 순수 함수이며 id 와 시각은 인자로 받는다.
import { compareDate, daysBetween } from '../../domain/date'
import type { ISODate, Reminder, RecurrenceRule, Task, Template } from '../../domain/types'
import type { EntityState } from '../../store/changes'
import { newId } from '../../store/id'
import { childrenIndex } from '../../store/commands/taskTree'
import { TEMPLATE_VERSION } from './model'
import type {
  ProjectTemplatePayload,
  TaskTemplatePayload,
  TemplateRecurrence,
  TemplateRecurrenceEnd,
  TemplateTaskNode,
} from './model'

type Children = ReadonlyMap<string, readonly Task[]>

const byOrder = (a: Task, b: Task): number => a.order - b.order || a.createdAt - b.createdAt

function liveChildrenIndex(tasks: Readonly<Record<string, Task>>): Children {
  const index = childrenIndex(tasks)
  const live = new Map<string, Task[]>()
  for (const [parentId, kids] of index) {
    live.set(parentId, kids.filter((t) => t.deletedAt === null).sort(byOrder))
  }
  return live
}

function subtreeOf(root: Task, children: Children): Task[] {
  const out: Task[] = []
  const stack = [root]
  while (stack.length > 0) {
    const task = stack.pop() as Task
    out.push(task)
    stack.push(...(children.get(task.id) ?? []))
  }
  return out
}

function datesOf(task: Task): ISODate[] {
  return [task.startDate, task.dueDate].filter((d): d is ISODate => d !== null)
}

function earliest(dates: readonly ISODate[]): ISODate | null {
  return dates.reduce<ISODate | null>((min, d) => (min === null || compareDate(d, min) < 0 ? d : min), null)
}

/** 루트의 시작일 > 루트의 마감일 > 트리 전체에서 가장 이른 날짜. 날짜가 하나도 없으면 null. */
function anchorOf(root: Task, tasks: readonly Task[]): ISODate | null {
  return root.startDate ?? root.dueDate ?? earliest(tasks.flatMap(datesOf))
}

function templateEnd(end: RecurrenceRule['end'], offset: (date: ISODate) => number | null): TemplateRecurrenceEnd {
  if (end.type !== 'until') return end
  const days = offset(end.date)
  return days === null ? { type: 'never' } : { type: 'untilOffset', days }
}

/** 진행 기록(doneCount, skipDates)은 옮기지 않으려고 필드를 하나씩 복사한다. */
function toTemplateRecurrence(rule: RecurrenceRule, offset: (date: ISODate) => number | null): TemplateRecurrence {
  return {
    freq: rule.freq,
    interval: rule.interval,
    ...(rule.byWeekday ? { byWeekday: [...rule.byWeekday] } : {}),
    ...(rule.byMonthDay !== undefined ? { byMonthDay: rule.byMonthDay } : {}),
    ...(rule.nth ? { nth: { ...rule.nth } } : {}),
    anchor: rule.anchor,
    end: templateEnd(rule.end, offset),
    resetSubtasks: rule.resetSubtasks,
  }
}

function relativeOffsets(reminders: readonly Reminder[]): number[] {
  return reminders.flatMap((r) => (r.kind === 'relative' ? [r.offsetMin] : []))
}

function toNode(task: Task, children: Children, anchor: ISODate | null): TemplateTaskNode {
  const offset = (date: ISODate | null): number | null => (date !== null && anchor !== null ? daysBetween(anchor, date) : null)
  return {
    title: task.title,
    description: task.description,
    priority: task.priority,
    labelIds: [...task.labelIds],
    startOffset: offset(task.startDate),
    startTime: task.startTime,
    durationMin: task.durationMin,
    dayPart: task.dayPart,
    dueOffset: offset(task.dueDate),
    estimateMin: task.estimateMin,
    recurrence: task.recurrence ? toTemplateRecurrence(task.recurrence, offset) : null,
    reminderOffsets: relativeOffsets(task.reminders),
    persistentReminder: task.persistentReminder,
    someday: task.someday,
    children: (children.get(task.id) ?? []).map((kid) => toNode(kid, children, anchor)),
  }
}

function templateName(name: string, fallback: string): string {
  const trimmed = name.trim()
  return trimmed === '' ? fallback : trimmed
}

/** 작업과 그 하위 작업을 작업 템플릿으로 만든다. 없거나 휴지통에 있으면 null. */
export function buildTaskTemplate(
  state: EntityState,
  taskId: string,
  name: string,
  nowMs: number,
  id: string = newId(),
): Template | null {
  const root = state.tasks[taskId]
  if (!root || root.deletedAt !== null) return null
  const children = liveChildrenIndex(state.tasks)
  const anchor = anchorOf(root, subtreeOf(root, children))
  const payload: TaskTemplatePayload = { version: TEMPLATE_VERSION, root: toNode(root, children, anchor) }
  return { id, name: templateName(name, root.title), kind: 'task', payload, createdAt: nowMs }
}

/** 프로젝트의 섹션과 할 일 트리를 프로젝트 템플릿으로 만든다. 없거나 폴더·휴지통이면 null. */
export function buildProjectTemplate(
  state: EntityState,
  projectId: string,
  name: string,
  nowMs: number,
  id: string = newId(),
): Template | null {
  const project = state.projects[projectId]
  if (!project || project.isFolder || project.deletedAt !== null) return null

  const live = Object.values(state.tasks).filter((t) => t.projectId === projectId && t.deletedAt === null)
  const liveIds = new Set(live.map((t) => t.id))
  const children = liveChildrenIndex(state.tasks)
  const roots = live.filter((t) => t.parentId === null || !liveIds.has(t.parentId)).sort(byOrder)
  const sections = Object.values(state.sections).filter((s) => s.projectId === projectId).sort((a, b) => a.order - b.order)
  const sectionIndex = new Map(sections.map((s, index) => [s.id, index]))

  const anchor = earliest(live.flatMap(datesOf))
  const indexOf = (task: Task): number | null => (task.sectionId === null ? null : (sectionIndex.get(task.sectionId) ?? null))
  const groups: Array<number | null> = [null, ...sections.map((_, index) => index)]
  const tasks = groups.flatMap((group) =>
    roots.filter((t) => indexOf(t) === group).map((t) => ({ section: group, node: toNode(t, children, anchor) })),
  )

  const payload: ProjectTemplatePayload = {
    version: TEMPLATE_VERSION,
    project: { color: project.color, icon: project.icon, defaultView: project.defaultView },
    sections: sections.map((s) => ({ name: s.name, category: s.category })),
    tasks,
  }
  return { id, name: templateName(name, project.name), kind: 'project', payload, createdAt: nowMs }
}
