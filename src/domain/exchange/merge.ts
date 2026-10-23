// 가져온 데이터를 현재 데이터에 합치거나 덮어쓴다. 입력은 건드리지 않고 새 객체를 돌려준다.
import { INBOX_ID, type Project, type Task } from '../types'
import type { AppData, MergeMode } from './model'

interface ListOutcome<T> {
  items: T[]
  added: number
  updated: number
}

type Keyer<T> = (item: T) => string

const byId = <T extends { id: string }>(item: T): string => item.id

function updatedAtOf(item: object): number | null {
  if (!('updatedAt' in item)) return null
  return typeof item.updatedAt === 'number' ? item.updatedAt : null
}

/** 같은 id 충돌에서 가져온 쪽이 이기는가. 내용이 같거나 최신 여부를 알 수 없으면 현재 쪽을 지킨다. */
function incomingWins(existing: object, incoming: object): boolean {
  if (JSON.stringify(existing) === JSON.stringify(incoming)) return false
  const existingAt = updatedAtOf(existing)
  const incomingAt = updatedAtOf(incoming)
  // 어느 쪽이든 수정 시각이 없으면 어느 쪽이 최신인지 알 수 없다. 오래된 백업이 최신 기록(습관 기록 등)을
  // 되돌리지 않도록 현재 데이터를 지킨다.
  if (existingAt === null || incomingAt === null) return false
  return incomingAt > existingAt
}

function mergeList<T extends object>(current: readonly T[], incoming: readonly T[], keyOf: Keyer<T>): ListOutcome<T> {
  const items = [...current]
  const positions = new Map(items.map((item, index) => [keyOf(item), index]))
  let added = 0
  let updated = 0

  for (const item of incoming) {
    const key = keyOf(item)
    const position = positions.get(key)
    if (position === undefined) {
      positions.set(key, items.length)
      items.push(item)
      added += 1
    } else if (incomingWins(items[position], item)) {
      items[position] = item
      updated += 1
    }
  }
  return { items, added, updated }
}

function replaceList<T extends object>(current: readonly T[], incoming: readonly T[], keyOf: Keyer<T>): ListOutcome<T> {
  const existingKeys = new Set(current.map(keyOf))
  const overlap = incoming.filter((item) => existingKeys.has(keyOf(item))).length
  return { items: [...incoming], added: incoming.length - overlap, updated: overlap }
}

/** 존재하지 않는 프로젝트·섹션·부모를 가리키는 참조를 고친다. 바뀐 작업만 새 객체로 만든다. */
function repairTaskReferences(tasks: readonly Task[], data: Pick<AppData, 'projects' | 'sections'>): Task[] {
  const projectIds = new Set([INBOX_ID, ...data.projects.map((p) => p.id)])
  const sectionIds = new Set(data.sections.map((s) => s.id))
  const taskIds = new Set(tasks.map((t) => t.id))
  const parentOf = new Map<string, string | null>(
    tasks.map((t) => [t.id, t.parentId !== null && taskIds.has(t.parentId) ? t.parentId : null]),
  )

  // 순환은 하나씩 순서대로 끊는다. 끊은 결과가 다음 검사에 반영되도록 parentOf 를 갱신한다.
  for (const task of tasks) {
    if (isInCycle(task.id, parentOf)) parentOf.set(task.id, null)
  }

  const blockedBy = repairBlockedBy(tasks, taskIds)

  return tasks.map((task) => {
    const projectId = projectIds.has(task.projectId) ? task.projectId : INBOX_ID
    const sectionId = task.sectionId !== null && sectionIds.has(task.sectionId) ? task.sectionId : null
    const parentId = parentOf.get(task.id) ?? null
    const deps = blockedBy.get(task.id) ?? []
    const unchanged =
      projectId === task.projectId &&
      sectionId === task.sectionId &&
      parentId === task.parentId &&
      sameIds(deps, task.blockedBy)
    return unchanged ? task : { ...task, projectId, sectionId, parentId, blockedBy: deps }
  })
}

const sameIds = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id, i) => id === b[i])

/**
 * 막힘(blockedBy)에서 자기 자신·사라진 작업·순환을 걷어낸다.
 * 순환을 그대로 두면 서로가 서로를 기다려 그 작업들이 영원히 "지금 할 수 있는 일"에서 빠진다.
 * 입력 순서대로 훑으며, 이미 받아들인 의존만으로 고리가 생기는 간선을 버린다(결과가 항상 같다).
 */
