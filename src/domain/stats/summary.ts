import type { EngineContext, ID, ISODate, Task } from '../types'
import { buildTaskTree, groupTasks } from '../views'
import type { TaskNode } from '../views'
import { isCompletedTask, isOpenTask, localDateOf } from './shared'

export interface SummaryOptions {
  from: ISODate
  to: ISODate
  /** null 이면 모든 프로젝트, 빈 배열이면 아무 프로젝트도 아님 */
  projectIds: ID[] | null
  status: 'completed' | 'pending' | 'all'
}

interface Entry {
  kind: 'done' | 'pending'
  date: ISODate
}

const EMPTY_MESSAGE = '해당하는 작업이 없습니다.'
const BLANK_TITLE = '(제목 없음)'

/**
 * 보고서에 들어갈 작업 판정. 작업마다 독립적으로 판정하고(부모가 빠져도 하위 작업은 자기 조건만 본다),
 * - 완료: completedAt 의 로컬 날짜가 범위 안
 * - 미완료: (startDate ?? dueDate) 가 범위 안. 날짜가 없으면 넣지 않는다.
 * 취소·휴지통 작업은 어떤 경우에도 넣지 않는다.
 */
function classify(task: Task, opts: SummaryOptions, from: ISODate, to: ISODate): Entry | null {
  const inRange = (date: ISODate): boolean => date >= from && date <= to
  if (opts.projectIds !== null && !opts.projectIds.includes(task.projectId)) return null

  if (isCompletedTask(task) && opts.status !== 'pending') {
    const date = localDateOf(task.completedAt)
    return inRange(date) ? { kind: 'done', date } : null
  }
  if (isOpenTask(task) && opts.status !== 'completed') {
    const date = task.startDate ?? task.dueDate
    return date !== null && inRange(date) ? { kind: 'pending', date } : null
  }
  return null
}

const formatMonthDay = (date: ISODate): string => {
  const [, month, day] = date.split('-')
  return `${Number(month)}/${Number(day)}`
}

const cleanTitle = (title: string): string => title.replace(/\s+/g, ' ').trim() || BLANK_TITLE

function renderNode(node: TaskNode, entries: ReadonlyMap<ID, Entry>): string[] {
  const entry = entries.get(node.task.id)
  const box = entry?.kind === 'done' ? 'x' : ' '
  const date = entry ? ` (${formatMonthDay(entry.date)})` : ''
  const line = `${'  '.repeat(node.depth)}- [${box}] ${cleanTitle(node.task.title)}${date}`
  return [line, ...node.children.flatMap((child) => renderNode(child, entries))]
}

/**
 * 기간·프로젝트·상태로 모은 한국어 마크다운 요약. from > to 이면 서로 바꿔서 쓴다.
 * 구성: 맨 위 한 줄(기간·완료·미완료 건수, 보고서에 실린 작업 기준) → 프로젝트별 `## 소제목` → 체크박스 목록.
 * 날짜는 0 채움 없이 `10/22`. 하위 작업은 2칸씩 들여쓴다(부모가 목록에 없으면 최상위로 올라온다).
 */
export function buildSummaryMarkdown(ctx: EngineContext, opts: SummaryOptions): string {
  const [from, to] = opts.from <= opts.to ? [opts.from, opts.to] : [opts.to, opts.from]

  const entries = new Map<ID, Entry>()
  const tasks: Task[] = []
  for (const task of ctx.tasks) {
    const entry = classify(task, opts, from, to)
    if (entry === null) continue
    entries.set(task.id, entry)
    tasks.push(task)
  }

  const done = [...entries.values()].filter((e) => e.kind === 'done').length
  const header = `기간: ${from} ~ ${to} · 완료 ${done}건 · 미완료 ${entries.size - done}건`
  if (tasks.length === 0) return `${header}\n\n${EMPTY_MESSAGE}`

  const sections = groupTasks(tasks, 'project', ctx).map((group) => {
    const lines = buildTaskTree(group.tasks).flatMap((node) => renderNode(node, entries))
    return [`## ${group.title}`, ...lines].join('\n')
  })
  return [header, ...sections].join('\n\n')
}
