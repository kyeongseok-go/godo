// 스토어 상태 ↔ 백업용 AppData 변환. 순수 함수만 둔다(DB·DOM 접근 금지).
import type { AppData } from '../../domain/exchange'
import type { Settings } from '../../domain/types'
import { keyOf, TABLE_NAMES } from '../../store/changes'
import type { ChangeSet, EntityState, TableMap, TableName } from '../../store/changes'

export interface AppDataSource {
  entities: EntityState
  /** DB 에서 읽은 직후에는 설정이 아직 없을 수 있다 */
  settings: Settings | null
}

/** 현재 스토어 상태를 백업·내보내기에 쓰는 AppData 로 모은다. 휴지통 항목도 포함한다. */
export function collectAppData(state: AppDataSource): AppData {
  const { entities } = state
  return {
    tasks: Object.values(entities.tasks),
    projects: Object.values(entities.projects),
    sections: Object.values(entities.sections),
    labels: Object.values(entities.labels),
    filters: Object.values(entities.filters),
    comments: Object.values(entities.comments),
    activity: Object.values(entities.activity),
    templates: Object.values(entities.templates),
    habits: Object.values(entities.habits),
    countdowns: Object.values(entities.countdowns),
    focusSessions: Object.values(entities.focusSessions),
    dayPlans: Object.values(entities.dayPlans),
    settings: state.settings,
  }
}

function rowsOf<K extends TableName>(data: AppData, name: K): TableMap[K][] {
  return data[name] as TableMap[K][]
}

/**
 * before → after 로 바뀐 부분만 ChangeSet 으로 만든다. 병합 가져오기에서 바뀐 행만 쓰려는 용도다.
 * 같은 객체(참조)는 건너뛴다. applyImport 가 기존 항목을 그대로 유지하기 때문에 성립한다.
 */
export function appDataChanges(before: AppData, after: AppData): ChangeSet {
  const puts: Record<string, unknown[]> = {}
  const deletes: Record<string, string[]> = {}

  for (const name of TABLE_NAMES) {
    const oldRows = rowsOf(before, name)
    const newRows = rowsOf(after, name)
    const oldSet = new Set<unknown>(oldRows)
    const newKeys = new Set(newRows.map((row) => keyOf(name, row)))

    const changed = newRows.filter((row) => !oldSet.has(row))
    const removed = oldRows.map((row) => keyOf(name, row)).filter((key) => !newKeys.has(key))
    if (changed.length > 0) puts[name] = changed
    if (removed.length > 0) deletes[name] = removed
  }
  return { puts, deletes } as ChangeSet
}

export interface DataCount {
  key: TableName
  label: string
  count: number
}

const COUNT_LABELS: ReadonlyArray<readonly [TableName, string]> = [
  ['tasks', '할 일'],
  ['projects', '프로젝트'],
  ['sections', '섹션'],
  ['labels', '라벨'],
  ['filters', '필터'],
  ['comments', '댓글'],
  ['templates', '템플릿'],
  ['habits', '습관'],
  ['countdowns', '디데이'],
  ['focusSessions', '집중 기록'],
  ['dayPlans', '하루 계획'],
]

/** 가져오기 미리보기에 보여 줄 항목별 개수. 0개인 항목은 뺀다. */
export function summarizeAppData(data: AppData): DataCount[] {
  return COUNT_LABELS.flatMap(([key, label]) => {
    const count = rowsOf(data, key).length
    return count > 0 ? [{ key, label, count }] : []
  })
}
