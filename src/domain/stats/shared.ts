import { toISODate } from '../date'
import type { ISODate, Task } from '../types'

/** epoch ms 를 로컬 시간대의 달력 날짜로 바꾼다. 통계의 모든 날짜 집계가 이 함수를 거친다. */
export function localDateOf(ms: number): ISODate {
  return toISODate(new Date(ms))
}

/** 미완료 = 대기·진행. 취소·완료와 휴지통은 제외. */
export function isOpenTask(task: Task): boolean {
  return (task.status === 'todo' || task.status === 'active') && task.deletedAt === null
}

/** 진짜 완료된 작업: 상태가 done 이고 완료 시각이 있으며 휴지통에 없다. */
export function isCompletedTask(task: Task): task is Task & { completedAt: number } {
  return task.status === 'done' && task.completedAt !== null && task.deletedAt === null
}
