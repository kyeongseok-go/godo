import { describe, expect, it } from 'vitest'
import { makeProject, makeSection, makeTask } from '../../test/factories'
import { toCsvRow } from './csv-core'
import { tasksToCsv } from './csv-export'
import { parseTodoistCsv, type CsvImportOptions } from './csv-import'

const HEADER = 'TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE'

interface RowOptions {
  description?: string
  priority?: string
  indent?: string
  date?: string
}

const task = (content: string, o: RowOptions = {}): string =>
  toCsvRow(['task', content, o.description ?? '', o.priority ?? '4', o.indent ?? '1', '', '', o.date ?? '', o.date ? 'en' : '', ''])

const section = (name: string): string => toCsvRow(['section', name, '', '', '', '', '', '', '', ''])

const csv = (...rows: string[]): string => [HEADER, ...rows].join('\n')

function makeOptions(overrides: Partial<CsvImportOptions> = {}): CsvImportOptions {
  let seq = 0
  return {
    projectName: '가져온 프로젝트',
    nowMs: 1_000,
    newId: () => `n${++seq}`,
    today: '2026-10-23',
    ...overrides,
  }
}

function parseOk(text: string, overrides: Partial<CsvImportOptions> = {}) {
  const result = parseTodoistCsv(text, makeOptions(overrides))
  if (!result.ok) throw new Error(`import failed: ${result.error}`)
  return result
}

const byTitle = (tasks: readonly { title: string }[], title: string) => {
  const found = tasks.find((t) => t.title === title)
  if (!found) throw new Error(`task not found: ${title}`)
  return found as ReturnType<typeof makeTask>
}

