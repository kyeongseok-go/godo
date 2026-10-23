import { toISODate } from '../date'
import type { ISODate, Task } from '../types'

/**
 * "날짜"의 정의를 한 곳에 못 박는다: 시작일(할 날)이 있으면 시작일, 없으면 마감일.
 * 정렬(date)과 그룹(date)이 같은 기준을 쓰도록 공유한다.
 */
export function scheduleDate(task: Task): ISODate | null {
  return task.startDate ?? task.dueDate
}

/** epoch ms 를 로컬 달력 날짜로 바꾼다(생성일 그룹용). */
export function localDateOf(ms: number): ISODate {
  return toISODate(new Date(ms))
}
