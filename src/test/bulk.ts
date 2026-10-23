// 대량 데이터 성능 테스트용 생성기. seed.ts 는 건드리지 않고 makeTask 로 직접 만든다.
import type { EngineContext, Task } from '../domain/types'
import type { EntityState } from '../store/changes'
import { emptyEntityState } from '../store/changes'
import { makeProject, makeTask } from './factories'

/** 부모 1 + 자식 4 가 한 묶음. 7번째마다 앞 작업을 기다리고(blockedBy), 11번째마다 보류. */
const GROUP_SIZE = 5
const BLOCK_EVERY = 7
const HOLD_EVERY = 11
const PROJECT_COUNT = 20

export function makeBulkTasks(count: number, prefix = 'b'): Task[] {
  const tasks: Task[] = []
  for (let i = 0; i < count; i++) {
    const root = i - (i % GROUP_SIZE)
    tasks.push(
      makeTask({
        id: `${prefix}${i}`,
        title: `작업 ${i}`,
        projectId: `p${i % PROJECT_COUNT}`,
        parentId: i === root ? null : `${prefix}${root}`,
        blockedBy: i > 0 && i % BLOCK_EVERY === 0 ? [`${prefix}${i - 1}`] : [],
        onHold: i % HOLD_EVERY === 0,
        order: i,
      }),
    )
  }
  return tasks
}

export function makeBulkContext(tasks: readonly Task[], today = '2026-10-23'): EngineContext {
  return {
    today,
    now: new Date(2026, 9, 23, 12),
    weekStartsOn: 1,
    projects: Array.from({ length: PROJECT_COUNT }, (_, i) => makeProject({ id: `p${i}`, name: `프로젝트 ${i}`, order: i })),
    sections: [],
    labels: [],
    tasks,
  }
}

export function makeBulkState(tasks: readonly Task[]): EntityState {
  const state = emptyEntityState()
  return { ...state, tasks: Object.fromEntries(tasks.map((t) => [t.id, t])) }
}
