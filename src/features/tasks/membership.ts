// 방금 완료한 행을 잠깐 남겨 둘 때 "원래 어느 그룹에 있었는지"를 기억하는 순수 함수.
import type { ID } from '../../domain/types'
import type { TaskGroup } from '../../domain/views'

/**
 * 이전 기록과 현재 그룹으로 다음 기록을 만든다. 입력은 바꾸지 않는다.
 * 지금 보이는 작업은 그룹 키를 갱신하고, 사라졌어도 아직 남겨 두는 중(lingering)이면 이전 기록을 유지한다.
 * 그 외는 버려서 기록이 보이는 작업 수를 넘지 않게 한다. 전체를 한 번씩만 훑는다(O(n)).
 */
export function nextMembership(
  prev: ReadonlyMap<ID, string>,
  groups: readonly TaskGroup[],
  lingering: Readonly<Record<ID, true>>,
): Map<ID, string> {
  const next = new Map<ID, string>()
  for (const g of groups) for (const t of g.tasks) next.set(t.id, g.key)
  for (const [id, key] of prev) {
    if (lingering[id] && !next.has(id)) next.set(id, key)
  }
  return next
}

/**
 * 그룹 키 → 제목 기록. 입력은 바꾸지 않는다.
 *
 * 그룹에 남은 마지막 하나를 끝내면 그룹이 통째로 사라진다. 남겨 두기로 한 행을 원래 자리에
 * 다시 세우려면 그 그룹의 이름이 있어야 하므로, 아직 누군가 가리키고 있는 키의 제목은 들고 있는다.
 */
export function nextGroupTitles(
  prev: ReadonlyMap<string, string>,
  groups: readonly TaskGroup[],
  membership: ReadonlyMap<ID, string>,
): Map<string, string> {
  const next = new Map<string, string>()
  for (const g of groups) next.set(g.key, g.title)
  const stillNeeded = new Set(membership.values())
  for (const [key, title] of prev) {
    if (!next.has(key) && stillNeeded.has(key)) next.set(key, title)
  }
  return next
}
