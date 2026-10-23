// 카드를 한 장씩 넘기며 결정하는 흐름의 공통 리듀서. 미완료 정리와 받은편지함 처리가 함께 쓴다.
import type { ID, Task } from '../../domain/types'
import { EMPTY_CHANGES } from '../../store/changes'
import type { ChangeSet } from '../../store/changes'

export interface DecisionRecord<D> {
  taskId: ID
  decision: D
  /** 이 결정을 되돌리는 변경. 되돌리기는 이 값을 그대로 commit 한다. */
  inverse: ChangeSet
  /** 사용자가 고른 게 아니라 앞선 결정의 결과로 저절로 처리된 카드(부모를 완료하면 자식도 끝나는 경우) */
  auto?: boolean
}

export interface DecisionFlow<D> {
  /** 시작 시점에 정해 둔 순서. 결정하는 동안 목록이 바뀌어도 카드 순서는 흔들리지 않는다. */
  queue: readonly ID[]
  records: readonly DecisionRecord<D>[]
}

export function startDecisionFlow<D>(candidates: readonly Task[]): DecisionFlow<D> {
  return { queue: candidates.map((t) => t.id), records: [] }
}

export function currentTaskId(flow: DecisionFlow<unknown>): ID | null {
  return flow.queue[flow.records.length] ?? null
}

export function flowProgress(flow: DecisionFlow<unknown>): { position: number; total: number; finished: boolean } {
  const total = flow.queue.length
  const finished = flow.records.length >= total
  const position = Math.min(flow.records.length + 1, total)
  return { position, total, finished }
}

/** 지금 카드에 대한 결정만 받는다. 다른 카드의 기록이 끼어들면 흐름을 그대로 돌려준다. */
export function recordDecision<D>(flow: DecisionFlow<D>, record: DecisionRecord<D>): DecisionFlow<D> {
  if (currentTaskId(flow) !== record.taskId) return flow
  return { ...flow, records: [...flow.records, record] }
}

/** 직전 결정을 물린다. 뒤따른 자동 처리 카드까지 함께 걷어낸다. */
export function undoDecision<D>(flow: DecisionFlow<D>): { flow: DecisionFlow<D>; record: DecisionRecord<D> | null } {
  let end = flow.records.length
  while (end > 0 && flow.records[end - 1].auto === true) end -= 1
  if (end === 0) return { flow, record: null }
  return { flow: { ...flow, records: flow.records.slice(0, end - 1) }, record: flow.records[end - 1] }
}

/**
 * 앞선 결정의 결과로 이미 끝난 카드를 자동 처리한 흐름을 돌려준다(화면에 그릴 때마다 계산).
 * resolve 가 결정을 돌려주면 그 카드는 사용자가 고른 게 아니라 저절로 처리된 것(auto)으로 기록한다.
 * 상태에는 사용자가 고른 기록만 저장하고(stripAutos), 자동 처리는 매번 현재 데이터에서 다시 도출한다.
 */
export function withAutoSkips<D>(flow: DecisionFlow<D>, resolve: (taskId: ID) => D | null): DecisionFlow<D> {
  const records: DecisionRecord<D>[] = []
  let real = 0
  for (const taskId of flow.queue) {
    const chosen = flow.records[real]
    if (chosen !== undefined && chosen.taskId === taskId) {
      records.push(chosen)
      real += 1
      continue
    }
    const decision = resolve(taskId)
    if (decision === null) break
    records.push({ taskId, decision, inverse: EMPTY_CHANGES, auto: true })
  }
  return { queue: flow.queue, records }
}

/** 자동 처리 기록을 걷어내 상태에 저장할 흐름으로 만든다 */
export function stripAutos<D>(flow: DecisionFlow<D>): DecisionFlow<D> {
  return { queue: flow.queue, records: flow.records.filter((r) => r.auto !== true) }
}
