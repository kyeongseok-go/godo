// 공개 평가 API: 작업 하나 판정(matchesFilter)과 쿼리 문자열 실행(runFilter).
import type { EngineContext, Task } from '../types'
import type { FilterError, FilterNode } from './ast'
import { evalNode } from './evaluate'
import { parseFilter } from './parser'
import { createRuntime } from './runtime'
import type { Runtime } from './runtime'

export type RunFilterResult =
  | { ok: true; groups: Task[][] }
  | { ok: false; error: FilterError }

/** 삭제된 작업은 항상 제외. 완료·취소 작업은 묶음이 원할 때만 포함한다. */
function passesStatusGate(root: FilterNode, task: Task, rt: Runtime): boolean {
  if (task.deletedAt !== null) return false
  if (task.status === 'todo' || task.status === 'active') return true
  const wants = rt.statusWants(root)
  return task.status === 'done' ? wants.done : wants.canceled
}

function matchesWith(root: FilterNode, task: Task, rt: Runtime): boolean {
  return passesStatusGate(root, task, rt) && evalNode(root, task, rt)
}

interface CachedRuntime {
  readonly today: string
  readonly weekStartsOn: 0 | 1
  readonly projects: EngineContext['projects']
  readonly sections: EngineContext['sections']
  readonly labels: EngineContext['labels']
  readonly tasks: EngineContext['tasks']
  readonly runtime: Runtime
}

/** matchesFilter를 작업마다 부르는 화면(목록 배지 등)에서 조회 표를 다시 만들지 않도록 맥락별로 둔다. */
const runtimeCache = new WeakMap<EngineContext, CachedRuntime>()

function runtimeFor(ctx: EngineContext): Runtime {
  const hit = runtimeCache.get(ctx)
  if (
    hit &&
    hit.today === ctx.today &&
    hit.weekStartsOn === ctx.weekStartsOn &&
    hit.projects === ctx.projects &&
    hit.sections === ctx.sections &&
    hit.labels === ctx.labels &&
    hit.tasks === ctx.tasks
  ) {
    return hit.runtime
  }
  const runtime = createRuntime(ctx)
  runtimeCache.set(ctx, {
    today: ctx.today,
    weekStartsOn: ctx.weekStartsOn,
    projects: ctx.projects,
    sections: ctx.sections,
    labels: ctx.labels,
    tasks: ctx.tasks,
    runtime,
  })
  return runtime
}

/** parseFilter가 돌려준 묶음 하나(node)가 task에 맞는지. 삭제·완료 제외 규칙도 함께 적용한다. */
export function matchesFilter(node: FilterNode, task: Task, ctx: EngineContext): boolean {
  return matchesWith(node, task, runtimeFor(ctx))
}

/** 쿼리를 파싱해 묶음(쉼표)마다 맞는 작업 목록을 돌려준다. 작업 순서는 ctx.tasks 그대로다. */
export function runFilter(query: string, ctx: EngineContext): RunFilterResult {
  const parsed = parseFilter(query)
  if (!parsed.ok) return parsed
  const rt = createRuntime(ctx)
  const groups = parsed.ast.map((root) => ctx.tasks.filter((task) => matchesWith(root, task, rt)))
  return { ok: true, groups }
}
