// 목록 보기 옵션(정렬·그룹·완료 표시)을 URL 검색 파라미터로 읽고 쓴다. 새로고침과 링크 공유에서도 유지된다.
import type { EngineContext, Task } from '../../domain/types'
import { groupTasks, sortTasks } from '../../domain/views'
import type { GroupBy, SortBy, SortDir, TaskGroup } from '../../domain/views'

export interface ViewOptions {
  sort: SortBy
  dir: SortDir
  group: GroupBy
  showDone: boolean
}

export const DEFAULT_OPTIONS: ViewOptions = { sort: 'manual', dir: 'asc', group: 'none', showDone: false }

export const SORT_LABELS: Record<SortBy, string> = {
  manual: '직접 정렬',
  name: '이름',
  date: '날짜',
  dueDate: '마감일',
  priority: '우선순위',
  createdAt: '만든 날',
  updatedAt: '수정한 날',
}

export const GROUP_LABELS: Record<GroupBy, string> = {
  none: '그룹 없음',
  date: '날짜',
  dueDate: '마감일',
  createdAt: '만든 날',
  priority: '우선순위',
  label: '라벨',
  project: '프로젝트',
  section: '섹션',
}

const isOneOf = <T extends string>(value: string | null, allowed: readonly T[]): value is T =>
  value !== null && (allowed as readonly string[]).includes(value)

export function readOptions(params: URLSearchParams): ViewOptions {
  const sort = params.get('sort')
  const dir = params.get('dir')
  const group = params.get('group')
  return {
    sort: isOneOf(sort, Object.keys(SORT_LABELS) as SortBy[]) ? sort : DEFAULT_OPTIONS.sort,
    dir: dir === 'desc' ? 'desc' : 'asc',
    group: isOneOf(group, Object.keys(GROUP_LABELS) as GroupBy[]) ? group : DEFAULT_OPTIONS.group,
    showDone: params.get('done') === '1',
  }
}

/** 기본값과 같은 항목은 URL에서 뺀다. 다른 파라미터(view, task 등)는 그대로 둔다. */
export function writeOptions(params: URLSearchParams, patch: Partial<ViewOptions>): URLSearchParams {
  const next = new URLSearchParams(params)
  const merged = { ...readOptions(params), ...patch }
  const set = (key: string, value: string, isDefault: boolean) => (isDefault ? next.delete(key) : next.set(key, value))
  set('sort', merged.sort, merged.sort === DEFAULT_OPTIONS.sort)
  set('dir', merged.dir, merged.dir === DEFAULT_OPTIONS.dir)
  set('group', merged.group, merged.group === DEFAULT_OPTIONS.group)
  set('done', '1', !merged.showDone)
  return next
}

export function applyOptions(tasks: readonly Task[], opts: ViewOptions, ctx: EngineContext): TaskGroup[] {
  const visible = opts.showDone ? tasks : tasks.filter((t) => t.status !== 'done' && t.status !== 'canceled')
  const sorted = sortTasks(visible, opts.sort, opts.dir)
  if (opts.group === 'none') return [{ key: 'all', title: '', tasks: sorted }]
  return groupTasks(sorted, opts.group, ctx)
}
