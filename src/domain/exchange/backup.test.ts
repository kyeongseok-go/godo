import { describe, expect, it } from 'vitest'
import { makeLabel, makeProject, makeSection, makeTask } from '../../test/factories'
import type { Settings } from '../types'
import {
  BACKUP_VERSION,
  createBackup,
  emptyAppData,
  parseBackup,
  serializeBackup,
  type AppData,
} from './index'

const NOW_ISO = '2026-10-23T12:00:00.000Z'

const fullSettings = (): Settings => ({
  id: 'settings',
  timeZone: 'Asia/Seoul',
  weekStartsOn: 1,
  timeFormat: '24h',
  dateFormat: 'YMD',
  dayStartHour: 4,
  theme: 'auto',
  accent: '#d9421c',
  density: 'comfortable',
  homeView: 'today',
  defaultProjectId: 'inbox',
  defaultStartDate: 'today',
  defaultReminderOffsetMin: 10,
  defaultDurationMin: 30,
  smartParsing: true,
  hideFutureTasks: false,
  showCompleted: true,
  workStart: '09:00',
  workEnd: '18:00',
  bufferMin: 5,
  dailyCapacityMin: 360,
  carryOverArchiveDays: 7,
  frames: [],
  modules: { calendar: true, matrix: true, habits: true, focus: true, countdown: true, timeline: true },
  sidebar: { showToday: true, showUpcoming: true, showAnytime: true, showSomeday: true, showCompleted: true, showCounts: true },
  pomodoro: { focusMin: 25, shortBreakMin: 5, longBreakMin: 15, longBreakEvery: 4, autoStart: false, sound: true },
  productivity: { karmaEnabled: true, dailyGoal: 5, weeklyGoal: 30, daysOff: [0, 6], vacationMode: false },
  shortcuts: { 'quick-add': 'q' },
})

function richData(): AppData {
  return {
    tasks: [
      makeTask({
        id: 't1',
        title: '주간 보고',
        startDate: '2026-10-20',
        startTime: '09:00',
        durationMin: 30,
        dayPart: 'morning',
        labelIds: ['l1'],
        actualMin: { '2026-10-20': 25 },
        recurrence: {
          freq: 'weekly',
          interval: 1,
          byWeekday: [1],
          anchor: 'due',
          end: { type: 'count', count: 3 },
          resetSubtasks: false,
          skipDates: ['2026-10-26'],
        },
        reminders: [
          { id: 'r1', kind: 'relative', offsetMin: 10 },
          { id: 'r2', kind: 'absolute', at: 5 },
        ],
      }),
    ],
    projects: [makeProject({ id: 'p1' })],
    sections: [makeSection({ id: 's1', projectId: 'p1', category: 'active' })],
    labels: [makeLabel({ id: 'l1' })],
    filters: [{ id: 'f1', name: '오늘', query: 'today', color: '#000000', favorite: true, order: 0 }],
    comments: [{ id: 'c1', taskId: 't1', body: '메모', createdAt: 1 }],
    activity: [{ id: 'a1', taskId: 't1', type: 'created', summary: '만들었어요', at: 1 }],
    templates: [{ id: 'tp1', name: '템플릿', kind: 'task', payload: { nested: [1, 2, { x: true }] }, createdAt: 1 }],
    habits: [
      {
        id: 'h1',
        name: '운동',
        icon: null,
        color: '#2f6f5e',
        frequency: { type: 'weekdays', days: [1, 3, 5] },
        goal: { kind: 'check', target: 1, unit: null },
        startDate: '2026-10-01',
        group: null,
        reminderTime: '07:00',
        block: null,
        archived: false,
        logs: { '2026-10-02': 1 },
        order: 0,
      },
    ],
    countdowns: [{ id: 'cd1', name: '시험', date: '2026-12-01', color: '#000000', repeatYearly: false, order: 0 }],
    focusSessions: [{ id: 'fs1', taskId: 't1', kind: 'pomodoro', startedAt: 1, durationSec: 1500, completed: true }],
    dayPlans: [
      {
        date: '2026-10-23',
        capacityMin: 300,
        highlightIds: ['t1'],
        morningDoneAt: 1,
        eveningDoneAt: null,
        reflection: '',
      },
    ],
    settings: fullSettings(),
  }
}

