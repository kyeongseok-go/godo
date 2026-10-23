import { GodoDB } from './db'
import { adoptLegacyData, LEGACY_DB_NAME } from './legacy'
import { makeProject, makeTask } from '../test/factories'

let seq = 0
let db: GodoDB

beforeEach(() => {
  db = new GodoDB(`adopt-test-${++seq}`)
})

afterEach(async () => {
  db.close()
  await GodoDB.delete(db.name)
  await GodoDB.delete(LEGACY_DB_NAME)
})

/** 옛 이름으로 저장돼 있던 데이터를 만든다. */
async function seedLegacy(): Promise<void> {
  const legacy = new GodoDB(LEGACY_DB_NAME)
  await legacy.open()
  await legacy.tasks.put(makeTask({ id: 'old-task', title: '옛 이름으로 저장한 일' }))
  await legacy.projects.put(makeProject({ id: 'old-project', name: '옛 프로젝트' }))
  legacy.close()
}

const names = async (): Promise<string[]> =>
  (await indexedDB.databases()).map((info) => info.name ?? '').filter((name) => name !== '')

describe('옛 이름 데이터베이스 이관', () => {
  it('옛 DB 의 행을 새 DB 로 옮기고 옛 DB 를 지운다', async () => {
    await seedLegacy()

    const copied = await adoptLegacyData(db)

    expect(copied).toBe(2)
    expect((await db.tasks.get('old-task'))?.title).toBe('옛 이름으로 저장한 일')
    expect((await db.projects.get('old-project'))?.name).toBe('옛 프로젝트')
    expect(await names()).not.toContain(LEGACY_DB_NAME)
  })

  it('옛 DB 가 없으면 아무것도 하지 않는다', async () => {
    const copied = await adoptLegacyData(db)

    expect(copied).toBe(0)
    expect(await db.tasks.count()).toBe(0)
  })

  it('새 DB 에 이미 데이터가 있으면 덮어쓰지 않고 옛 DB 만 지운다', async () => {
    await seedLegacy()
    await db.tasks.put(makeTask({ id: 'mine', title: '새 이름으로 저장한 일' }))

    const copied = await adoptLegacyData(db)

    expect(copied).toBe(0)
    expect(await db.tasks.get('old-task')).toBeUndefined()
    expect((await db.tasks.get('mine'))?.title).toBe('새 이름으로 저장한 일')
    expect(await names()).not.toContain(LEGACY_DB_NAME)
  })
})
