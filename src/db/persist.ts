import { emptyEntityState, TABLE_NAMES } from '../store/changes'
import type { ChangeSet, EntityState, TableMap, TableName } from '../store/changes'
import { keyOf } from '../store/changes'
import type { Settings } from '../domain/types'
import type { PaceDB } from './db'

export interface LoadedData {
  entities: EntityState
  settings: Settings | null
}

export async function loadAll(db: PaceDB): Promise<LoadedData> {
  const entities = emptyEntityState() as { [K in TableName]: Record<string, TableMap[K]> }
  // 모든 테이블을 하나의 읽기 트랜잭션으로 읽는다. 따로 읽으면 읽는 도중 들어온 쓰기 때문에
  // 테이블끼리 시점이 어긋난 스냅샷(예: 새 작업은 있는데 그 프로젝트가 없음)이 만들어질 수 있다.
  const settings = await db.transaction('r', [...TABLE_NAMES.map((t) => db.table(t)), db.settings], async () => {
    await Promise.all(
      TABLE_NAMES.map(async (name) => {
        const rows = (await db.table(name).toArray()) as TableMap[typeof name][]
        const table: Record<string, TableMap[typeof name]> = {}
        for (const row of rows) table[keyOf(name, row)] = row
        ;(entities as Record<string, unknown>)[name] = table
      }),
    )
    return (await db.settings.get('settings')) ?? null
  })
  return { entities, settings }
}

/** 변경 집합을 한 트랜잭션으로 기록한다. 일부만 저장되는 상태를 만들지 않으려는 것이다. */
export async function persistChanges(db: PaceDB, cs: ChangeSet): Promise<void> {
  const tables = TABLE_NAMES.filter(
    (t) => (cs.puts[t]?.length ?? 0) > 0 || (cs.deletes[t]?.length ?? 0) > 0,
  )
  if (tables.length === 0) return
  await db.transaction('rw', tables.map((t) => db.table(t)), async () => {
    for (const t of tables) {
      const table = db.table(t)
      const dels = cs.deletes[t]
      if (dels?.length) await table.bulkDelete([...dels])
      const puts = cs.puts[t]
      if (puts?.length) await table.bulkPut([...puts])
    }
  })
}

export async function persistSettings(db: PaceDB, settings: Settings): Promise<void> {
  await db.settings.put(settings)
}

/** 모든 데이터를 지운다(가져오기에서 "덮어쓰기"를 고를 때 사용). */
export async function clearAll(db: PaceDB): Promise<void> {
  await db.transaction('rw', [...TABLE_NAMES.map((t) => db.table(t)), db.settings], async () => {
    await Promise.all(TABLE_NAMES.map((t) => db.table(t).clear()))
    await db.settings.clear()
  })
}
