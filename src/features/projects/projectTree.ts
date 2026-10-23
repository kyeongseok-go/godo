import { INBOX_ID } from '../../domain/types'
import type { ID, Project } from '../../domain/types'

export interface ProjectNode {
  project: Project
  children: ProjectNode[]
  depth: number
}

/** 폴더 중첩 트리. 받은편지함·보관·삭제된 프로젝트는 빼고, 부모가 없는 항목은 최상위로 올린다. */
export function buildProjectTree(projects: readonly Project[], opts: { includeArchived?: boolean } = {}): ProjectNode[] {
  const visible = projects.filter(
    (p) => p.id !== INBOX_ID && p.deletedAt === null && (opts.includeArchived || !p.archived),
  )
  const byId = new Map<ID, Project>(visible.map((p) => [p.id, p]))
  const children = new Map<ID | null, Project[]>()
  for (const p of visible) {
    const parentKey = p.parentId && byId.has(p.parentId) ? p.parentId : null
    children.set(parentKey, [...(children.get(parentKey) ?? []), p])
  }
  const seen = new Set<ID>()
  const build = (parent: ID | null, depth: number): ProjectNode[] =>
    (children.get(parent) ?? [])
      .slice()
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ko'))
      .flatMap((project) => {
        if (seen.has(project.id)) return []
        seen.add(project.id)
        return [{ project, depth, children: build(project.id, depth + 1) }]
      })
  return build(null, 0)
}

/** 프로젝트와 그 아래 모든 프로젝트의 id (필터의 `##프로젝트`, 프로젝트 삭제 때 쓴다) */
export function projectSubtreeIds(projects: readonly Project[], rootId: ID): ID[] {
  const out: ID[] = [rootId]
  const queue: ID[] = [rootId]
  while (queue.length > 0) {
    const current = queue.shift() as ID
    for (const p of projects) {
      if (p.parentId === current && !out.includes(p.id)) {
        out.push(p.id)
        queue.push(p.id)
      }
    }
  }
  return out
}

export function flattenProjectTree(nodes: readonly ProjectNode[]): ProjectNode[] {
  return nodes.flatMap((n) => [n, ...flattenProjectTree(n.children)])
}