function repairBlockedBy(tasks: readonly Task[], taskIds: ReadonlySet<string>): Map<string, string[]> {
  const kept = new Map<string, string[]>()
  const reaches = (from: string, target: string): boolean => {
    const stack = [from]
    const seen = new Set<string>()
    while (stack.length > 0) {
      const id = stack.pop() as string
      if (id === target) return true
      if (seen.has(id)) continue
      seen.add(id)
      stack.push(...(kept.get(id) ?? []))
    }
    return false
  }

  for (const task of tasks) {
    const deps: string[] = []
    for (const dep of task.blockedBy) {
      if (dep === task.id || !taskIds.has(dep) || deps.includes(dep)) continue
      if (reaches(dep, task.id)) continue
      deps.push(dep)
    }
    kept.set(task.id, deps)
  }
  return kept
}

function isInCycle(taskId: string, parentOf: ReadonlyMap<string, string | null>): boolean {
  const seen = new Set<string>()
  let cursor = parentOf.get(taskId) ?? null
  while (cursor !== null) {
    if (cursor === taskId) return true
    if (seen.has(cursor)) return false // 다른 고리에 걸린 경우. 그 고리의 구성원이 따로 처리한다.
    seen.add(cursor)
    cursor = parentOf.get(cursor) ?? null
  }
  return false
}

/**
 * 사라진 상위 프로젝트와 프로젝트끼리의 순환을 끊는다.
 * 순환이 남으면 사이드바 트리에 연결되지 못해 그 프로젝트들이 화면에서 사라진다.
 */
function repairProjectParents(projects: readonly Project[]): Project[] {
  const ids = new Set(projects.map((p) => p.id))
  const parentOf = new Map<string, string | null>(
    projects.map((p) => [p.id, p.parentId !== null && ids.has(p.parentId) ? p.parentId : null]),
  )
  for (const project of projects) {
    if (isInCycle(project.id, parentOf)) parentOf.set(project.id, null)
  }
  return projects.map((project) => {
    const parentId = parentOf.get(project.id) ?? null
    return parentId === project.parentId ? project : { ...project, parentId }
  })
}

export function applyImport(
  current: AppData,
  incoming: AppData,
  mode: MergeMode,
): { data: AppData; added: number; updated: number } {
  const combine = mode === 'merge' ? mergeList : replaceList

  const tasks = combine(current.tasks, incoming.tasks, byId)
  const projects = combine(current.projects, incoming.projects, byId)
  const sections = combine(current.sections, incoming.sections, byId)
  const labels = combine(current.labels, incoming.labels, byId)
  const filters = combine(current.filters, incoming.filters, byId)
  const comments = combine(current.comments, incoming.comments, byId)
  const activity = combine(current.activity, incoming.activity, byId)
  const templates = combine(current.templates, incoming.templates, byId)
  const habits = combine(current.habits, incoming.habits, byId)
  const countdowns = combine(current.countdowns, incoming.countdowns, byId)
  const focusSessions = combine(current.focusSessions, incoming.focusSessions, byId)
  const dayPlans = combine(current.dayPlans, incoming.dayPlans, (plan) => plan.date)
  const outcomes = [tasks, projects, sections, labels, filters, comments, activity, templates, habits, countdowns, focusSessions, dayPlans]

  // 덮어쓰기인데 백업에 설정이 없으면 지금 설정을 지키지 않고 기본값으로 돌아가므로, 현재 설정을 남긴다
  const settings = incoming.settings ?? current.settings
  const repairedProjects = repairProjectParents(projects.items)
  const base = { projects: repairedProjects, sections: sections.items }

  return {
    data: {
      tasks: repairTaskReferences(tasks.items, base),
      projects: repairedProjects,
      sections: sections.items,
      labels: labels.items,
      filters: filters.items,
      comments: comments.items,
      activity: activity.items,
      templates: templates.items,
      habits: habits.items,
      countdowns: countdowns.items,
      focusSessions: focusSessions.items,
      dayPlans: dayPlans.items,
      settings,
    },
    added: outcomes.reduce((sum, o) => sum + o.added, 0),
    updated: outcomes.reduce((sum, o) => sum + o.updated, 0),
  }
}
