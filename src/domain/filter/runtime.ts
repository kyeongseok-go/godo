// 평가에 필요한 조회 표를 컨텍스트에서 한 번만 만든다. 작업이 1만 개여도 이름 조회·날짜 해석을
// 작업마다 반복하지 않도록 모두 Map/Set 과 노드별 캐시로 둔다.
import { addDays } from '../date'
import { INBOX_ID } from '../types'
import type { EngineContext, ID, ISODate, Project, Task } from '../types'
import type { DateExpr, FilterNode, NamePattern, NodeOf } from './ast'
import { resolveDateExpr } from './dateExpr'

/** 완료·취소 작업을 결과에 넣을지 */
export interface StatusWants {
  readonly done: boolean
  readonly canceled: boolean
}

export interface Runtime {
  readonly today: ISODate
  resolveDate(expr: DateExpr): ISODate
  windowBounds(node: NodeOf<'dateWindow'>): readonly [ISODate, ISODate]
  projectIds(node: NodeOf<'project'>): ReadonlySet<ID>
  sectionIds(node: NodeOf<'section'>): ReadonlySet<ID>
  labelIds(node: NodeOf<'label'>): ReadonlySet<ID>
  /** 아직 끝나지 않은(그리고 휴지통에 없는) 작업인가 */
  isUnresolved(taskId: ID): boolean
  statusWants(root: FilterNode): StatusWants
}

const INBOX_NAMES = ['inbox', '받은편지함']

/** 키(노드 객체)별로 한 번만 계산하는 캐시 함수 */
function memoize<K extends object, V>(compute: (key: K) => V): (key: K) => V {
  const cache = new Map<K, V>()
  return (key) => {
    const hit = cache.get(key)
    if (hit !== undefined) return hit
    const value = compute(key)
    cache.set(key, value)
    return value
  }
}

/**
 * `*` 로 나뉜 조각이 이름과 맞는지(대소문자 무시). 정규식을 쓰지 않아 입력이 길어도 느려지지 않는다.
 */
export function matchesNamePattern(segments: NamePattern, name: string): boolean {
  const text = name.toLowerCase()
  const parts = segments.map((s) => s.toLowerCase())
  if (parts.length === 1) return text === parts[0]
  const first = parts[0]
  const last = parts[parts.length - 1]
  if (text.length < first.length + last.length) return false
  if (!text.startsWith(first) || !text.endsWith(last)) return false
  let pos = first.length
  const limit = text.length - last.length
  for (const middle of parts.slice(1, -1)) {
    const found = text.indexOf(middle, pos)
    if (found < 0 || found + middle.length > limit) return false
    pos = found + middle.length
  }
  return true
}

function childrenByParent(projects: readonly Project[]): Map<ID, ID[]> {
  const map = new Map<ID, ID[]>()
  for (const project of projects) {
    if (project.parentId === null) continue
    const siblings = map.get(project.parentId)
    if (siblings) siblings.push(project.id)
    else map.set(project.parentId, [project.id])
  }
  return map
}

/** 시작 프로젝트들과 그 하위(재귀)를 모은다. 부모가 서로를 가리키는 깨진 데이터에도 멈춘다. */
function withDescendants(roots: ReadonlySet<ID>, children: ReadonlyMap<ID, ID[]>): Set<ID> {
  const seen = new Set<ID>(roots)
  const queue = [...roots]
  for (let i = 0; i < queue.length; i += 1) {
    for (const child of children.get(queue[i]) ?? []) {
      if (seen.has(child)) continue
      seen.add(child)
      queue.push(child)
    }
  }
  return seen
}

function mergeWants(list: readonly StatusWants[]): StatusWants {
  return {
    done: list.some((w) => w.done),
    canceled: list.some((w) => w.canceled),
  }
}

const NO_WANTS: StatusWants = { done: false, canceled: false }

/** 부정(!)이 홀수 번 걸린 조건은 "원한다"로 세지 않는다. */
function computeWants(node: FilterNode, negated: boolean): StatusWants {
  switch (node.type) {
    case 'and':
    case 'or':
      return mergeWants(node.children.map((child) => computeWants(child, negated)))
    case 'not':
      return computeWants(node.child, !negated)
    case 'flag':
      if (negated) return NO_WANTS
      if (node.flag === 'viewAll') return { done: true, canceled: true }
      if (node.flag === 'completed') return { done: true, canceled: false }
      if (node.flag === 'canceled') return { done: false, canceled: true }
      return NO_WANTS
    default:
      return NO_WANTS
  }
}

export function createRuntime(ctx: EngineContext): Runtime {
  const projects = ctx.projects.filter((p) => p.deletedAt === null)
  const children = childrenByParent(projects)
  let taskById: Map<ID, Task> | null = null
  const findTask = (id: ID): Task | undefined => {
    taskById ??= new Map(ctx.tasks.map((t) => [t.id, t]))
    return taskById.get(id)
  }

  const matchingProjects = (name: NamePattern): Set<ID> => {
    const ids = new Set<ID>(projects.filter((p) => matchesNamePattern(name, p.name)).map((p) => p.id))
    // 받은편지함은 프로젝트 목록에 없어도 이름으로 찾을 수 있게 한다.
    if (INBOX_NAMES.some((n) => matchesNamePattern(name, n))) ids.add(INBOX_ID)
    return ids
  }

  return {
    today: ctx.today,
    resolveDate: memoize((expr: DateExpr) => resolveDateExpr(expr, ctx.today, ctx.weekStartsOn)),
    windowBounds: memoize((node: NodeOf<'dateWindow'>): readonly [ISODate, ISODate] =>
      node.direction === 'next'
        ? [ctx.today, addDays(ctx.today, node.days - 1)]
        : [addDays(ctx.today, -(node.days - 1)), ctx.today],
    ),
    projectIds: memoize((node: NodeOf<'project'>): ReadonlySet<ID> => {
      const direct = matchingProjects(node.name)
      return node.includeChildren ? withDescendants(direct, children) : direct
    }),
    sectionIds: memoize(
      (node: NodeOf<'section'>): ReadonlySet<ID> =>
        new Set(ctx.sections.filter((s) => matchesNamePattern(node.name, s.name)).map((s) => s.id)),
    ),
    labelIds: memoize(
      (node: NodeOf<'label'>): ReadonlySet<ID> =>
        new Set(ctx.labels.filter((l) => matchesNamePattern(node.name, l.name)).map((l) => l.id)),
    ),
    isUnresolved: (taskId) => {
      const task = findTask(taskId)
      return task !== undefined && task.deletedAt === null && (task.status === 'todo' || task.status === 'active')
    },
    statusWants: memoize((root: FilterNode) => computeWants(root, false)),
  }
}
