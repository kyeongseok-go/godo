import { describe, expect, it } from 'vitest'
import { makeLabel, makeProject, makeSection, makeTask } from '../../test/factories'
import type { Task } from '../types'
import { parseCsvRows, toCsvRow } from './csv-core'
import { tasksToCsv } from './csv-export'

const HEADER = 'TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE'

interface RowOptions {
  description?: string
  priority?: string
  indent?: string
  date?: string
}

const taskRow = (content: string, o: RowOptions = {}): string =>
  toCsvRow(['task', content, o.description ?? '', o.priority ?? '4', o.indent ?? '1', '', '', o.date ?? '', o.date ? 'ko' : '', ''])

const sectionRow = (name: string): string => toCsvRow(['section', name, '', '', '', '', '', '', '', ''])

const empty = { tasks: [] as Task[], projects: [], sections: [], labels: [] }

describe('tasksToCsv', () => {
  it('writes only the Todoist header when there is nothing to export', () => {
    expect(tasksToCsv(empty)).toBe(HEADER)
  })

  it('does not add a UTF-8 BOM', () => {
    expect(tasksToCsv(empty).charCodeAt(0)).not.toBe(0xfeff)
  })

  it('writes a task with priority and date, keeping p1 as 1', () => {
    const csv = tasksToCsv({ ...empty, tasks: [makeTask({ title: '보고서', priority: 1, startDate: '2026-10-24' })] })
    expect(csv).toBe([HEADER, taskRow('보고서', { priority: '1', date: '2026-10-24' })].join('\n'))
  })

  it('appends the time to the date as YYYY-MM-DD HH:mm', () => {
    const csv = tasksToCsv({ ...empty, tasks: [makeTask({ title: 'a', startDate: '2026-10-24', startTime: '09:30' })] })
    expect(csv.split('\n')[1]).toBe(taskRow('a', { date: '2026-10-24 09:30' }))
  })

  it('falls back to the due date when there is no start date', () => {
    const csv = tasksToCsv({ ...empty, tasks: [makeTask({ title: 'a', dueDate: '2026-11-01', startTime: '09:30' })] })
    expect(csv.split('\n')[1]).toBe(taskRow('a', { date: '2026-11-01' }))
  })

  it('leaves DATE and DATE_LANG empty for tasks without a date', () => {
    const csv = tasksToCsv({ ...empty, tasks: [makeTask({ title: 'a' })] })
    expect(csv.split('\n')[1]).toBe(taskRow('a'))
  })

  it('writes the recurrence as a Korean description in DATE', () => {
    const tasks = [
      makeTask({
        title: '주간',
        startDate: '2026-10-26',
        startTime: '09:00',
        recurrence: { freq: 'weekly', interval: 1, byWeekday: [1], anchor: 'due', end: { type: 'never' }, resetSubtasks: false },
      }),
    ]
    const csv = tasksToCsv({ ...empty, tasks })
    expect(csv.split('\n')[1]).toBe(taskRow('주간', { date: '매주 월요일 오전 9시' }))
  })

  it('escapes commas, quotes and line breaks as RFC 4180', () => {
    const task = makeTask({ title: '사과, 배', description: '첫 줄\n"둘째" 줄' })
    const csv = tasksToCsv({ ...empty, tasks: [task] })

    expect(csv).toContain('"사과, 배","첫 줄\n""둘째"" 줄"')
    expect(parseCsvRows(csv)[1].slice(0, 3)).toEqual(['task', '사과, 배', '첫 줄\n"둘째" 줄'])
  })

  it('appends label names to the content as @labels', () => {
    const labels = [makeLabel({ id: 'l1', name: '회사' }), makeLabel({ id: 'l2', name: '집 일' })]
    const task = makeTask({ title: '제목', labelIds: ['l1', 'l2', 'missing'] })
    const csv = tasksToCsv({ ...empty, labels, tasks: [task] })
    expect(csv.split('\n')[1]).toBe(taskRow('제목 @회사 @집_일'))
  })

  it('excludes trashed, done and canceled tasks but keeps active ones', () => {
    const tasks = [
      makeTask({ title: 'todo' }),
      makeTask({ title: 'active', status: 'active' }),
      makeTask({ title: 'done', status: 'done' }),
      makeTask({ title: 'canceled', status: 'canceled' }),
      makeTask({ title: 'trashed', deletedAt: 5 }),
    ]
    const rows = parseCsvRows(tasksToCsv({ ...empty, tasks })).slice(1)
    expect(rows.map((r) => r[1])).toEqual(['todo', 'active'])
  })

  describe('subtasks', () => {
    it('writes depth as INDENT starting at 1 and caps it at 4', () => {
      const tasks: Task[] = []
      for (let i = 1; i <= 6; i++) {
        tasks.push(makeTask({ id: `n${i}`, title: `n${i}`, parentId: i === 1 ? null : `n${i - 1}`, order: i }))
      }
      const rows = parseCsvRows(tasksToCsv({ ...empty, tasks })).slice(1)
      expect(rows.map((r) => r[4])).toEqual(['1', '2', '3', '4', '4', '4'])
    })

    it('places each child right after its parent, ordered by order', () => {
      const tasks = [
        makeTask({ id: 'c2', title: 'c2', parentId: 'p', order: 2 }),
        makeTask({ id: 'q', title: 'q', order: 2 }),
        makeTask({ id: 'p', title: 'p', order: 1 }),
        makeTask({ id: 'c1', title: 'c1', parentId: 'p', order: 1 }),
      ]
      const rows = parseCsvRows(tasksToCsv({ ...empty, tasks })).slice(1)
      expect(rows.map((r) => `${r[1]}:${r[4]}`)).toEqual(['p:1', 'c1:2', 'c2:2', 'q:1'])
    })

    it('treats a subtask whose parent is not exported as a top-level task', () => {
      const tasks = [
        makeTask({ id: 'gone', title: 'gone', status: 'done' }),
        makeTask({ id: 'kid', title: 'kid', parentId: 'gone' }),
      ]
      const rows = parseCsvRows(tasksToCsv({ ...empty, tasks })).slice(1)
      expect(rows.map((r) => `${r[1]}:${r[4]}`)).toEqual(['kid:1'])
    })
  })

  describe('projects and sections', () => {
    it('writes unsectioned tasks first, then each section row followed by its tasks', () => {
      const projects = [makeProject({ id: 'p1' })]
      const sections = [
        makeSection({ id: 's1', projectId: 'p1', name: '진행', order: 1 }),
        makeSection({ id: 's2', projectId: 'p1', name: '준비', order: 0 }),
        makeSection({ id: 's3', projectId: 'p1', name: '빈 섹션', order: 2 }),
        makeSection({ id: 'other', projectId: 'p9', name: '남의 섹션' }),
      ]
      const tasks = [
        makeTask({ title: 'b', projectId: 'p1', sectionId: 's1' }),
        makeTask({ title: 'a', projectId: 'p1' }),
        makeTask({ title: 'c', projectId: 'p1', sectionId: 's2' }),
      ]

      const csv = tasksToCsv({ tasks, projects, sections, labels: [] })

      expect(csv.split('\n')).toEqual([
        HEADER,
        taskRow('a'),
        sectionRow('준비'),
        taskRow('c'),
        sectionRow('진행'),
        taskRow('b'),
        sectionRow('빈 섹션'),
      ])
    })

    it('keeps a subtask under its parent even if its own sectionId differs', () => {
      const projects = [makeProject({ id: 'p1' })]
      const sections = [makeSection({ id: 's1', projectId: 'p1', name: 'S' })]
      const tasks = [
        makeTask({ id: 'par', title: 'par', projectId: 'p1', sectionId: 's1' }),
        makeTask({ id: 'kid', title: 'kid', projectId: 'p1', parentId: 'par', sectionId: null }),
      ]
      const rows = parseCsvRows(tasksToCsv({ tasks, projects, sections, labels: [] })).slice(1)
      expect(rows.map((r) => `${r[0]}:${r[1]}:${r[4]}`)).toEqual(['section:S:', 'task:par:1', 'task:kid:2'])
    })

    it('orders projects by their order and skips trashed projects', () => {
      const projects = [
        makeProject({ id: 'p1', order: 1 }),
        makeProject({ id: 'p2', order: 0 }),
        makeProject({ id: 'p3', order: 2, deletedAt: 9 }),
      ]
      const tasks = [
        makeTask({ title: 'in p1', projectId: 'p1' }),
        makeTask({ title: 'in p2', projectId: 'p2' }),
        makeTask({ title: 'in p3', projectId: 'p3' }),
      ]
      const rows = parseCsvRows(tasksToCsv({ tasks, projects, sections: [], labels: [] })).slice(1)
      expect(rows.map((r) => r[1])).toEqual(['in p2', 'in p1'])
    })

    it('skips tasks that belong to a project that was not passed in', () => {
      const csv = tasksToCsv({ ...empty, projects: [makeProject({ id: 'p1' })], tasks: [makeTask({ title: 'lost', projectId: 'ghost' })] })
      expect(csv).toBe(HEADER)
    })

    it('exports inbox tasks first even when the inbox is not in the project list', () => {
      const projects = [makeProject({ id: 'p1', order: 0 })]
      const tasks = [makeTask({ title: 'p1 task', projectId: 'p1' }), makeTask({ title: 'inbox task' })]
      const rows = parseCsvRows(tasksToCsv({ tasks, projects, sections: [], labels: [] })).slice(1)
      expect(rows.map((r) => r[1])).toEqual(['inbox task', 'p1 task'])
    })
  })

  it('does not mutate its input', () => {
    const tasks = [makeTask({ id: 'b', order: 2 }), makeTask({ id: 'a', order: 1 })]
    const before = JSON.stringify(tasks)
    tasksToCsv({ ...empty, tasks })
    expect(JSON.stringify(tasks)).toBe(before)
  })
})
