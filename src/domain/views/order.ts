import type { ID } from '../types'

const STEP = 1000
/** 이웃 간격이 이 값 이하로 좁아지면 실수 정밀도가 곧 바닥나므로 재정렬을 요청한다. */
const MIN_GAP = 1e-9

const finiteOrNull = (n: number | null): number | null => (n !== null && Number.isFinite(n) ? n : null)

/**
 * 드래그 정렬용 순서 값. 두 이웃 사이의 중간값을 돌려준다.
 * - 둘 다 없으면 0, 한쪽만 없으면 반대쪽 ±1000.
 * - 이웃 간격이 1e-9 이하면 needsRebalance 가 true (값은 그래도 중간값). 던지지 않는다.
 * - NaN·무한대는 "이웃 없음"으로 본다.
 */
export function reorderValue(
  prev: number | null,
  next: number | null,
): { value: number; needsRebalance: boolean } {
  const p = finiteOrNull(prev)
  const n = finiteOrNull(next)
  if (p === null) return { value: n === null ? 0 : n - STEP, needsRebalance: false }
  if (n === null) return { value: p + STEP, needsRebalance: false }
  return { value: (p + n) / 2, needsRebalance: Math.abs(n - p) <= MIN_GAP }
}

/** 주어진 순서대로 1000, 2000, 3000… 을 다시 배정한다. 같은 id 는 첫 위치를 유지. */
export function rebalanceOrders(items: readonly { id: ID }[]): Map<ID, number> {
  const result = new Map<ID, number>()
  for (const item of items) {
    if (!result.has(item.id)) result.set(item.id, (result.size + 1) * STEP)
  }
  return result
}
