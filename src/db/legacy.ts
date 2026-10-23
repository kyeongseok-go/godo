// 이름을 godo 로 바꾸기 전에는 데이터베이스 이름이 'pace' 였다.
// 그 이름으로 남아 있는 데이터를 한 번만 새 DB 로 옮기고 옛 DB 를 지운다.
// 쓰던 브라우저에서 앱을 한 번 열었다면 이 파일과 app.ts 의 'ready' 등록을 지워도 된다.
import type Dexie from 'dexie'
import { GodoDB } from './db'
import { TABLE_NAMES } from '../store/changes'

export const LEGACY_DB_NAME = 'pace'

/** 옮겨야 하는 테이블 전체: 엔티티 + 설정 + 자동 백업 스냅샷. */
const ALL_TABLES: readonly string[] = [...TABLE_NAMES, 'settings', 'snapshots']

/** 열어 보지 않고 존재만 확인한다. 없는 이름으로 열면 빈 DB 가 새로 생기기 때문이다. */
async function legacyExists(): Promise<boolean> {
  if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') return false
  const infos = await indexedDB.databases()
  return infos.some((info) => info.name === LEGACY_DB_NAME)
}

async function isEmpty(db: Dexie): Promise<boolean> {
  const counts = await Promise.all(ALL_TABLES.map((name) => db.table(name).count()))
  return counts.every((count) => count === 0)
}

/** 다른 탭이 옛 DB 를 붙들고 있어 막히면 그 탭이 닫힐 때 지워지므로 기다리지 않는다. */
function deleteLegacy(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(LEGACY_DB_NAME)
    request.onsuccess = () => resolve()
    request.onblocked = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('옛 데이터베이스를 지우지 못했어요'))
  })
}

/**
 * 옛 이름의 데이터를 새 DB 로 옮긴다. 옮긴 행 수를 돌려준다.
 * 새 DB 가 비어 있을 때만 옮기므로, 지우기만 실패해 다시 실행돼도 사용자가 그 뒤에 쓴 데이터를 덮지 않는다.
 */
export async function adoptLegacyData(db: Dexie): Promise<number> {
  if (!(await legacyExists())) return 0

  let copied = 0
  if (await isEmpty(db)) {
    const legacy = new GodoDB(LEGACY_DB_NAME)
    try {
      await legacy.open()
      const tables = await Promise.all(ALL_TABLES.map((name) => legacy.table(name).toArray()))
      // 한 트랜잭션으로 넣는다. 중간에 실패하면 아무것도 남지 않아, 다음에 열 때 처음부터 다시 옮긴다.
      await db.transaction(
        'rw',
        ALL_TABLES.map((name) => db.table(name)),
        async () => {
          await Promise.all(
            tables.map((rows, index) => (rows.length > 0 ? db.table(ALL_TABLES[index]).bulkPut(rows) : null)),
          )
        },
      )
      copied = tables.reduce((sum, rows) => sum + rows.length, 0)
    } finally {
      legacy.close()
    }
  }

  await deleteLegacy()
  return copied
}