const backupJson = (data: unknown, extra: Record<string, unknown> = {}): string =>
  JSON.stringify({ app: 'pace', version: BACKUP_VERSION, exportedAt: NOW_ISO, data, ...extra })

const expectOk = <T>(r: { ok: boolean } & Record<string, unknown>): T => {
  expect(r.ok).toBe(true)
  return r as unknown as T
}

describe('emptyAppData', () => {
  it('has an empty list for every collection and null settings', () => {
    const empty = emptyAppData()
    expect(empty.settings).toBeNull()
    expect(Object.entries(empty).filter(([k]) => k !== 'settings').every(([, v]) => Array.isArray(v) && v.length === 0)).toBe(true)
    expect(Object.keys(empty)).toHaveLength(13)
  })

  it('returns fresh arrays on every call', () => {
    expect(emptyAppData().tasks).not.toBe(emptyAppData().tasks)
  })
})

describe('createBackup / serializeBackup', () => {
  it('wraps the data with app name, version and export time', () => {
    const file = createBackup(emptyAppData(), NOW_ISO)
    expect(file).toEqual({ app: 'pace', version: BACKUP_VERSION, exportedAt: NOW_ISO, data: emptyAppData() })
  })

  it('does not share the top-level object with the input', () => {
    const data = emptyAppData()
    expect(createBackup(data, NOW_ISO).data).not.toBe(data)
  })

  it('writes human readable JSON indented by two spaces', () => {
    const text = serializeBackup(createBackup(emptyAppData(), NOW_ISO))
    expect(text.startsWith('{\n  "app": "pace",')).toBe(true)
  })
})

