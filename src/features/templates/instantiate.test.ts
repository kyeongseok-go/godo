import { describe, expect, it } from 'vitest'
import type { Template } from '../../domain/types'
import { applyChangeSet, emptyEntityState } from '../../store/changes'
import { makeProject, makeSection, makeTask } from '../../test/factories'
import { buildProjectTemplate, buildTaskTemplate } from './build'
import { instantiateProjectTemplate, instantiateTaskTemplate } from './instantiate'
import { node } from './nodeFixture'

const counter = () => {
  let n = 0
  return () => `id-${++n}`
}

const taskTemplate = (root = node()): Template => ({
  id: 'tpl',
  name: '템플릿',
  kind: 'task',
  payload: { version: 1, root },
  createdAt: 0,
})

const base = (newId = counter()) => ({
  projectId: 'proj',
  sectionId: null,
  parentId: null,
  baseDate: '2026-11-01',
  nowMs: 500,
  newId,
})

describe('instantiateTaskTemplate', () => {
  it('creates the whole tree with fresh ids and wired parents', () => {
    const tpl = taskTemplate(node({ title: '루트', children: [node({ title: '자식', children: [node({ title: '손자' })] })] }))

    const cs = instantiateTaskTemplate(tpl, base())

    const tasks = cs.puts.tasks ?? []
    expect(tasks.map((t) => t.title)).toEqual(['루트', '자식', '손자'])
    const [root, child, grand] = tasks
    expect(new Set(tasks.map((t) => t.id)).size).toBe(3)
    expect(root.parentId).toBeNull()
    expect(child.parentId).toBe(root.id)
    expect(grand.parentId).toBe(child.id)
    expect(tasks.every((t) => t.projectId === 'proj' && t.status === 'todo' && t.createdAt === 500)).toBe(true)
  })

  it('shifts offsets onto the base date', () => {
    const tpl = taskTemplate(node({ startOffset: 0, dueOffset: 5, children: [node({ startOffset: -2 })] }))

    const tasks = instantiateTaskTemplate(tpl, base()).puts.tasks ?? []

    expect(tasks[0].startDate).toBe('2026-11-01')
    expect(tasks[0].dueDate).toBe('2026-11-06')
    expect(tasks[1].startDate).toBe('2026-10-30')
    expect(tasks[1].dueDate).toBeNull()
  })

  it('leaves dates empty when the template has no offsets', () => {
    const tasks = instantiateTaskTemplate(taskTemplate(), base()).puts.tasks ?? []

    expect(tasks[0].startDate).toBeNull()
  })

  it('places the root where the caller says and keeps sibling order', () => {
    const tpl = taskTemplate(node({ children: [node({ title: 'a' }), node({ title: 'b' })] }))

    const tasks = instantiateTaskTemplate(tpl, { ...base(), sectionId: 'sec', parentId: 'parent', rootOrder: 7000 }).puts.tasks ?? []

    expect(tasks[0]).toMatchObject({ sectionId: 'sec', parentId: 'parent', order: 7000 })
    expect(tasks[1]).toMatchObject({ sectionId: 'sec', parentId: tasks[0].id })
    expect(tasks[1].order).toBeLessThan(tasks[2].order)
  })

  it('rebuilds relative reminders with new ids and restores recurrence without progress', () => {
    const tpl = taskTemplate(
      node({
        startOffset: 0,
        reminderOffsets: [10, 60],
        recurrence: { freq: 'daily', interval: 2, anchor: 'due', end: { type: 'untilOffset', days: 10 }, resetSubtasks: true },
      }),
    )

    const [task] = instantiateTaskTemplate(tpl, base()).puts.tasks ?? []

    expect(task.reminders).toEqual([
      { id: expect.any(String), kind: 'relative', offsetMin: 10 },
      { id: expect.any(String), kind: 'relative', offsetMin: 60 },
    ])
    expect(task.recurrence).toMatchObject({ freq: 'daily', interval: 2, end: { type: 'until', date: '2026-11-11' }, resetSubtasks: true })
    expect(task.recurrence?.doneCount).toBeUndefined()
  })

  it('drops label ids that do not exist when known labels are given', () => {
    const tpl = taskTemplate(node({ labelIds: ['l1', 'l2'] }))

    const tasks = instantiateTaskTemplate(tpl, { ...base(), knownLabelIds: new Set(['l2']) }).puts.tasks ?? []

    expect(tasks[0].labelIds).toEqual(['l2'])
  })

  it('keeps all label ids when no known set is given', () => {
    const tasks = instantiateTaskTemplate(taskTemplate(node({ labelIds: ['l1'] })), base()).puts.tasks ?? []

    expect(tasks[0].labelIds).toEqual(['l1'])
  })

  it('logs one created activity for the root', () => {
    const cs = instantiateTaskTemplate(taskTemplate(node({ title: '루트', children: [node()] })), base())

    expect(cs.puts.activity).toHaveLength(1)
    expect(cs.puts.activity?.[0]).toMatchObject({ type: 'created', at: 500, taskId: cs.puts.tasks?.[0].id })
  })

  it('returns an empty change set for an invalid payload or the wrong kind', () => {
    const broken: Template = { ...taskTemplate(), payload: { nope: true } }
    const wrongKind: Template = { ...taskTemplate(), kind: 'project' }

    expect(instantiateTaskTemplate(broken, base())).toEqual({ puts: {}, deletes: {} })
    expect(instantiateTaskTemplate(wrongKind, base())).toEqual({ puts: {}, deletes: {} })
  })

  it('does not mutate the template', () => {
    const tpl = taskTemplate(node({ startOffset: 1, children: [node()] }))
    const before = JSON.stringify(tpl)

    instantiateTaskTemplate(tpl, base())

    expect(JSON.stringify(tpl)).toBe(before)
  })
})

