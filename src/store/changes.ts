// 변경 집합(ChangeSet): 모든 쓰기를 "넣기/지우기" 묶음 하나로 표현한다.
// 적용하면 되돌리기용 역변경(inverse)도 함께 나오므로, 실행 취소·다시 실행이 같은 경로를 탄다.
import type {
  ActivityLog,
  Comment,
  Countdown,
  DayPlan,
  FocusSession,
  Habit,
  Label,
  Project,
  SavedFilter,
  Section,
  Task,
  Template,
} from '../domain/types'

export interface TableMap {
  tasks: Task
  projects: Project
  sections: Section
  labels: Label
  filters: SavedFilter
  comments: Comment
  activity: ActivityLog
  templates: Template
  habits: Habit
  countdowns: Countdown
  focusSessions: FocusSession
  dayPlans: DayPlan
}

export type TableName = keyof TableMap

export const TABLE_NAMES: readonly TableName[] = [
  'tasks',
  'projects',
  'sections',
  'labels',
  'filters',
  'comments',
  'activity',
  'templates',
  'habits',
  'countdowns',
  'focusSessions',
  'dayPlans',
]

export type EntityState = { [K in TableName]: Readonly<Record<string, TableMap[K]>> }

export interface ChangeSet {
  puts: { [K in TableName]?: ReadonlyArray<TableMap[K]> }
  deletes: { [K in TableName]?: readonly string[] }
}

export const EMPTY_CHANGES: ChangeSet = { puts: {}, deletes: {} }

export function emptyEntityState(): EntityState {
  return {
    tasks: {},
    projects: {},
    sections: {},
    labels: {},
    filters: {},
    comments: {},
    activity: {},
    templates: {},
    habits: {},
    countdowns: {},
    focusSessions: {},
    dayPlans: {},
  }
}

export function keyOf<K extends TableName>(table: K, entity: TableMap[K]): string {
  return table === 'dayPlans' ? (entity as DayPlan).date : (entity as { id: string }).id
}

export function isEmptyChangeSet(cs: ChangeSet): boolean {
  return TABLE_NAMES.every(
    (t) => (cs.puts[t]?.length ?? 0) === 0 && (cs.deletes[t]?.length ?? 0) === 0,
  )
}

/** 여러 변경 집합을 순서대로 하나로 합친다(나중 것이 우선). 같은 키를 넣고 지우면 마지막 동작만 남는다. */
export function mergeChangeSets(...sets: ChangeSet[]): ChangeSet {
  const puts: Record<string, Map<string, unknown>> = {}
  const deletes: Record<string, Set<string>> = {}
  for (const cs of sets) {
    for (const t of TABLE_NAMES) {
      for (const e of (cs.puts[t] ?? []) as ReadonlyArray<TableMap[typeof t]>) {
        const key = keyOf(t, e)
        ;(puts[t] ??= new Map()).set(key, e)
        deletes[t]?.delete(key)
      }
      for (const id of cs.deletes[t] ?? []) {
        puts[t]?.delete(id)
        ;(deletes[t] ??= new Set()).add(id)
      }
    }
  }
  const out: { puts: Record<string, unknown[]>; deletes: Record<string, string[]> } = { puts: {}, deletes: {} }
  for (const t of TABLE_NAMES) {
    if (puts[t]?.size) out.puts[t] = [...puts[t].values()]
    if (deletes[t]?.size) out.deletes[t] = [...deletes[t]]
  }
  return out as unknown as ChangeSet
}

/** 두 행에서 값이 달라진 필드 이름. 배열·객체는 같은 내용이어도 다른 것으로 본다(되돌려도 값은 같다). */
function changedKeys(forward: object, before: object): string[] {
  const after = forward as unknown as Record<string, unknown>
  const prev = before as unknown as Record<string, unknown>
  const keys = new Set([...Object.keys(after), ...Object.keys(prev)])
  return [...keys].filter((key) => !Object.is(after[key], prev[key]))
}

/**
 * 되돌릴 때 그 변경이 실제로 건드린 필드만 돌려놓도록 역변경을 좁힌다.
 * 역변경은 "그 시점의 행 전체"라서, 그 뒤에 실행 취소에 남기지 않는 쓰기(집중 시간 기록,
 * 순서 재조정 등)가 바꾼 필드까지 함께 되돌려 버린다. 그 필드는 지금 값을 지킨다.
 */
export function narrowInverse(forward: ChangeSet, inverse: ChangeSet, state: EntityState): ChangeSet {
  const puts: Record<string, unknown[]> = {}
  for (const t of TABLE_NAMES) {
    const olds = inverse.puts[t] as ReadonlyArray<TableMap[typeof t]> | undefined
    if (!olds?.length) continue
    const forwardRows = new Map(
      ((forward.puts[t] ?? []) as ReadonlyArray<TableMap[typeof t]>).map((e) => [keyOf(t, e), e]),
    )
    const table = state[t] as Record<string, TableMap[typeof t]>
    puts[t] = olds.map((old) => {
      const key = keyOf(t, old)
      const applied = forwardRows.get(key)
      const current = table[key]
      // 그 변경이 만든 행이 아니거나(지우기의 역) 지금 없는 행이면 통째로 돌려놓는다
      if (applied === undefined || current === undefined) return old
      const touched = changedKeys(applied, old)
      const restored: Record<string, unknown> = { ...current }
      const before = old as unknown as Record<string, unknown>
      for (const field of touched) restored[field] = before[field]
      return restored
    })
  }
  return { puts, deletes: inverse.deletes } as ChangeSet
}

/** 상태에 변경을 적용한다. 원본은 건드리지 않고 바뀐 테이블만 새 객체로 교체한다. */
export function applyChangeSet(
  state: EntityState,
  cs: ChangeSet,
): { next: EntityState; inverse: ChangeSet } {
  const next: { [K in TableName]: Record<string, TableMap[K]> } = { ...state } as never
  const invPuts: Record<string, unknown[]> = {}
  const invDeletes: Record<string, string[]> = {}

  for (const t of TABLE_NAMES) {
    const puts = cs.puts[t] as ReadonlyArray<TableMap[typeof t]> | undefined
    const dels = cs.deletes[t]
    if (!puts?.length && !dels?.length) continue

    const before = state[t] as Record<string, TableMap[typeof t]>
    const table = { ...before }
    const restore: unknown[] = []
    const remove: string[] = []

    for (const id of dels ?? []) {
      const prev = before[id]
      if (prev !== undefined) restore.push(prev)
      delete table[id]
    }
    for (const entity of puts ?? []) {
      const key = keyOf(t, entity)
      const prev = before[key]
      if (prev !== undefined) restore.push(prev)
      else remove.push(key)
      table[key] = entity
    }

    ;(next as Record<string, unknown>)[t] = table
    if (restore.length) invPuts[t] = restore
    if (remove.length) invDeletes[t] = remove
  }

  return {
    next: next as EntityState,
    inverse: { puts: invPuts, deletes: invDeletes } as ChangeSet,
  }
}
