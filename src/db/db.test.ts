import { PaceDB } from './db'
import { defaultSettings } from '../store/defaults'

// 이미 쓰고 있던 브라우저의 DB(v1)를 열 때, 새로 생긴 필드가 undefined 로 앱에 흘러들지 않아야 한다.
describe('스키마 마이그레이션 v1 → v2', () => {
  const name = 'migration-test'

  afterEach(async () => {
    await PaceDB.delete(name)
  })

  test('예전 습관에 block, 예전 설정에 frames 를 채운다', async () => {
    const { default: Dexie } = await import('dexie')
    const old = new Dexie(name)
    old.version(1).stores({
      tasks: 'id, projectId, parentId, status, startDate, dueDate, deletedAt, updatedAt',
      projects: 'id, parentId',
      sections: 'id, projectId',
      labels: 'id',
      filters: 'id',
      comments: 'id, taskId',
      activity: 'id, taskId, at',
      templates: 'id',
      habits: 'id',
      countdowns: 'id',
      focusSessions: 'id, taskId, startedAt',
      dayPlans: 'date',
      settings: 'id',
      snapshots: 'id, createdAt',
    })
    await old.open()
    const { frames: _frames, ...settingsWithoutFrames } = defaultSettings()
    await old.table('habits').put({
      id: 'h1',
      name: '예전 습관',
      icon: null,
      color: '#2f6f5e',
      frequency: { type: 'daily' },
      goal: { kind: 'check', target: 1, unit: null },
      startDate: '2026-10-01',
      group: null,
      reminderTime: null,
      archived: false,
      logs: {},
      order: 1000,
    })
    await old.table('settings').put(settingsWithoutFrames)
    old.close()

    const db = new PaceDB(name)
    await db.open()
    const habit = await db.habits.get('h1')
    const settings = await db.settings.get('settings')
    db.close()

    expect(habit?.block).toBeNull()
    expect(settings?.frames).toEqual([])
  })
})
