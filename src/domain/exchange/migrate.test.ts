import { describe, expect, it } from 'vitest'
import { makeTask } from '../../test/factories'
import { BACKUP_VERSION } from './model'
import { applyMigrations, migrateBackup, type MigrationStep } from './migrate'

const NOW_ISO = '2026-10-23T12:00:00.000Z'

/** v0 형식: 작업에 startDate 가 아예 없다. */
function v0Task(overrides: Record<string, unknown>): Record<string, unknown> {
  const base: Record<string, unknown> = { ...makeTask() }
  delete base.startDate
  return { ...base, ...overrides }
}

const v0File = (tasks: unknown[]): unknown => ({
  app: 'pace',
  version: 0,
  exportedAt: NOW_ISO,
  data: { tasks },
})

describe('migrateBackup (v0 -> v1)', () => {
  it('copies dueDate into startDate and keeps dueDate', () => {
    const result = migrateBackup(v0File([v0Task({ id: 'a', dueDate: '2026-11-02' })]))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.version).toBe(BACKUP_VERSION)
    expect(result.value.data.tasks[0].startDate).toBe('2026-11-02')
    expect(result.value.data.tasks[0].dueDate).toBe('2026-11-02')
  })

  it('leaves startDate empty when v0 had no dueDate either', () => {
    const result = migrateBackup(v0File([v0Task({ id: 'a', dueDate: null })]))
    expect(result.ok && result.value.data.tasks[0].startDate).toBeNull()
  })

  it('does not overwrite a startDate that already exists', () => {
    const task = { ...v0Task({ id: 'a', dueDate: '2026-11-02' }), startDate: '2026-10-30' }
    const result = migrateBackup(v0File([task]))
    expect(result.ok && result.value.data.tasks[0].startDate).toBe('2026-10-30')
  })

  it('keeps non-object entries so the validator can skip them', () => {
    const result = migrateBackup(v0File([v0Task({ id: 'a' }), 'junk']))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.data.tasks).toHaveLength(1)
      expect(result.warnings).toEqual(['작업 1개를 건너뛰었어요'])
    }
  })

  it('does not mutate the raw input', () => {
    const raw = v0File([v0Task({ id: 'a', dueDate: '2026-11-02' })])
    const before = JSON.stringify(raw)
    migrateBackup(raw)
    expect(JSON.stringify(raw)).toBe(before)
  })
})

describe('migrateBackup (current version)', () => {
  it('passes a v1 file through unchanged', () => {
    const task = makeTask({ id: 'a', startDate: '2026-10-01' })
    const result = migrateBackup({ app: 'pace', version: BACKUP_VERSION, exportedAt: NOW_ISO, data: { tasks: [task] } })
    expect(result.ok && result.value.data.tasks).toEqual([task])
  })

  it('rejects input that is not a backup envelope', () => {
    expect(migrateBackup(undefined).ok).toBe(false)
    expect(migrateBackup({ app: 'pace' }).ok).toBe(false)
  })
})

describe('applyMigrations', () => {
  const addMark =
    (mark: string): MigrationStep =>
    (data) => ({ ...data, marks: [...(Array.isArray(data.marks) ? data.marks : []), mark] })

  it('runs the steps in order from the file version up to the target', () => {
    const steps: Readonly<Record<number, MigrationStep>> = { 1: addMark('1->2'), 2: addMark('2->3') }
    const result = applyMigrations({}, 1, 3, steps)
    expect(result).toEqual({ ok: true, value: { marks: ['1->2', '2->3'] } })
  })

  it('skips steps that are older than the file version', () => {
    const steps: Readonly<Record<number, MigrationStep>> = { 0: addMark('0->1'), 1: addMark('1->2') }
    expect(applyMigrations({}, 1, 2, steps)).toEqual({ ok: true, value: { marks: ['1->2'] } })
  })

  it('returns the data as is when it is already at the target version', () => {
    const data = { a: 1 }
    expect(applyMigrations(data, 2, 2, {})).toEqual({ ok: true, value: data })
  })

  it('fails with a Korean message when a step is missing', () => {
    const result = applyMigrations({}, 1, 3, { 1: addMark('1->2') })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('v2')
  })
})
