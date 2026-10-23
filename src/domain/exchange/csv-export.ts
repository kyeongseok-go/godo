// Todoist 호환 CSV 내보내기. 프로젝트 하나를 내보내려면 그 프로젝트와 작업만 넘기면 된다.
import { INBOX_ID, type ID, type Label, type Project, type Section, type Task } from '../types'
import { guardFormulaCell, toCsvRow } from './csv-core'
import { describeRecurrence, formatKoreanTime } from './recurrence-text'

const HEADER = ['TYPE', 'CONTENT', 'DESCRIPTION', 'PRIORITY', 'INDENT', 'AUTHOR', 'RESPONSIBLE', 'DATE', 'DATE_LANG', 'TIMEZONE']
const MAX_INDENT = 4
const DATE_LANG = 'ko'

interface ExportContext {
  labelNames: ReadonlyMap<ID, string>
  children: ReadonlyMap<ID, readonly Task[]>
}

function byOrder(a: Task, b: Task): number {
  return a.order - b.order || a.createdAt - b.createdAt
}

function isExportable(task: Task): boolean {
  return task.deletedAt === null && (task.status === 'todo' || task.status === 'active')
}

/** 내보낼 프로젝트 id 를 순서대로. 받은편지함은 프로젝트 목록에 없어도 맨 앞에 둔다. */
function projectOrder(projects: readonly Project[]): ID[] {
  const live = projects.filter((p) => p.deletedAt === null)
  const sorted = [...live].sort((a, b) => a.order - b.order).map((p) => p.id)
  const hasInboxRow = projects.some((p) => p.id === INBOX_ID)
  return hasInboxRow ? sorted : [INBOX_ID, ...sorted]
}

/** 날짜 칸: 반복이면 한국어 설명, 아니면 'YYYY-MM-DD' 또는 'YYYY-MM-DD HH:mm'. 시작일이 없으면 마감일을 쓴다. */
function dateCell(task: Task): string {
  const date = task.startDate ?? task.dueDate
  const time = task.startDate ? task.startTime : null

  if (task.recurrence) {
    const text = describeRecurrence(task.recurrence, date)
    return time ? `${text} ${formatKoreanTime(time)}` : text
  }
  if (!date) return ''
  return time ? `${date} ${time}` : date
}

function contentCell(task: Task, labelNames: ReadonlyMap<ID, string>): string {
  const tags = task.labelIds
    .map((id) => labelNames.get(id))
    .filter((name): name is string => name !== undefined)
    .map((name) => ` @${name.replace(/\s+/g, '_')}`)
  return guardFormulaCell(`${task.title}${tags.join('')}`)
}

function taskRow(task: Task, depth: number, labelNames: ReadonlyMap<ID, string>): string {
  const date = dateCell(task)
  return toCsvRow([
    'task',
    contentCell(task, labelNames),
    guardFormulaCell(task.description),
    String(task.priority),
    String(Math.min(depth + 1, MAX_INDENT)),
    '',
    '',
    date,
    date ? DATE_LANG : '',
    '',
  ])
}

function sectionRow(section: Section): string {
  return toCsvRow(['section', guardFormulaCell(section.name), '', '', '', '', '', '', '', ''])
}

function treeRows(task: Task, depth: number, ctx: ExportContext): string[] {
  const kids = ctx.children.get(task.id) ?? []
  return [taskRow(task, depth, ctx.labelNames), ...kids.flatMap((kid) => treeRows(kid, depth + 1, ctx))]
}

function projectRows(tasks: readonly Task[], sections: readonly Section[], labelNames: ReadonlyMap<ID, string>): string[] {
  const exported = new Set(tasks.map((t) => t.id))
  const sorted = [...tasks].sort(byOrder)
  const childMap = new Map<ID, Task[]>()
  const roots: Task[] = []

  for (const task of sorted) {
    const parentId = task.parentId
    if (parentId === null || !exported.has(parentId)) {
      roots.push(task)
      continue
    }
    const siblings = childMap.get(parentId)
    if (siblings) siblings.push(task)
    else childMap.set(parentId, [task])
  }

  const ctx: ExportContext = { labelNames, children: childMap }
  const sortedSections = [...sections].sort((a, b) => a.order - b.order)
  const sectionIds = new Set(sortedSections.map((s) => s.id))
  const unsectioned = roots.filter((t) => t.sectionId === null || !sectionIds.has(t.sectionId))

  return [
    ...unsectioned.flatMap((t) => treeRows(t, 0, ctx)),
    ...sortedSections.flatMap((section) => [
      sectionRow(section),
      ...roots.filter((t) => t.sectionId === section.id).flatMap((t) => treeRows(t, 0, ctx)),
    ]),
  ]
}

export function tasksToCsv(input: {
  tasks: readonly Task[]
  projects: readonly Project[]
  sections: readonly Section[]
  labels: readonly Label[]
}): string {
  const labelNames = new Map(input.labels.map((l) => [l.id, l.name]))
  const exportable = input.tasks.filter(isExportable)

  const body = projectOrder(input.projects).flatMap((projectId) =>
    projectRows(
      exportable.filter((t) => t.projectId === projectId),
      input.sections.filter((s) => s.projectId === projectId),
      labelNames,
    ),
  )
  return [toCsvRow(HEADER), ...body].join('\n')
}