describe('instantiateProjectTemplate', () => {
  const projectTemplate = (): Template => ({
    id: 'tp',
    name: '이사 체크리스트',
    kind: 'project',
    payload: {
      version: 1,
      project: { color: '#7a3e8e', icon: null, defaultView: 'board' },
      sections: [
        { name: '준비', category: 'todo' },
        { name: '진행', category: 'active' },
      ],
      tasks: [
        { section: null, node: node({ title: '섹션 없음' }) },
        { section: 0, node: node({ title: '박스 구하기', startOffset: 0, children: [node({ title: '마트 문의', startOffset: 1 })] }) },
        { section: 1, node: node({ title: '이삿짐 센터', startOffset: 3 }) },
      ],
    },
    createdAt: 0,
  })

  const opts = { parentId: null, baseDate: '2026-12-01', nowMs: 900, order: 4000, newId: counter() }

  it('creates a project, its sections and tasks wired together', () => {
    const result = instantiateProjectTemplate(projectTemplate(), { ...opts, newId: counter() })

    const project = result.changes.puts.projects?.[0]
    const sections = result.changes.puts.sections ?? []
    const tasks = result.changes.puts.tasks ?? []
    expect(result.projectId).toBe(project?.id)
    expect(project).toMatchObject({ name: '이사 체크리스트', color: '#7a3e8e', defaultView: 'board', order: 4000, createdAt: 900, parentId: null, isFolder: false, deletedAt: null })
    expect(sections.map((s) => [s.name, s.category, s.projectId])).toEqual([
      ['준비', 'todo', project?.id],
      ['진행', 'active', project?.id],
    ])
    expect(tasks.map((t) => [t.title, t.sectionId])).toEqual([
      ['섹션 없음', null],
      ['박스 구하기', sections[0].id],
      ['마트 문의', sections[0].id],
      ['이삿짐 센터', sections[1].id],
    ])
    expect(tasks.every((t) => t.projectId === project?.id)).toBe(true)
    expect(tasks[2].parentId).toBe(tasks[1].id)
  })

  it('shifts dates onto the base date', () => {
    const tasks = instantiateProjectTemplate(projectTemplate(), { ...opts, newId: counter() }).changes.puts.tasks ?? []

    expect(tasks.map((t) => t.startDate)).toEqual([null, '2026-12-01', '2026-12-02', '2026-12-04'])
  })

  it('starts tasks in an active column as active and others as todo', () => {
    const tasks = instantiateProjectTemplate(projectTemplate(), { ...opts, newId: counter() }).changes.puts.tasks ?? []

    expect(tasks.map((t) => t.status)).toEqual(['todo', 'todo', 'todo', 'active'])
  })

  it('numbers top-level tasks inside each section in template order', () => {
    const tasks = instantiateProjectTemplate(projectTemplate(), { ...opts, newId: counter() }).changes.puts.tasks ?? []

    expect(tasks[0].order).toBe(1000)
    expect(tasks[1].order).toBe(1000)
    expect(tasks[3].order).toBe(1000)
  })

  it('uses a custom name and parent folder', () => {
    const result = instantiateProjectTemplate(projectTemplate(), { ...opts, newId: counter(), name: '  새 집  ', parentId: 'folder' })

    expect(result.changes.puts.projects?.[0]).toMatchObject({ name: '새 집', parentId: 'folder' })
  })

  it('returns no project id for an invalid payload', () => {
    const result = instantiateProjectTemplate({ ...projectTemplate(), payload: 'x' }, { ...opts, newId: counter() })

    expect(result).toEqual({ changes: { puts: {}, deletes: {} }, projectId: null })
  })
})

describe('round trip', () => {
  it('rebuilds an equivalent tree from a saved task', () => {
    const root = makeTask({ id: 'r', title: '출장', startDate: '2026-10-10', dueDate: '2026-10-14', priority: 2, estimateMin: 90 })
    const kid = makeTask({ id: 'k', parentId: 'r', title: '항공권', startDate: '2026-10-11' })
    const state = { ...emptyEntityState(), tasks: { r: root, k: kid } }
    const template = buildTaskTemplate(state, 'r', '출장 템플릿', 1, 'tpl')
    if (!template) throw new Error('template is null')

    const cs = instantiateTaskTemplate(template, { ...base(), baseDate: '2027-02-01' })
    const { next } = applyChangeSet(emptyEntityState(), cs)
    const created = Object.values(next.tasks)

    expect(created.map((t) => [t.title, t.startDate, t.dueDate, t.priority])).toEqual([
      ['출장', '2027-02-01', '2027-02-05', 2],
      ['항공권', '2027-02-02', null, 4],
    ])
  })

  it('rebuilds a project with sections', () => {
    const project = makeProject({ id: 'p', name: '프로젝트', color: '#2b4c7e' })
    const section = makeSection({ id: 's', projectId: 'p', name: '구역' })
    const task = makeTask({ id: 't', projectId: 'p', sectionId: 's', title: '일', startDate: '2026-10-10' })
    const state = { ...emptyEntityState(), projects: { p: project }, sections: { s: section }, tasks: { t: task } }
    const template = buildProjectTemplate(state, 'p', '', 1, 'tpl')
    if (!template) throw new Error('template is null')

    const result = instantiateProjectTemplate(template, { parentId: null, baseDate: '2027-01-01', nowMs: 1, order: 1, newId: counter() })
    const { next } = applyChangeSet(emptyEntityState(), result.changes)

    expect(Object.values(next.projects)[0].name).toBe('프로젝트')
    expect(Object.values(next.sections)[0].name).toBe('구역')
    expect(Object.values(next.tasks)[0].startDate).toBe('2027-01-01')
  })
})
