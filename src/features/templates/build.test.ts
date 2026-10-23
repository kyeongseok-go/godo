import { describe, expect, it } from 'vitest'
import { emptyEntityState } from '../../store/changes'
import type { EntityState } from '../../store/changes'
import { makeProject, makeSection, makeTask } from '../../test/factories'
import { buildProjectTemplate, buildTaskTemplate } from './build'
import { parseTemplatePayload } from './model'

const stateOf = (tasks: ReturnType<typeof makeTask>[], extra: Partial<EntityState> = {}): EntityState => ({
  ...emptyEntityState(),
  tasks: Object.fromEntries(tasks.map((t) => [t.id, t])),
  ...extra,
})

function taskPayload(template: ReturnType<typeof buildTaskTemplate>) {
  if (!template) throw new Error('template is null')
  const parsed = parseTemplatePayload(template)
  if (!parsed.ok || parsed.kind !== 'task') throw new Error('not a task template')
  return parsed.payload
}

describe('buildTaskTemplate', () => {
  it('returns null for a missing or trashed task', () => {
    const trashed = makeTask({ id: 'x', deletedAt: 1 })

    expect(buildTaskTemplate(stateOf([trashed]), 'nope', '이름', 5, 'tpl')).toBeNull()
    expect(buildTaskTemplate(stateOf([trashed]), 'x', '이름', 5, 'tpl')).toBeNull()
  })

  it('stores name, kind, id and creation time', () => {
    const t = buildTaskTemplate(stateOf([makeTask({ id: 'a' })]), 'a', '  출장 준비 ', 77, 'tpl-1')

    expect(t).toMatchObject({ id: 'tpl-1', name: '출장 준비', kind: 'task', createdAt: 77 })
  })

  it('falls back to the task title when the name is blank', () => {
    const t = buildTaskTemplate(stateOf([makeTask({ id: 'a', title: '장보기' })]), 'a', '   ', 1, 'tpl')

    expect(t?.name).toBe('장보기')
  })

  it('serializes the subtree in order and skips deleted children', () => {
    const root = makeTask({ id: 'r', title: '루트' })
    const second = makeTask({ id: 'c2', parentId: 'r', title: '둘째', order: 2000 })
    const first = makeTask({ id: 'c1', parentId: 'r', title: '첫째', order: 1000 })
    const gone = makeTask({ id: 'c3', parentId: 'r', title: '삭제됨', deletedAt: 9 })
    const grand = makeTask({ id: 'g', parentId: 'c1', title: '손자' })

    const payload = taskPayload(buildTaskTemplate(stateOf([root, second, first, gone, grand]), 'r', 'n', 1, 'tpl'))

    expect(payload.root.title).toBe('루트')
    expect(payload.root.children.map((c) => c.title)).toEqual(['첫째', '둘째'])
    expect(payload.root.children[0].children.map((c) => c.title)).toEqual(['손자'])
  })

  it('turns dates into offsets from the root start date', () => {
    const root = makeTask({ id: 'r', startDate: '2026-10-10', dueDate: '2026-10-15' })
    const child = makeTask({ id: 'c', parentId: 'r', startDate: '2026-10-12', dueDate: null })

    const payload = taskPayload(buildTaskTemplate(stateOf([root, child]), 'r', 'n', 1, 'tpl'))

    expect(payload.root.startOffset).toBe(0)
    expect(payload.root.dueOffset).toBe(5)
    expect(payload.root.children[0].startOffset).toBe(2)
    expect(payload.root.children[0].dueOffset).toBeNull()
  })

  it('uses the root due date as the anchor when there is no start date', () => {
    const root = makeTask({ id: 'r', dueDate: '2026-10-20' })
    const child = makeTask({ id: 'c', parentId: 'r', startDate: '2026-10-18' })

    const payload = taskPayload(buildTaskTemplate(stateOf([root, child]), 'r', 'n', 1, 'tpl'))

    expect(payload.root.dueOffset).toBe(0)
    expect(payload.root.children[0].startOffset).toBe(-2)
  })

  it('anchors on the earliest descendant date when the root has no date', () => {
    const root = makeTask({ id: 'r' })
    const a = makeTask({ id: 'a', parentId: 'r', startDate: '2026-10-12' })
    const b = makeTask({ id: 'b', parentId: 'r', startDate: '2026-10-09' })

    const payload = taskPayload(buildTaskTemplate(stateOf([root, a, b]), 'r', 'n', 1, 'tpl'))

    expect(payload.root.startOffset).toBeNull()
    expect(payload.root.children.map((c) => c.startOffset)).toEqual([3, 0])
  })

  it('stores no offsets when nothing has a date', () => {
    const payload = taskPayload(buildTaskTemplate(stateOf([makeTask({ id: 'r' })]), 'r', 'n', 1, 'tpl'))

    expect(payload.root.startOffset).toBeNull()
    expect(payload.root.dueOffset).toBeNull()
  })

  it('keeps relative reminders only and drops progress fields', () => {
    const root = makeTask({
      id: 'r',
      startDate: '2026-10-10',
      reminders: [
        { id: 'a', kind: 'relative', offsetMin: 15 },
        { id: 'b', kind: 'absolute', at: 123 },
      ],
      status: 'done',
      actualMin: { '2026-10-10': 30 },
      recurrence: {
        freq: 'weekly',
        interval: 1,
        anchor: 'due',
        end: { type: 'until', date: '2026-12-10' },
        doneCount: 3,
        skipDates: ['2026-10-17'],
        resetSubtasks: false,
      },
    })

    const payload = taskPayload(buildTaskTemplate(stateOf([root]), 'r', 'n', 1, 'tpl'))

    expect(payload.root.reminderOffsets).toEqual([15])
    expect(payload.root.recurrence?.end).toEqual({ type: 'untilOffset', days: 61 })
    expect(payload.root.recurrence).not.toHaveProperty('doneCount')
    expect(payload.root.recurrence).not.toHaveProperty('skipDates')
  })

  it('does not mutate the state', () => {
    const state = stateOf([makeTask({ id: 'r', startDate: '2026-10-10' })])
    const snapshot = JSON.stringify(state)

    buildTaskTemplate(state, 'r', 'n', 1, 'tpl')

    expect(JSON.stringify(state)).toBe(snapshot)
  })
})

