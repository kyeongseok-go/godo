import { describe, expect, it } from 'vitest'
import { createBackup, emptyAppData, serializeBackup } from '../../domain/exchange'
import { makeTask } from '../../test/factories'
import { analyzeImportText, checkImportSize, MAX_IMPORT_BYTES } from './analyzeImport'

let n = 0
const ctx = { nowMs: 1_000, today: '2026-10-23', newId: () => `id-${++n}` }

const backupText = (tasks = [makeTask({ id: 'a', title: '우유 사기' })]) =>
  serializeBackup(createBackup({ ...emptyAppData(), tasks }, '2026-10-23T00:00:00.000Z'))

describe('analyzeImportText', () => {
  it('reads a Pace JSON backup', () => {
    const result = analyzeImportText('pace-backup-2026-10-23.json', backupText(), ctx)

    expect(result.ok && result.value.kind === 'json' && result.value.data.tasks.map((t) => t.title)).toEqual(['우유 사기'])
    expect(result.ok && result.value.kind === 'json' && result.value.exportedAt).toBe('2026-10-23T00:00:00.000Z')
  })

  it('treats a file with an unknown extension as JSON when it looks like JSON', () => {
    const result = analyzeImportText('backup.txt', backupText(), ctx)

    expect(result.ok && result.value.kind).toBe('json')
  })

  it('reads a Todoist CSV into tasks and sections', () => {
    const csv = ['TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT', 'section,준비,,,', 'task,박스 구하기,,1,1', 'task,테이프,,4,2'].join('\n')

    const result = analyzeImportText('이사.CSV', csv, ctx)

    expect(result.ok && result.value.kind === 'csv' && result.value.parsed.tasks.map((t) => t.title)).toEqual(['박스 구하기', '테이프'])
    expect(result.ok && result.value.kind === 'csv' && result.value.parsed.sections.map((s) => s.name)).toEqual(['준비'])
  })

  it('carries parse warnings through', () => {
    const csv = ['TYPE,CONTENT,DATE', 'task,할 일,언젠가 곧'].join('\n')

    const result = analyzeImportText('a.csv', csv, ctx)

    expect(result.ok && result.warnings.length).toBeGreaterThan(0)
  })

  it('returns a Korean error for broken JSON', () => {
    const result = analyzeImportText('a.json', '{깨짐', ctx)

    expect(result).toEqual({ ok: false, error: expect.stringContaining('JSON 형식이 올바르지 않아요') })
  })

  it('returns an error for a JSON file that is not a Pace backup', () => {
    const result = analyzeImportText('a.json', JSON.stringify({ hello: 'world' }), ctx)

    expect(result.ok).toBe(false)
  })

  it('returns an error for a blank file of any kind', () => {
    expect(analyzeImportText('a.csv', '', ctx)).toEqual({ ok: false, error: '파일 내용이 비어 있어요.' })
    expect(analyzeImportText('a.json', '   ', ctx).ok).toBe(false)
  })

  it('returns the CSV header error when the columns are missing', () => {
    const result = analyzeImportText('a.csv', 'a,b\n1,2', ctx)

    expect(result.ok === false && result.error).toContain('TYPE, CONTENT')
  })
})

describe('checkImportSize', () => {
  it('accepts normal files', () => {
    expect(checkImportSize(1024)).toBeNull()
  })

  it('rejects empty files', () => {
    expect(checkImportSize(0)).toBe('빈 파일이에요. 다른 파일을 골라 주세요.')
  })

  it('rejects files over the limit with the limit in the message', () => {
    expect(checkImportSize(MAX_IMPORT_BYTES + 1)).toContain('50MB')
  })
})