describe('parseBackup', () => {
  it('round-trips every entity type', () => {
    const data = richData()
    const result = parseBackup(serializeBackup(createBackup(data, NOW_ISO)))

    expect(result).toEqual({
      ok: true,
      value: { app: 'pace', version: BACKUP_VERSION, exportedAt: NOW_ISO, data },
      warnings: [],
    })
  })

  it('rejects text that is not JSON', () => {
    const result = parseBackup('{ nope')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('JSON')
  })

  it('rejects JSON that is not an object', () => {
    expect(parseBackup('[1,2]').ok).toBe(false)
    expect(parseBackup('null').ok).toBe(false)
    expect(parseBackup('"text"').ok).toBe(false)
  })

  it('rejects files made by another app', () => {
    const result = parseBackup(JSON.stringify({ app: 'todoist', version: 1, exportedAt: NOW_ISO, data: {} }))
    expect(result).toEqual({ ok: false, error: 'Pace 백업 파일이 아니에요.' })
  })

  it('rejects a version newer than the app supports', () => {
    const result = parseBackup(backupJson({}, { version: BACKUP_VERSION + 1 }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('더 새로운 버전')
  })

  it('rejects an invalid version value', () => {
    for (const version of ['1', -1, 1.5, null]) {
      expect(parseBackup(backupJson({}, { version })).ok).toBe(false)
    }
  })

  it('rejects a missing or invalid exportedAt', () => {
    expect(parseBackup(backupJson({}, { exportedAt: 'yesterday' })).ok).toBe(false)
    expect(parseBackup(JSON.stringify({ app: 'pace', version: 1, data: {} })).ok).toBe(false)
  })

  it('rejects a missing or non-object data field', () => {
    expect(parseBackup(JSON.stringify({ app: 'pace', version: 1, exportedAt: NOW_ISO })).ok).toBe(false)
    expect(parseBackup(backupJson([])).ok).toBe(false)
  })

  it('rejects a collection that is not a list', () => {
    const result = parseBackup(backupJson({ tasks: 'many' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('작업')
  })

  it('treats missing collections as empty', () => {
    const result = expectOk<{ value: { data: AppData }; warnings: string[] }>(parseBackup(backupJson({})))
    expect(result.value.data).toEqual(emptyAppData())
    expect(result.warnings).toEqual([])
  })

  it('drops unknown extra fields', () => {
    const data = richData()
    const noisy = {
      ...data,
      extraCollection: [1],
      tasks: data.tasks.map((t) => ({ ...t, secretNote: 'x' })),
      settings: { ...data.settings, futureFlag: true },
    }
    const result = expectOk<{ value: { data: AppData } }>(parseBackup(backupJson(noisy, { extra: 1 })))

    expect(result.value).not.toHaveProperty('extra')
    expect(result.value.data).toEqual(data)
    expect(result.value.data).not.toHaveProperty('extraCollection')
  })

  it('skips only the broken tasks and warns with the count', () => {
    const good = makeTask({ id: 'good' })
    const data = {
      ...emptyAppData(),
      tasks: [
        good,
        { ...makeTask({ id: 'bad1' }), priority: 9 },
        { ...makeTask({ id: 'bad2' }), title: 42 },
        'not even an object',
        null,
        makeTask({ id: 'good2' }),
      ],
    }
    const result = expectOk<{ value: { data: AppData }; warnings: string[] }>(parseBackup(backupJson(data)))

    expect(result.value.data.tasks.map((t) => t.id)).toEqual(['good', 'good2'])
    expect(result.warnings).toEqual(['작업 4개를 건너뛰었어요'])
  })

  it('rejects invalid dates inside a task and skips that task', () => {
    const data = { ...emptyAppData(), tasks: [{ ...makeTask({ id: 'x' }), startDate: '2026-02-30' }] }
    const result = expectOk<{ value: { data: AppData }; warnings: string[] }>(parseBackup(backupJson(data)))
    expect(result.value.data.tasks).toEqual([])
    expect(result.warnings).toEqual(['작업 1개를 건너뛰었어요'])
  })

  it('skips a task whose actualMin has a key that is not a date', () => {
    const data = { ...emptyAppData(), tasks: [{ ...makeTask({ id: 'x' }), actualMin: { yesterday: 30 } }] }
    const result = expectOk<{ value: { data: AppData }; warnings: string[] }>(parseBackup(backupJson(data)))
    expect(result.value.data.tasks).toEqual([])
    expect(result.warnings).toEqual(['작업 1개를 건너뛰었어요'])
  })

  it('reports skipped items of other collections with their own name', () => {
    const data = {
      ...emptyAppData(),
      projects: [makeProject({ id: 'ok' }), { id: 'broken' }],
      labels: [{ nope: true }],
    }
    const result = expectOk<{ value: { data: AppData }; warnings: string[] }>(parseBackup(backupJson(data)))

    expect(result.value.data.projects.map((p) => p.id)).toEqual(['ok'])
    expect(result.warnings).toEqual(['프로젝트 1개를 건너뛰었어요', '라벨 1개를 건너뛰었어요'])
  })

  it('drops invalid settings with a warning instead of failing', () => {
    const result = expectOk<{ value: { data: AppData }; warnings: string[] }>(
      parseBackup(backupJson({ settings: { id: 'settings', accent: 3 } })),
    )
    expect(result.value.data.settings).toBeNull()
    expect(result.warnings).toEqual(['설정을 읽지 못해 건너뛰었어요'])
  })

  it('accepts null settings without a warning', () => {
    const result = expectOk<{ warnings: string[] }>(parseBackup(backupJson({ settings: null })))
    expect(result.warnings).toEqual([])
  })

  it('migrates an older version file up to the current version', () => {
    const v0Task: Record<string, unknown> = { ...makeTask({ id: 'old', dueDate: '2026-10-30' }) }
    delete v0Task.startDate
    const text = JSON.stringify({ app: 'pace', version: 0, exportedAt: NOW_ISO, data: { tasks: [v0Task] } })

    const result = expectOk<{ value: { version: number; data: AppData } }>(parseBackup(text))

    expect(result.value.version).toBe(BACKUP_VERSION)
    expect(result.value.data.tasks[0].startDate).toBe('2026-10-30')
  })
})
