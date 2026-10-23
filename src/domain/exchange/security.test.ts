// 신뢰할 수 없는 파일(백업 JSON, CSV)을 다루는 경로의 보안 회귀 테스트.
import { describe, expect, it } from 'vitest'
import { makeLabel, makeSection, makeTask } from '../../test/factories'
import { isSafePayloadShape, parseBackup, parseTodoistCsv, tasksToCsv } from './index'
import type { Project } from '../types'

const NOW_ISO = '2026-10-23T12:00:00.000Z'
const envelope = (dataJson: string): string => `{"app":"godo","version":1,"exportedAt":"${NOW_ISO}","data":${dataJson}}`

function nested(depth: number): string {
  return '{"children":['.repeat(depth) + ']}'.repeat(depth)
}

const polluted = (): unknown => ({} as Record<string, unknown>).polluted

describe('prototype pollution', () => {
  it('ignores __proto__ keys inside settings.shortcuts without touching Object.prototype', () => {
    parseBackup(envelope('{"settings":{"shortcuts":{"__proto__":"x","polluted":"y"}}}'))

    expect(polluted()).toBeUndefined()
  })

  it('ignores a top-level data.__proto__ object', () => {
    parseBackup(envelope('{"__proto__":{"polluted":"y"},"tasks":[]}'))

    expect(polluted()).toBeUndefined()
  })

  it('ignores __proto__ keys inside a task and a template payload', () => {
    const task = '{"__proto__":{"polluted":"y"},"id":"t1"}'
    const template = '{"id":"tp","name":"n","kind":"task","createdAt":1,"payload":{"__proto__":{"polluted":"y"}}}'
    parseBackup(envelope(`{"tasks":[${task}],"templates":[${template}]}`))

    expect(polluted()).toBeUndefined()
  })
})

describe('isSafePayloadShape', () => {
  it('accepts ordinary nested JSON values', () => {
    expect(isSafePayloadShape({ a: [1, { b: 'x' }], c: null }, { maxDepth: 10, maxContainers: 10 })).toBe(true)
  })

  it('rejects values nested deeper than the limit', () => {
    expect(isSafePayloadShape(JSON.parse(nested(50)), { maxDepth: 40, maxContainers: 1000 })).toBe(false)
  })

  it('rejects values with more containers than the limit', () => {
    expect(isSafePayloadShape(Array.from({ length: 20 }, () => ({})), { maxDepth: 10, maxContainers: 10 })).toBe(false)
  })

  it('does not overflow the stack on extremely deep input', () => {
    expect(isSafePayloadShape(JSON.parse(nested(200_000)), { maxDepth: 128, maxContainers: 100_000 })).toBe(false)
  })
})

describe('template payload in backups', () => {
  const template = (payloadJson: string): string =>
    `{"id":"tp","name":"깊은 템플릿","kind":"task","createdAt":1,"payload":${payloadJson}}`

  it('skips a template whose payload is nested deep enough to crash a recursive parser', () => {
    const result = parseBackup(envelope(`{"templates":[${template(nested(5000))}]}`))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.data.templates).toHaveLength(0)
    expect(result.warnings.join(' ')).toContain('템플릿')
  })

  it('keeps a template with a normal payload', () => {
    const result = parseBackup(envelope(`{"templates":[${template('{"version":1,"root":{"children":[]}}')}]}`))

    expect(result.ok && result.value.data.templates).toHaveLength(1)
  })
})

describe('CSV export formula injection', () => {
  const rowsOf = (csv: string): string[] => csv.split('\n').slice(1)
  const projects: Project[] = []

  it.each(['=HYPERLINK("http://evil.example","x")', '+1+1', '-2+3', '@SUM(1+1)'])(
    'prefixes a task title starting with a formula character (%s)',
    (title) => {
      const csv = tasksToCsv({ tasks: [makeTask({ title })], projects, sections: [], labels: [] })

      const [row] = rowsOf(csv)
      expect(row.startsWith('task,"\'') || row.startsWith("task,'")).toBe(true)
      expect(row).not.toMatch(/^task,"?[=+\-@]/)
    },
  )

  it('neutralises a description that starts with a formula character', () => {
    const csv = tasksToCsv({ tasks: [makeTask({ title: '안전', description: '=cmd|\' /C calc\'!A0' })], projects, sections: [], labels: [] })

    expect(rowsOf(csv)[0]).not.toMatch(/^task,[^,]*,"?=/)
    expect(rowsOf(csv)[0]).toContain("'=cmd")
  })

  it('neutralises a tab or carriage return that some spreadsheets treat as a formula prefix', () => {
    const csv = tasksToCsv({ tasks: [makeTask({ title: '\t=1+1' })], projects, sections: [], labels: [] })

    expect(rowsOf(csv)[0]).toContain("'\t=1+1")
  })

  it('neutralises section names', () => {
    const section = makeSection({ name: '=1+1', projectId: 'inbox' })
    const csv = tasksToCsv({ tasks: [], projects, sections: [section], labels: [] })

    expect(csv).toContain("section,'=1+1")
  })

  it('does not touch ordinary text or dates', () => {
    const csv = tasksToCsv({
      tasks: [makeTask({ title: '장보기 = 우유', description: '메모 - 1', startDate: '2026-10-23' })],
      projects,
      sections: [],
      labels: [makeLabel({ name: 'x' })],
    })

    expect(rowsOf(csv)[0]).toBe('task,장보기 = 우유,메모 - 1,4,1,,,2026-10-23,ko,')
  })

  it('round-trips a guarded title back to the original text on import', () => {
    const title = '-5도 날씨 확인'
    const csv = tasksToCsv({ tasks: [makeTask({ title })], projects, sections: [], labels: [] })

    const parsed = parseTodoistCsv(csv, { projectName: 'p', nowMs: 0, newId: () => 'id', today: '2026-10-23' })

    expect(parsed.ok && parsed.value.tasks[0]?.title).toBe(title)
  })

  it('leaves an ordinary leading apostrophe alone on import', () => {
    const csv = "TYPE,CONTENT,DESCRIPTION\ntask,'안녕,'hello"

    const parsed = parseTodoistCsv(csv, { projectName: 'p', nowMs: 0, newId: () => 'id', today: '2026-10-23' })

    expect(parsed.ok && parsed.value.tasks[0]?.title).toBe("'안녕")
  })

  it('round-trips a title that already starts with an apostrophe before a formula character', () => {
    const title = "'=이미 따옴표로 시작"
    const csv = tasksToCsv({ tasks: [makeTask({ title })], projects, sections: [], labels: [] })

    const parsed = parseTodoistCsv(csv, { projectName: 'p', nowMs: 0, newId: () => 'id', today: '2026-10-23' })

    expect(parsed.ok && parsed.value.tasks[0]?.title).toBe(title)
  })
})
