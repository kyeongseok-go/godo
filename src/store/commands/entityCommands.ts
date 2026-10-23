// 프로젝트·섹션·라벨·필터 조작 명령 (순수 함수, ChangeSet 반환)
import { projectSubtreeIds } from '../../features/projects/projectTree'
import { INBOX_ID } from '../../domain/types'
import type { ID, Label, Project, SavedFilter, Section, StatusCategory, Task } from '../../domain/types'
import { EMPTY_CHANGES, mergeChangeSets } from '../changes'
import type { ChangeSet, EntityState } from '../changes'
import { PALETTE } from '../defaults'
import { newId } from '../id'
import { deleteTasks } from './taskCommands'

const nextOrderOf = (items: readonly { order: number }[]): number =>
  items.reduce((max, i) => Math.max(max, i.order), 0) + 1000

const paletteColor = (count: number): string => PALETTE[count % PALETTE.length]

export function createProject(
  state: EntityState,
  input: { name: string; color?: string; parentId?: ID | null; isFolder?: boolean },
  nowMs: number,
): { changes: ChangeSet; project: Project } {
  const all = Object.values(state.projects)
  const siblings = all.filter((p) => p.parentId === (input.parentId ?? null))
  const project: Project = {
    id: newId(),
    name: input.name.trim(),
    color: input.color ?? paletteColor(all.length),
    icon: null,
    parentId: input.parentId ?? null,
    isFolder: input.isFolder ?? false,
    archived: false,
    favorite: false,
    defaultView: 'list',
    order: nextOrderOf(siblings),
    createdAt: nowMs,
    deletedAt: null,
  }
  return { project, changes: { puts: { projects: [project] }, deletes: {} } }
}

export function patchProject(state: EntityState, id: ID, patch: Partial<Project>): ChangeSet {
  const project = state.projects[id]
  if (!project || id === INBOX_ID && patch.deletedAt) return EMPTY_CHANGES
  // 자기 자신이나 자손 밑으로 옮기면 순환이 생기므로 막는다.
  if (patch.parentId && projectSubtreeIds(Object.values(state.projects), id).includes(patch.parentId)) {
    return EMPTY_CHANGES
  }
  return { puts: { projects: [{ ...project, ...patch, id }] }, deletes: {} }
}

/** 프로젝트 삭제: 하위 프로젝트까지 지우고, 그 안의 작업은 휴지통으로 보낸다(실행 취소 가능). */
export function deleteProject(state: EntityState, id: ID, nowMs: number): ChangeSet {
  if (id === INBOX_ID || !state.projects[id]) return EMPTY_CHANGES
  const ids = new Set(projectSubtreeIds(Object.values(state.projects), id))
  const projects = [...ids].map((pid) => ({ ...state.projects[pid], deletedAt: nowMs }))
  const roots = Object.values(state.tasks).filter((t) => ids.has(t.projectId) && t.parentId === null && t.deletedAt === null)
  const sections = Object.values(state.sections).filter((s) => ids.has(s.projectId)).map((s) => s.id)
  return mergeChangeSets(
    { puts: { projects }, deletes: { sections } },
    deleteTasks(state, roots.map((t) => t.id), nowMs),
  )
}

export function createSection(
  state: EntityState,
  input: { projectId: ID; name: string; category?: StatusCategory | null },
): { changes: ChangeSet; section: Section } {
  const siblings = Object.values(state.sections).filter((s) => s.projectId === input.projectId)
  const section: Section = {
    id: newId(),
    projectId: input.projectId,
    name: input.name.trim(),
    order: nextOrderOf(siblings),
    category: input.category ?? null,
  }
  return { section, changes: { puts: { sections: [section] }, deletes: {} } }
}

export function patchSection(state: EntityState, id: ID, patch: Partial<Section>): ChangeSet {
  const section = state.sections[id]
  return section ? { puts: { sections: [{ ...section, ...patch, id }] }, deletes: {} } : EMPTY_CHANGES
}

/** 섹션 삭제: 안의 작업은 지우지 않고 섹션 없음으로 되돌린다. */
export function deleteSection(state: EntityState, id: ID, nowMs: number): ChangeSet {
  if (!state.sections[id]) return EMPTY_CHANGES
  const orphans: Task[] = Object.values(state.tasks)
    .filter((t) => t.sectionId === id)
    .map((t) => ({ ...t, sectionId: null, updatedAt: nowMs }))
  return { puts: { tasks: orphans }, deletes: { sections: [id] } }
}

export function createLabel(state: EntityState, input: { name: string; color?: string }): { changes: ChangeSet; label: Label } {
  const labels = Object.values(state.labels)
  const label: Label = {
    id: newId(),
    name: input.name.trim().replace(/^[@%#]+/, ''),
    color: input.color ?? paletteColor(labels.length + 1),
    order: nextOrderOf(labels),
  }
  return { label, changes: { puts: { labels: [label] }, deletes: {} } }
}

export function findLabelByName(state: EntityState, name: string): Label | undefined {
  const needle = name.trim().toLowerCase()
  return Object.values(state.labels).find((l) => l.name.toLowerCase() === needle)
}

export function patchLabel(state: EntityState, id: ID, patch: Partial<Label>): ChangeSet {
  const label = state.labels[id]
  return label ? { puts: { labels: [{ ...label, ...patch, id }] }, deletes: {} } : EMPTY_CHANGES
}

/** 라벨 삭제: 모든 작업에서 이 라벨을 떼어낸다. */
export function deleteLabel(state: EntityState, id: ID, nowMs: number): ChangeSet {
  if (!state.labels[id]) return EMPTY_CHANGES
  const tasks = Object.values(state.tasks)
    .filter((t) => t.labelIds.includes(id))
    .map((t) => ({ ...t, labelIds: t.labelIds.filter((l) => l !== id), updatedAt: nowMs }))
  return { puts: { tasks }, deletes: { labels: [id] } }
}

export function createFilter(
  state: EntityState,
  input: { name: string; query: string; color?: string },
): { changes: ChangeSet; filter: SavedFilter } {
  const filters = Object.values(state.filters)
  const filter: SavedFilter = {
    id: newId(),
    name: input.name.trim(),
    query: input.query.trim(),
    color: input.color ?? paletteColor(filters.length + 2),
    favorite: false,
    order: nextOrderOf(filters),
  }
  return { filter, changes: { puts: { filters: [filter] }, deletes: {} } }
}

export function patchFilter(state: EntityState, id: ID, patch: Partial<SavedFilter>): ChangeSet {
  const filter = state.filters[id]
  return filter ? { puts: { filters: [{ ...filter, ...patch, id }] }, deletes: {} } : EMPTY_CHANGES
}

export function deleteFilter(state: EntityState, id: ID): ChangeSet {
  return state.filters[id] ? { puts: {}, deletes: { filters: [id] } } : EMPTY_CHANGES
}
