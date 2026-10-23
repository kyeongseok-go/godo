import { INBOX_ID } from '../../domain/types'
import { makeLabel, makeProject, makeSection, makeTask } from '../../test/factories'
import { applyChangeSet, emptyEntityState } from '../changes'
import type { ChangeSet, EntityState } from '../changes'
import {
  createFilter,
  createLabel,
  createProject,
  createSection,
  deleteLabel,
  deleteProject,
  deleteSection,
  findLabelByName,
  patchProject,
} from './entityCommands'

const seed = (cs: ChangeSet): EntityState => applyChangeSet(emptyEntityState(), cs).next
const NOW = 1_000

describe('projects', () => {
  test('createProject assigns a palette color and appends order', () => {
    const state = seed({ puts: { projects: [makeProject({ id: 'a', order: 5000 })] }, deletes: {} })

    const { project } = createProject(state, { name: '  새 프로젝트  ' }, NOW)

    expect(project.name).toBe('새 프로젝트')
    expect(project.order).toBe(6000)
    expect(project.color).toMatch(/^#/)
  })

  test('patchProject refuses to move a project under its own descendant', () => {
    const state = seed({
      puts: { projects: [makeProject({ id: 'p' }), makeProject({ id: 'c', parentId: 'p' })] },
      deletes: {},
    })

    const cs = patchProject(state, 'p', { parentId: 'c' })

    expect(cs.puts.projects).toBeUndefined()
  })

  test('deleteProject trashes the subtree and its tasks, but never the inbox', () => {
    const state = seed({
      puts: {
        projects: [makeProject({ id: INBOX_ID }), makeProject({ id: 'p' }), makeProject({ id: 'c', parentId: 'p' })],
        tasks: [makeTask({ id: 't1', projectId: 'p' }), makeTask({ id: 't2', projectId: 'c' }), makeTask({ id: 't3', projectId: INBOX_ID })],
        sections: [makeSection({ id: 's', projectId: 'p' })],
      },
      deletes: {},
    })

    const next = applyChangeSet(state, deleteProject(state, 'p', NOW)).next

    expect(next.projects.p.deletedAt).toBe(NOW)
    expect(next.projects.c.deletedAt).toBe(NOW)
    expect(next.tasks.t1.deletedAt).toBe(NOW)
    expect(next.tasks.t2.deletedAt).toBe(NOW)
    expect(next.tasks.t3.deletedAt).toBeNull()
    expect(next.sections.s).toBeUndefined()
    expect(deleteProject(state, INBOX_ID, NOW).puts.projects).toBeUndefined()
  })
})

describe('sections', () => {
  test('deleteSection keeps tasks and clears their sectionId', () => {
    const { section, changes } = createSection(emptyEntityState(), { projectId: 'p', name: '진행 중' })
    const state = seed(mergeTask(changes, makeTask({ id: 't', sectionId: section.id })))

    const next = applyChangeSet(state, deleteSection(state, section.id, NOW)).next

    expect(next.sections[section.id]).toBeUndefined()
    expect(next.tasks.t.sectionId).toBeNull()
  })
})

describe('labels', () => {
  test('createLabel strips leading symbols and findLabelByName ignores case', () => {
    const { label, changes } = createLabel(emptyEntityState(), { name: '@Urgent' })
    const state = seed(changes)

    expect(label.name).toBe('Urgent')
    expect(findLabelByName(state, 'urgent')?.id).toBe(label.id)
  })

  test('deleteLabel removes it from every task', () => {
    const state = seed({
      puts: { labels: [makeLabel({ id: 'l' })], tasks: [makeTask({ id: 't', labelIds: ['l', 'm'] })] },
      deletes: {},
    })

    const next = applyChangeSet(state, deleteLabel(state, 'l', NOW)).next

    expect(next.labels.l).toBeUndefined()
    expect(next.tasks.t.labelIds).toEqual(['m'])
  })
})

describe('filters', () => {
  test('createFilter trims the query', () => {
    const { filter } = createFilter(emptyEntityState(), { name: '급한 것', query: '  p1 & today ' })

    expect(filter.query).toBe('p1 & today')
  })
})

function mergeTask(cs: ChangeSet, task: ReturnType<typeof makeTask>): ChangeSet {
  return { puts: { ...cs.puts, tasks: [task] }, deletes: cs.deletes }
}