describe('parseTodoistCsv structure', () => {
  it('restores parents from INDENT and attaches tasks to the latest section', () => {
    const result = parseOk(
      csv(
        task('A', { priority: '1' }),
        task('B', { indent: '2' }),
        task('C', { indent: '3' }),
        task('D'),
        section('진행'),
        task('E'),
        task('F', { indent: '2' }),
      ),
    )
    const { tasks, sections } = result.value

    expect(sections).toHaveLength(1)
    expect(sections[0]).toMatchObject({ name: '진행', projectId: '', order: 0, category: null })

    expect(byTitle(tasks, 'A').parentId).toBeNull()
    expect(byTitle(tasks, 'B').parentId).toBe(byTitle(tasks, 'A').id)
    expect(byTitle(tasks, 'C').parentId).toBe(byTitle(tasks, 'B').id)
    expect(byTitle(tasks, 'D').parentId).toBeNull()
    expect(byTitle(tasks, 'F').parentId).toBe(byTitle(tasks, 'E').id)

    expect(byTitle(tasks, 'A').sectionId).toBeNull()
    expect(byTitle(tasks, 'D').sectionId).toBeNull()
    expect(byTitle(tasks, 'E').sectionId).toBe(sections[0].id)
    expect(byTitle(tasks, 'F').sectionId).toBe(sections[0].id)
  })

  it('attaches an indent jump of two or more levels to the closest ancestor', () => {
    const { tasks } = parseOk(csv(task('A'), task('B', { indent: '4' }), task('C', { indent: '2' }), task('D', { indent: '4' }))).value

    expect(byTitle(tasks, 'B').parentId).toBe(byTitle(tasks, 'A').id)
    expect(byTitle(tasks, 'C').parentId).toBe(byTitle(tasks, 'A').id)
    expect(byTitle(tasks, 'D').parentId).toBe(byTitle(tasks, 'C').id)
  })

  it('treats a first task with a deep INDENT as top-level', () => {
    const { tasks } = parseOk(csv(task('A', { indent: '3' }))).value
    expect(tasks[0].parentId).toBeNull()
  })

  it('does not let a subtask cross a section boundary', () => {
    const { tasks } = parseOk(csv(task('A'), section('S'), task('B', { indent: '2' }))).value
    expect(byTitle(tasks, 'B').parentId).toBeNull()
  })

  it('treats a missing or invalid INDENT as 1', () => {
    const { tasks } = parseOk(csv(task('A'), task('B', { indent: '' }), task('C', { indent: 'x' }), task('D', { indent: '0' }))).value
    expect(tasks.every((t) => t.parentId === null)).toBe(true)
  })

  it('numbers siblings and sections in file order', () => {
    const { tasks, sections } = parseOk(
      csv(task('A'), task('A1', { indent: '2' }), task('A2', { indent: '2' }), task('B'), section('S1'), task('C'), section('S2')),
    ).value

    expect(byTitle(tasks, 'A').order).toBeLessThan(byTitle(tasks, 'B').order)
    expect(byTitle(tasks, 'A1').order).toBeLessThan(byTitle(tasks, 'A2').order)
    expect(byTitle(tasks, 'C').order).toBe(0)
    expect(sections.map((s) => s.order)).toEqual([0, 1])
  })

  it('returns the project name it was given', () => {
    expect(parseOk(csv(task('A')), { projectName: '내 프로젝트' }).value.projectName).toBe('내 프로젝트')
  })

  it('leaves projectId empty for the caller to fill in', () => {
    const { tasks, sections } = parseOk(csv(section('S'), task('A'))).value
    expect(tasks.every((t) => t.projectId === '')).toBe(true)
    expect(sections.every((s) => s.projectId === '')).toBe(true)
  })

  it('creates tasks with defaults, the given time and ids from newId', () => {
    const result = parseOk(csv(task('A', { description: '메모', priority: '2' })), { nowMs: 5_000 })
    expect(result.value.tasks[0]).toMatchObject({
      id: 'n1',
      title: 'A',
      description: '메모',
      priority: 2,
      status: 'todo',
      labelIds: [],
      recurrence: null,
      reminders: [],
      createdAt: 5_000,
      updatedAt: 5_000,
      completedAt: null,
      deletedAt: null,
      dueDate: null,
    })
  })

  it('gives every task and section a distinct id', () => {
    const { tasks, sections } = parseOk(csv(task('A'), section('S'), task('B'))).value
    const ids = [...tasks, ...sections].map((x) => x.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('parseTodoistCsv cells and rows', () => {
  it('reads quoted cells with commas, quotes and line breaks', () => {
    const { tasks } = parseOk(csv(task('사과, "배"', { description: '첫 줄\n둘째 줄, 쉼표' }))).value
    expect(tasks[0].title).toBe('사과, "배"')
    expect(tasks[0].description).toBe('첫 줄\n둘째 줄, 쉼표')
  })

  it('ignores blank lines and rows that are all empty', () => {
    const result = parseOk(`${HEADER}\n\n${task('A')}\n\n,,,,,,,,,\n${task('B')}\n\n`)
    expect(result.value.tasks.map((t) => t.title)).toEqual(['A', 'B'])
    expect(result.warnings).toEqual([])
  })

  it('accepts CRLF line endings and a UTF-8 BOM', () => {
    const text = `﻿${[HEADER, task('A'), task('B')].join('\r\n')}\r\n`
    expect(parseOk(text).value.tasks.map((t) => t.title)).toEqual(['A', 'B'])
  })

  it('finds columns by header name regardless of order and case', () => {
    const text = ['content,priority,type', 'First,1,task', 'Second,2,task'].join('\n')
    const { tasks } = parseOk(text).value
    expect(tasks.map((t) => [t.title, t.priority])).toEqual([
      ['First', 1],
      ['Second', 2],
    ])
  })

  it('works when optional columns are missing from the header', () => {
    const { tasks } = parseOk('TYPE,CONTENT\ntask,only title').value
    expect(tasks[0]).toMatchObject({ title: 'only title', priority: 4, description: '', startDate: null })
  })

  it('ignores meta rows silently and warns about other unsupported rows', () => {
    const result = parseOk(csv(task('A'), toCsvRow(['meta', 'view_style=list']), toCsvRow(['note', '댓글']), toCsvRow(['', 'no type'])))
    expect(result.value.tasks).toHaveLength(1)
    expect(result.warnings).toEqual(['지원하지 않는 행 2개를 건너뛰었어요'])
  })

  it('skips rows without content and warns', () => {
    const result = parseOk(csv(task('A'), task(''), section('')))
    expect(result.value.tasks).toHaveLength(1)
    expect(result.value.sections).toHaveLength(0)
    expect(result.warnings).toEqual(['내용이 없는 행 2개를 건너뛰었어요'])
  })

  it('returns empty lists for a file with only a header', () => {
    const result = parseOk(HEADER)
    expect(result.value).toEqual({ tasks: [], sections: [], projectName: '가져온 프로젝트' })
  })
})

describe('parseTodoistCsv priority', () => {
  it.each([
    ['1', 1],
    ['2', 2],
    ['3', 3],
    ['4', 4],
    ['5', 4],
    ['0', 4],
    ['-1', 4],
    ['2.5', 4],
    ['abc', 4],
    ['', 4],
  ])('reads PRIORITY "%s" as p%i', (cell, expected) => {
    expect(parseOk(csv(task('A', { priority: cell }))).value.tasks[0].priority).toBe(expected)
  })
})

describe('parseTodoistCsv dates', () => {
  it('reads a plain date as startDate', () => {
    const { tasks } = parseOk(csv(task('A', { date: '2026-10-24' }))).value
    expect(tasks[0]).toMatchObject({ startDate: '2026-10-24', startTime: null })
  })

  it('reads a date with time as startDate and startTime', () => {
    const { tasks } = parseOk(csv(task('A', { date: '2026-10-24 15:30' }), task('B', { date: '2026-10-25T09:00' }))).value
    expect(tasks[0]).toMatchObject({ startDate: '2026-10-24', startTime: '15:30' })
    expect(tasks[1]).toMatchObject({ startDate: '2026-10-25', startTime: '09:00' })
  })

  it('understands today and tomorrow relative to opts.today', () => {
    const { tasks } = parseOk(csv(task('A', { date: 'today' }), task('B', { date: '내일' }), task('C', { date: 'Tomorrow' }), task('D', { date: '오늘' }))).value
    expect(tasks.map((t) => t.startDate)).toEqual(['2026-10-23', '2026-10-24', '2026-10-24', '2026-10-23'])
  })

  it('moves past a month end when computing tomorrow', () => {
    const { tasks } = parseOk(csv(task('A', { date: '내일' })), { today: '2026-12-31' }).value
    expect(tasks[0].startDate).toBe('2027-01-01')
  })

  it.each(['every day', '2026-13-45', '2026-02-30', '2026-10-24 25:00', '매주 월요일', 'next monday'])(
    'clears startDate and warns for the unreadable date "%s"',
    (date) => {
      const result = parseOk(csv(task('A', { date })))
      expect(result.value.tasks[0].startDate).toBeNull()
      expect(result.value.tasks[0].startTime).toBeNull()
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]).toContain(date)
      expect(result.warnings[0]).toContain('2번째 행')
    },
  )

  it('leaves startDate empty without a warning when DATE is blank', () => {
    const result = parseOk(csv(task('A')))
    expect(result.value.tasks[0].startDate).toBeNull()
    expect(result.warnings).toEqual([])
  })
})

describe('parseTodoistCsv errors', () => {
  it('fails on empty text', () => {
    expect(parseTodoistCsv('', makeOptions())).toEqual({ ok: false, error: 'CSV 파일이 비어 있어요.' })
    expect(parseTodoistCsv('\n\n  \n', makeOptions()).ok).toBe(false)
  })

  it('fails when TYPE or CONTENT columns are missing', () => {
    const result = parseTodoistCsv('NAME,PRIORITY\nx,1', makeOptions())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('TYPE')
    expect(parseTodoistCsv('TYPE,PRIORITY\ntask,1', makeOptions()).ok).toBe(false)
  })
})

describe('export then import', () => {
  it('restores titles, priorities, hierarchy and dates', () => {
    const projects = [makeProject({ id: 'p1' })]
    const sections = [makeSection({ id: 's1', projectId: 'p1', name: '진행' })]
    const tasks = [
      makeTask({ id: 'a', title: '상위, 작업', projectId: 'p1', priority: 1, startDate: '2026-10-24', startTime: '09:00', order: 1 }),
      makeTask({ id: 'b', title: '하위 "작업"', projectId: 'p1', parentId: 'a', description: '설명\n둘째 줄', order: 1 }),
      makeTask({ id: 'c', title: '섹션 작업', projectId: 'p1', sectionId: 's1', priority: 3 }),
    ]

    const result = parseOk(tasksToCsv({ tasks, projects, sections, labels: [] }))
    const parsed = result.value

    expect(parsed.sections.map((s) => s.name)).toEqual(['진행'])
    expect(byTitle(parsed.tasks, '상위, 작업')).toMatchObject({ priority: 1, startDate: '2026-10-24', startTime: '09:00' })
    expect(byTitle(parsed.tasks, '하위 "작업"')).toMatchObject({
      description: '설명\n둘째 줄',
      parentId: byTitle(parsed.tasks, '상위, 작업').id,
    })
    expect(byTitle(parsed.tasks, '섹션 작업')).toMatchObject({ priority: 3, sectionId: parsed.sections[0].id })
    expect(result.warnings).toEqual([])
  })
})
