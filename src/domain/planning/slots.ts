// 빈 시간 칸 계산. 작업 자동 배치(autoPlace)와 습관 블록(habitBlocks)이 같은 규칙을 쓴다.
import type { ISODate, TimeOfDay } from '../types'

/** 자리가 이미 잡힌 외부 일정. 자동 배치가 피해 갈 시간이다. */
export interface BusyBlock {
  date: ISODate
  start: TimeOfDay
  end: TimeOfDay
}

/** 하루 안의 구간(분 단위, [start, end)) */
export interface Interval {
  start: number
  end: number
}

/**
 * 새 블록 [start, end) 이 기존 블록과 부딪히는가.
 * 모든 블록 뒤에는 bufferMin 이 붙으므로, 새 블록의 끝 + 버퍼가 기존 시작을 넘거나
 * 기존 끝 + 버퍼가 새 시작을 넘으면 충돌이다.
 */
export function conflicts(
  blocks: readonly Interval[],
  start: number,
  end: number,
  bufferMin: number,
): boolean {
  return blocks.some((b) => end + bufferMin > b.start && start < b.end + bufferMin)
}

/**
 * window 안에서 slotMin 간격에 맞는 가장 빠른 빈 시작 시각(분). 없으면 null.
 * notBefore 가 있으면 그 시각 이후만 본다(오늘은 지나간 시간을 제안하지 않는다).
 */
export function findFreeStart(
  blocks: readonly Interval[],
  minutes: number,
  window: Interval,
  opts: { slotMin: number; bufferMin: number; notBefore?: number },
): number | null {
  const slot = Math.max(1, Math.floor(opts.slotMin))
  const lower = Math.max(window.start, opts.notBefore ?? window.start)
  for (let start = Math.ceil(lower / slot) * slot; start + minutes <= window.end; start += slot) {
    if (!conflicts(blocks, start, start + minutes, opts.bufferMin)) return start
  }
  return null
}
