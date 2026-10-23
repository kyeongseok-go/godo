// 템플릿을 새 id 로 풀어 ChangeSet 으로 만든다. 순수 함수이며 id·시각·기준일은 인자로 받는다.
import { addDays } from '../../domain/date'
import type { ActivityLog, ID, ISODate, Project, RecurrenceRule, Section, StatusCategory, Task, Template } from '../../domain/types'
import { EMPTY_CHANGES } from '../../store/changes'
import type { ChangeSet } from '../../store/changes'
import { buildTask } from '../../store/commands/taskFactory'
import { parseTemplatePayload } from './model'
import type { TemplateRecurrence, TemplateTaskNode } from './model'

const ORDER_STEP = 1000

interface Context {
  newId: () => ID
  baseDate: ISODate
  nowMs: number
  projectId: ID
  knownLabelIds?: ReadonlySet<ID>
}

interface Placement {
  sectionId: ID | null
  parentId: ID | null
  order: number
  status: StatusCategory
}

export interface InstantiateTaskOptions {
  projectId: ID
  sectionId: ID | null
  parentId: ID | null
  baseDate: ISODate
  nowMs: number
  newId: () => ID
  /** 최상위 작업의 정렬 값. 보통 그 자리의 맨 끝(nextOrder)을 넘긴다. */
  rootOrder?: number
  /** 있으면 이 집합에 없는 라벨 id 는 뺀다(다른 기기에서 만든 템플릿이거나 라벨을 지운 경우) */
  knownLabelIds?: ReadonlySet<ID>
}

export interface InstantiateProjectOptions {
  parentId: ID | null
  baseDate: ISODate
  nowMs: number
  newId: () => ID
  /** 새 프로젝트의 정렬 값 */
  order: number
  /** 비우면 템플릿 이름을 쓴다 */
  name?: string
  knownLabelIds?: ReadonlySet<ID>
}

const shift = (base: ISODate, offset: number | null): ISODate | null => (offset === null ? null : addDays(base, offset))

function toRule(recurrence: TemplateRecurrence, baseDate: ISODate): RecurrenceRule {
  const { end, ...rest } = recurrence
  if (end.type === 'untilOffset') return { ...rest, end: { type: 'until', date: addDays(baseDate, end.days) } }
  return { ...rest, end }
}

function toTask(node: TemplateTaskNode, ctx: Context, place: Placement): Task {
  const labelIds = ctx.knownLabelIds ? node.labelIds.filter((id) => ctx.knownLabelIds?.has(id)) : [...node.labelIds]
  return buildTask(
    {
      title: node.title,
      description: node.description,
      projectId: ctx.projectId,
      sectionId: place.sectionId,
      parentId: place.parentId,
      priority: node.priority,
      labelIds,
      startDate: shift(ctx.baseDate, node.startOffset),
      startTime: node.startTime,
      durationMin: node.durationMin,
      dayPart: node.dayPart,
      dueDate: shift(ctx.baseDate, node.dueOffset),
      estimateMin: node.estimateMin,
      recurrence: node.recurrence ? toRule(node.recurrence, ctx.baseDate) : null,
      reminders: node.reminderOffsets.map((offsetMin) => ({ id: ctx.newId(), kind: 'relative' as const, offsetMin })),
      persistentReminder: node.persistentReminder,
      someday: node.someday,
      status: place.status,
      order: place.order,
    },
    ctx.nowMs,
    ctx.newId(),
  )
}

/** 노드와 그 하위 노드를 부모가 먼저 오는 순서로 펼친다. */
function expand(node: TemplateTaskNode, ctx: Context, place: Placement): Task[] {
  const task = toTask(node, ctx, place)
  const kids = node.children.flatMap((child, index) =>
    expand(child, ctx, { ...place, parentId: task.id, order: (index + 1) * ORDER_STEP }),
  )
  return [task, ...kids]
}

function createdLog(task: Task, summary: string, ctx: Context): ActivityLog {
  return { id: ctx.newId(), taskId: task.id, type: 'created', summary, at: ctx.nowMs }
}

/** 작업 템플릿으로 작업 트리를 만든다. 내용이 올바르지 않으면 빈 ChangeSet 을 돌려준다. */
export function instantiateTaskTemplate(template: Template, opts: InstantiateTaskOptions): ChangeSet {
  const parsed = parseTemplatePayload(template)
  if (!parsed.ok || parsed.kind !== 'task') return EMPTY_CHANGES

  const ctx: Context = { ...opts }
  const tasks = expand(parsed.payload.root, ctx, {
    sectionId: opts.sectionId,
    parentId: opts.parentId,
    order: opts.rootOrder ?? ORDER_STEP,
    status: 'todo',
  })
  const log = createdLog(tasks[0], `"${tasks[0].title}" 템플릿에서 추가`, ctx)
  return { puts: { tasks, activity: [log] }, deletes: {} }
}

/** 섹션이 진행 중 열이면 작업도 진행 중으로 시작한다. 완료·취소 열이어도 새로 만든 일은 아직 안 한 일이다. */
const statusFor = (category: StatusCategory | null): StatusCategory => (category === 'active' ? 'active' : 'todo')

/** 프로젝트 템플릿으로 새 프로젝트와 섹션, 작업을 만든다. 내용이 올바르지 않으면 projectId 가 null 이다. */
export function instantiateProjectTemplate(
  template: Template,
  opts: InstantiateProjectOptions,
): { changes: ChangeSet; projectId: ID | null } {
  const parsed = parseTemplatePayload(template)
  if (!parsed.ok || parsed.kind !== 'project') return { changes: EMPTY_CHANGES, projectId: null }

  const { payload } = parsed
  const name = opts.name?.trim() ? opts.name.trim() : template.name
  const project: Project = {
    id: opts.newId(),
    name,
    color: payload.project.color,
    icon: payload.project.icon,
    parentId: opts.parentId,
    isFolder: false,
    archived: false,
    favorite: false,
    defaultView: payload.project.defaultView,
    order: opts.order,
    createdAt: opts.nowMs,
    deletedAt: null,
  }
  const sections: Section[] = payload.sections.map((s, index) => ({
    id: opts.newId(),
    projectId: project.id,
    name: s.name,
    order: (index + 1) * ORDER_STEP,
    category: s.category,
  }))

  const ctx: Context = { ...opts, projectId: project.id }
  const nextOrder = new Map<ID | null, number>()
  const tasks = payload.tasks.flatMap(({ section, node }) => {
    const chosen = section === null ? null : sections[section]
    const key = chosen?.id ?? null
    const order = (nextOrder.get(key) ?? 0) + ORDER_STEP
    nextOrder.set(key, order)
    return expand(node, ctx, { sectionId: key, parentId: null, order, status: statusFor(chosen?.category ?? null) })
  })

  return { changes: { puts: { projects: [project], sections, tasks }, deletes: {} }, projectId: project.id }
}
