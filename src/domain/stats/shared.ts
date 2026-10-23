import { todayOf } from '../date'
import type { ISODate, Task } from '../types'

/**
 * epoch ms 를 "하루 시작 시각" 설정을 반영한 날짜로 바꾼다. 통계의 모든 날짜 집계가 이 함수를 거친다.
 * dayStartHour=4 라면 새벽 2시에 끝낸 일은 아직 어제 몫이다(오늘 목록의 기준과 같아야 한다).
 */
export function localDateOf(ms: number, dayStartHour = 0): ISODate {
  return todayOf(new Date(ms), dayStartHour)
}

/** 미완료 = 대기·진행. 취소·완료와 휴지통은 제외. */
export function isOpenTask(task: Task): boolean {
  return (task.status === 'todo' || task.status === 'active') && task.deletedAt === null
}

/** 진짜 완료된 작업: 상태가 done 이고 완료 시각이 있으며 휴지통에 없다. */
export function isCompletedTask(task: Task): task is Task & { completedAt: number } {
  return task.status === 'done' && task.completedAt !== null && task.deletedAt === null
}
