import type { EngineContext, ID, ISODate, Label, Priority, Project, Section, Task } from '../types'
import { INBOX_ID } from '../types'
import { formatGroupDate } from './groupTitles'
import { localDateOf, scheduleDate } from './taskKeys'
import type { GroupBy, TaskGroup } from './types'

// 규칙 요약
// - 비어 있는 그룹은 만들지 않는다. 입력이 비면 어떤 모드든 [].
// - 그룹 안 작업 순서는 입력 순서 그대로다(정렬은 호출 측이 sortTasks 로 먼저 한다).
// - 날짜 계열 그룹은 날짜 오름차순, "없음"은 항상 마지막.
// - 라벨은 여러 개 달린 작업이 각 라벨 그룹에 모두 나타난다(중복 표시).
// - ctx 에 없는 라벨·프로젝트·섹션을 가리키는 작업은 "없음" 그룹으로 모은다.

const nameCollator = new Intl.Collator('ko', { numeric: true })
const PRIORITIES: readonly Priority[] = [1, 2, 3, 4]

interface Ordered {
  order: number
  name: string
}
const byOrderThenName = (a: Ordered, b: Ordered): number =>
  a.order - b.order || nameCollator.compare(a.name, b.name)

function pushTo<K>(map: Map<K, Task[]>, key: K, task: Task): void {
  const list = map.get(key)
  if (list) list.push(task)
  else map.set(key, [task])
}

function groupByDay(
  tasks: readonly Task[],
  dateOf: (task: Task) => ISODate | null,
  keyPrefix: string,
  noneTitle: string,
  today: ISODate,
): TaskGroup[] {
  const byDate = new Map<ISODate, Task[]>()
  const undated: Task[] = []
  for (const task of tasks) {
    const date = dateOf(task)
    if (date === null) undated.push(task)
    else pushTo(byDate, date, task)
  }
  const groups: TaskGroup[] = [...byDate.keys()].sort().map((date) => ({
    key: `${keyPrefix}:${date}`,
    title: formatGroupDate(date, today),
    tasks: byDate.get(date) ?? [],
  }))
  if (undated.length > 0) groups.push({ key: `${keyPrefix}:none`, title: noneTitle, tasks: undated })
  return groups
}

function groupByPriority(tasks: readonly Task[]): TaskGroup[] {
  return PRIORITIES.flatMap((p) => {
    const inGroup = tasks.filter((t) => t.priority === p)
    return inGroup.length > 0 ? [{ key: `priority:${p}`, title: `우선순위 ${p}`, tasks: inGroup }] : []
  })
}

function groupByLabel(tasks: readonly Task[], labels: readonly Label[]): TaskGroup[] {
  const known = new Set(labels.map((l) => l.id))
  const groups: TaskGroup[] = [...labels].sort(byOrderThenName).flatMap((label) => {
    const inGroup = tasks.filter((t) => t.labelIds.includes(label.id))
    return inGroup.length > 0 ? [{ key: `label:${label.id}`, title: label.name, tasks: inGroup }] : []
  })
  const unlabeled = tasks.filter((t) => !t.labelIds.some((id) => known.has(id)))
  if (unlabeled.length > 0) groups.push({ key: 'label:none', title: '라벨 없음', tasks: unlabeled })
  return groups
}

function projectTitle(id: ID, byId: ReadonlyMap<ID, Project>): string {
  const project = byId.get(id)
  if (project) return project.name
  return id === INBOX_ID ? '받은편지함' : '프로젝트 없음'
}

function groupByProject(tasks: readonly Task[], projects: readonly Project[]): TaskGroup[] {
  const byId = new Map(projects.map((p) => [p.id, p]))
  const bucket = new Map<ID, Task[]>()
  tasks.forEach((t) => pushTo(bucket, t.projectId, t))

  const known = [...projects].sort(byOrderThenName).filter((p) => bucket.has(p.id))
  const unknownIds = [...bucket.keys()].filter((id) => !byId.has(id))
  return [...known.map((p) => p.id), ...unknownIds].map((id) => ({
    key: `project:${id}`,
    title: projectTitle(id, byId),
    tasks: bucket.get(id) ?? [],
  }))
}

function groupBySection(tasks: readonly Task[], ctx: EngineContext): TaskGroup[] {
  const projectRank = new Map(
    [...ctx.projects].sort(byOrderThenName).map((p, index) => [p.id, index] as const),
  )
  const projectsById = new Map(ctx.projects.map((p) => [p.id, p]))
  const rank = (s: Section): number => projectRank.get(s.projectId) ?? Number.MAX_SAFE_INTEGER
  const sections = [...ctx.sections].sort((a, b) => rank(a) - rank(b) || byOrderThenName(a, b))

  // 여러 프로젝트가 섞여 있으면 같은 이름의 섹션을 구분하려고 프로젝트 이름을 붙인다.
  const spansProjects = new Set(tasks.map((t) => t.projectId)).size > 1
  const titleOf = (s: Section): string =>
    spansProjects ? `${projectTitle(s.projectId, projectsById)} · ${s.name}` : s.name

  const knownSectionIds = new Set<ID>()
  const groups: TaskGroup[] = sections.flatMap((section) => {
    const inGroup = tasks.filter((t) => t.sectionId === section.id)
    if (inGroup.length === 0) return []
    knownSectionIds.add(section.id)
    return [{ key: `section:${section.id}`, title: titleOf(section), tasks: inGroup }]
  })

  const loose = tasks.filter((t) => t.sectionId === null || !knownSectionIds.has(t.sectionId))
  if (loose.length > 0) groups.push({ key: 'section:none', title: '섹션 없음', tasks: loose })
  return groups
}

export function groupTasks(tasks: readonly Task[], by: GroupBy, ctx: EngineContext): TaskGroup[] {
  if (tasks.length === 0) return []
  switch (by) {
    case 'none':
      return [{ key: 'none', title: '전체', tasks: [...tasks] }]
    case 'date':
      return groupByDay(tasks, scheduleDate, 'date', '날짜 없음', ctx.today)
    case 'dueDate':
      return groupByDay(tasks, (t) => t.dueDate, 'dueDate', '마감 없음', ctx.today)
    case 'createdAt':
      return groupByDay(tasks, (t) => localDateOf(t.createdAt), 'createdAt', '생성일 없음', ctx.today)
    case 'priority':
      return groupByPriority(tasks)
    case 'label':
      return groupByLabel(tasks, ctx.labels)
    case 'project':
      return groupByProject(tasks, ctx.projects)
    case 'section':
      return groupBySection(tasks, ctx)
  }
}