describe('buildProjectTemplate', () => {
  const project = makeProject({ id: 'p', name: '이사', color: '#7a3e8e', defaultView: 'board' })
  const s1 = makeSection({ id: 's1', projectId: 'p', name: '준비', order: 1000, category: 'todo' })
  const s2 = makeSection({ id: 's2', projectId: 'p', name: '당일', order: 2000 })

  const build = (tasks: ReturnType<typeof makeTask>[]) =>
    buildProjectTemplate(
      stateOf(tasks, { projects: { p: project }, sections: { s1, s2 } }),
      'p',
      '이사 체크리스트',
      9,
      'tpl-p',
    )

  it('returns null for an unknown or deleted project and for folders', () => {
    const state = stateOf([], { projects: { f: makeProject({ id: 'f', isFolder: true }), d: makeProject({ id: 'd', deletedAt: 1 }) } })

    expect(buildProjectTemplate(state, 'nope', 'n', 1, 't')).toBeNull()
    expect(buildProjectTemplate(state, 'f', 'n', 1, 't')).toBeNull()
    expect(buildProjectTemplate(state, 'd', 'n', 1, 't')).toBeNull()
  })

  it('keeps project look, sections in order and tasks grouped by section', () => {
    const t1 = makeTask({ id: 't1', projectId: 'p', sectionId: 's2', title: '당일 할 일', order: 1000 })
    const t2 = makeTask({ id: 't2', projectId: 'p', sectionId: 's1', title: '준비 할 일', order: 1000 })
    const t3 = makeTask({ id: 't3', projectId: 'p', sectionId: null, title: '섹션 없음', order: 1000 })

    const template = build([t1, t2, t3])
    const parsed = template ? parseTemplatePayload(template) : null

    expect(template).toMatchObject({ id: 'tpl-p', name: '이사 체크리스트', kind: 'project', createdAt: 9 })
    expect(parsed?.ok && parsed.kind === 'project' && parsed.payload.project).toEqual({ color: '#7a3e8e', icon: null, defaultView: 'board' })
    expect(parsed?.ok && parsed.kind === 'project' && parsed.payload.sections).toEqual([
      { name: '준비', category: 'todo' },
      { name: '당일', category: null },
    ])
    const tasks = parsed?.ok && parsed.kind === 'project' ? parsed.payload.tasks : []
    expect(tasks.map((t) => [t.section, t.node.title])).toEqual([
      [null, '섹션 없음'],
      [0, '준비 할 일'],
      [1, '당일 할 일'],
    ])
  })

  it('nests subtasks and ignores tasks from other projects and the trash', () => {
    const root = makeTask({ id: 'r', projectId: 'p', title: '루트' })
    const kid = makeTask({ id: 'k', projectId: 'p', parentId: 'r', title: '자식' })
    const other = makeTask({ id: 'o', projectId: 'inbox', title: '남의 것' })
    const trashed = makeTask({ id: 'x', projectId: 'p', title: '삭제', deletedAt: 5 })

    const template = build([root, kid, other, trashed])
    const parsed = template ? parseTemplatePayload(template) : null
    const tasks = parsed?.ok && parsed.kind === 'project' ? parsed.payload.tasks : []

    expect(tasks).toHaveLength(1)
    expect(tasks[0].node.children.map((c) => c.title)).toEqual(['자식'])
  })

  it('uses the earliest task date in the project as the anchor', () => {
    const a = makeTask({ id: 'a', projectId: 'p', startDate: '2026-11-05' })
    const b = makeTask({ id: 'b', projectId: 'p', startDate: '2026-11-01', order: 2000 })

    const template = build([a, b])
    const parsed = template ? parseTemplatePayload(template) : null
    const tasks = parsed?.ok && parsed.kind === 'project' ? parsed.payload.tasks : []

    expect(tasks.map((t) => t.node.startOffset)).toEqual([4, 0])
  })
})
