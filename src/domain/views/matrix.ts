import type { Priority, Task } from '../types'
import type { Quadrant } from './types'

// TickTick 방식: P1→I(바로 하기), P2→II(계획하기), P3→III(위임/나중에), P4→IV(없애기)
const QUADRANT_BY_PRIORITY: Record<Priority, Quadrant> = {
  1: 'doFirst',
  2: 'schedule',
  3: 'delegate',
  4: 'eliminate',
}

const PRIORITY_BY_QUADRANT: Record<Quadrant, Priority> = {
  doFirst: 1,
  schedule: 2,
  delegate: 3,
  eliminate: 4,
}

const isOpen = (task: Task): boolean =>
  (task.status === 'todo' || task.status === 'active') && task.deletedAt === null

/** 미완료(대기·진행)이고 휴지통에 없는 작업만 4분면에 담는다. 분면 안 순서는 입력 순서. */
export function matrixQuadrants(tasks: readonly Task[]): Record<Quadrant, Task[]> {
  const result: Record<Quadrant, Task[]> = { doFirst: [], schedule: [], delegate: [], eliminate: [] }
  for (const task of tasks) {
    if (isOpen(task)) result[QUADRANT_BY_PRIORITY[task.priority]].push(task)
  }
  return result
}

/** 드래그로 분면을 옮겼을 때 새로 줘야 할 우선순위. */
export function moveToQuadrantPriority(q: Quadrant): Priority {
  return PRIORITY_BY_QUADRANT[q]
}
