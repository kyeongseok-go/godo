import { PaceDB } from '../../db/db'
import { loadAll, persistChanges, persistSettings } from '../../db/persist'
import { emptyAppData } from '../../domain/exchange'
import type { AppData } from '../../domain/exchange'
import { defaultSettings } from '../../store/defaults'
import { makeLabel, makeProject, makeSection, makeTask } from '../../test/factories'
import { buildCsvImportData, importAppData, readAppData, wipeAllData } from './importer'
import { createSnapshot, listSnapshots } from './snapshots'

let seq = 0
let db: PaceDB
let ids = 0
const ctx = () => ({ nowMs: 1_000, newId: () => `new-${++ids}` })

beforeEach(async () => {
  db = new PaceDB(`importer-test-${++seq}`)
  ids = 0
  await persistChanges(db, {
    puts: {
      tasks: [makeTask({ id: 'old', title: '기존 할 일', updatedAt: 10 })],
      labels: [makeLabel({ id: 'l-old' })],
    },
    deletes: {},
  })
  await persistSettings(db, { ...defaultSettings(), theme: 'dark' })
})

afterEach(async () => {
  db.close()
  await PaceDB.delete(db.name)
})

const incoming = (patch: Partial<AppData>): AppData => ({ ...emptyAppData(), ...patch })

describe('readAppData', () => {
  it('reads every table and the settings from the database', async () => {
    const data = await readAppData(db)

    expect(data.tasks.map((t) => t.id)).toEqual(['old'])
    expect(data.settings?.theme).toBe('dark')
  })
})

describe('importAppData merge', () => {
  it('adds new rows and keeps existing ones', async () => {
    const result = await importAppData(db, incoming({ tasks: [makeTask({ id: 'new', title: '새 할 일' })] }), 'merge', ctx())

    const { entities } = await loadAll(db)
    expect(Object.keys(entities.tasks).sort()).toEqual(['new', 'old'])
    expect(Object.keys(entities.labels)).toEqual(['l-old'])
    expect(result).toEqual({ added: 1, updated: 0 })
  })

  it('lets a newer incoming row win', async () => {
    const newer = makeTask({ id: 'old', title: '바뀐 제목', updatedAt: 99 })

    const result = await importAppData(db, incoming({ tasks: [newer] }), 'merge', ctx())

    expect((await db.tasks.get('old'))?.title).toBe('바뀐 제목')
    expect(result.updated).toBe(1)
  })

  it('does not take a safety snapshot', async () => {
    await importAppData(db, incoming({}), 'merge', ctx())

    expect(await listSnapshots(db)).toEqual([])
  })
})

describe('importAppData replace', () => {
  it('removes rows that are not in the incoming data', async () => {
    const data = incoming({ tasks: [makeTask({ id: 'only' })], settings: { ...defaultSettings(), theme: 'light' } })

    await importAppData(db, data, 'replace', ctx())

    const { entities, settings } = await loadAll(db)
    expect(Object.keys(entities.tasks)).toEqual(['only'])
    expect(Object.keys(entities.labels)).toEqual([])
    expect(settings?.theme).toBe('light')
  })

  it('clears settings when the backup has none so defaults return on reload', async () => {
    await importAppData(db, incoming({}), 'replace', ctx())

    expect((await loadAll(db)).settings).toBeNull()
  })

  it('keeps the current data as a safety snapshot first', async () => {
    await importAppData(db, incoming({}), 'replace', ctx())

    const snapshots = await listSnapshots(db)
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0].id).toBe('new-1')
    expect(snapshots[0].createdAt).toBe(1_000)
  })

  it('leaves the database untouched when the snapshot cannot be written', async () => {
    vi.spyOn(db.snapshots, 'put').mockRejectedValueOnce(new Error('저장 공간 부족'))

    await expect(importAppData(db, incoming({}), 'replace', ctx())).rejects.toThrow('저장 공간 부족')

    expect(Object.keys((await loadAll(db)).entities.tasks)).toEqual(['old'])
  })

  it('repairs tasks that point at missing projects', async () => {
    const orphan = makeTask({ id: 'orphan', projectId: 'ghost' })

    await importAppData(db, incoming({ tasks: [orphan] }), 'replace', ctx())

    expect((await db.tasks.get('orphan'))?.projectId).toBe('inbox')
  })
})

describe('buildCsvImportData', () => {
  it('wraps parsed tasks and sections in a brand-new project', () => {
    const task = makeTask({ id: 't1', projectId: '' })
    const section = makeSection({ id: 's1', projectId: '' })

    const data = buildCsvImportData(
      { tasks: [task], sections: [section] },
      { projectName: '  할 일 모음 ', color: '#2b4c7e', order: 4000, nowMs: 5, newId: () => 'proj-1' },
    )

    expect(data.projects).toEqual([
      expect.objectContaining({ id: 'proj-1', name: '할 일 모음', color: '#2b4c7e', order: 4000, createdAt: 5, parentId: null }),
    ])
    expect(data.tasks[0].projectId).toBe('proj-1')
    expect(data.sections[0].projectId).toBe('proj-1')
    expect(data.settings).toBeNull()
  })

  it('does not mutate the parsed input', () => {
    const task = makeTask({ id: 't1', projectId: '' })

    buildCsvImportData({ tasks: [task], sections: [] }, { projectName: 'a', color: '#000', order: 1, nowMs: 1, newId: () => 'p' })

    expect(task.projectId).toBe('')
  })

  it('falls back to a default name when blank', () => {
    const data = buildCsvImportData({ tasks: [], sections: [] }, { projectName: '   ', color: '#000', order: 1, nowMs: 1, newId: () => 'p' })

    expect(data.projects[0].name).toBe('가져온 할 일')
  })

  it('imports as a merge without touching existing rows', async () => {
    const csvData = buildCsvImportData(
      { tasks: [makeTask({ id: 't1', projectId: '' })], sections: [] },
      { projectName: '가져옴', color: '#000', order: 9, nowMs: 5, newId: () => 'proj-x' },
    )

    await importAppData(db, csvData, 'merge', ctx())

    const { entities } = await loadAll(db)
    expect(Object.keys(entities.tasks).sort()).toEqual(['old', 't1'])
    expect(entities.projects['proj-x'].name).toBe('가져옴')
    expect((await loadAll(db)).settings?.theme).toBe('dark')
  })
})

describe('wipeAllData', () => {
  it('clears every table, the settings and the snapshots', async () => {
    await createSnapshot(db, emptyAppData(), 1, 's1')
    await createProjectRow()

    await wipeAllData(db)

    const { entities, settings } = await loadAll(db)
    expect(Object.keys(entities.tasks)).toEqual([])
    expect(Object.keys(entities.projects)).toEqual([])
    expect(settings).toBeNull()
    expect(await listSnapshots(db)).toEqual([])
  })
})

async function createProjectRow(): Promise<void> {
  await persistChanges(db, { puts: { projects: [makeProject({ id: 'p1' })] }, deletes: {} })
}
