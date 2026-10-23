import { renderHook } from '@testing-library/react'
import { INBOX_ID } from '../../domain/types'
import { useApp } from '../../store/app'
import { useToasts } from '../../ui/toast'
import { makeLabel, makeProject, makeSection, makeTask } from '../../test/factories'
import { useTemplateActions } from './useTemplateActions'

const actions = () => renderHook(() => useTemplateActions()).result.current
const state = () => useApp.getState()
const tasks = () => Object.values(state().entities.tasks)

beforeAll(async () => {
  await state().load()
})

beforeEach(() => {
  const { entities } = state()
  state().commit(
    {
      puts: {},
      deletes: {
        tasks: Object.keys(entities.tasks),
        templates: Object.keys(entities.templates),
        sections: Object.keys(entities.sections),
        labels: Object.keys(entities.labels),
        projects: Object.keys(entities.projects).filter((id) => id !== INBOX_ID),
      },
    },
    '초기화',
    { history: false },
  )
  useToasts.setState({ toasts: [] })
})

function seedTrip(): void {
  state().commit(
    {
      puts: {
        labels: [makeLabel({ id: 'l1' })],
        tasks: [
          makeTask({ id: 'trip', title: '출장', startDate: '2026-10-10', labelIds: ['l1'] }),
          makeTask({ id: 'flight', parentId: 'trip', title: '항공권', startDate: '2026-10-11' }),
        ],
      },
      deletes: {},
    },
    '준비',
    { history: false },
  )
}

describe('useTemplateActions task templates', () => {
  test('saves a task as a template and can undo it', () => {
    seedTrip()
    const saved = actions().saveTask('trip')

    expect(saved?.name).toBe('출장')
    expect(Object.values(state().entities.templates)).toHaveLength(1)

    state().undo()
    expect(Object.values(state().entities.templates)).toHaveLength(0)
  })

  test('reports an error when the task does not exist', () => {
    expect(actions().saveTask('missing')).toBeNull()

    expect(useToasts.getState().toasts[0]).toMatchObject({ tone: 'error' })
  })

  test('creates tasks from a template into the chosen project with the base date', () => {
    seedTrip()
    const template = actions().saveTask('trip', '출장 준비')
    state().commit({ puts: { projects: [makeProject({ id: 'p2' })] }, deletes: {} }, '프로젝트', { history: false })

    const count = actions().createTasks(template?.id ?? '', { projectId: 'p2', baseDate: '2027-03-01' })

    expect(count).toBe(2)
    const created = tasks().filter((t) => t.projectId === 'p2')
    expect(created.map((t) => [t.title, t.startDate])).toEqual([
      ['출장', '2027-03-01'],
      ['항공권', '2027-03-02'],
    ])
    expect(created[0].labelIds).toEqual(['l1'])
  })

  test('falls back to the inbox when the project is gone and drops unknown labels', () => {
    seedTrip()
    const template = actions().saveTask('trip')
    state().commit({ puts: {}, deletes: { labels: ['l1'] } }, '라벨 삭제', { history: false })

    actions().createTasks(template?.id ?? '', { projectId: 'ghost' })

    const created = tasks().filter((t) => t.id !== 'trip' && t.id !== 'flight')
    expect(created.every((t) => t.projectId === INBOX_ID)).toBe(true)
    expect(created[0].labelIds).toEqual([])
  })

  test('creates tasks under a parent task and follows its project and section', () => {
    seedTrip()
    const template = actions().saveTask('flight')
    state().commit(
      {
        puts: {
          projects: [makeProject({ id: 'p3' })],
          sections: [makeSection({ id: 's3', projectId: 'p3' })],
          tasks: [makeTask({ id: 'host', projectId: 'p3', sectionId: 's3' })],
        },
        deletes: {},
      },
      '준비',
      { history: false },
    )

    actions().createTasks(template?.id ?? '', { parentId: 'host' })

    const child = tasks().find((t) => t.parentId === 'host')
    expect(child).toMatchObject({ projectId: 'p3', sectionId: 's3' })
  })

  test('refuses to create tasks from a project template', () => {
    state().commit(
      { puts: { templates: [{ id: 'pt', name: 'P', kind: 'project', payload: {}, createdAt: 1 }] }, deletes: {} },
      '준비',
      { history: false },
    )

    expect(actions().createTasks('pt')).toBe(0)
    expect(useToasts.getState().toasts[0]).toMatchObject({ tone: 'error' })
  })

  test('refuses an unreadable payload', () => {
    state().commit(
      { puts: { templates: [{ id: 'bad', name: 'B', kind: 'task', payload: 'x', createdAt: 1 }] }, deletes: {} },
      '준비',
      { history: false },
    )

    expect(actions().createTasks('bad')).toBe(0)
  })

  test('renames and removes templates with undo', () => {
    seedTrip()
    const template = actions().saveTask('trip')
    const id = template?.id ?? ''

    actions().rename(id, '  새 이름  ')
    expect(state().entities.templates[id].name).toBe('새 이름')

    actions().remove(id)
    expect(state().entities.templates[id]).toBeUndefined()
    state().undo()
    expect(state().entities.templates[id].name).toBe('새 이름')
  })

  test('ignores a blank rename', () => {
    seedTrip()
    const id = actions().saveTask('trip')?.id ?? ''

    actions().rename(id, '   ')

    expect(state().entities.templates[id].name).toBe('출장')
  })
})

describe('useTemplateActions project templates', () => {
  test('saves a project and creates a new project from it', () => {
    state().commit(
      {
        puts: {
          projects: [makeProject({ id: 'p', name: '이사' })],
          sections: [makeSection({ id: 's', projectId: 'p', name: '준비' })],
          tasks: [makeTask({ id: 't', projectId: 'p', sectionId: 's', title: '박스' })],
        },
        deletes: {},
      },
      '준비',
      { history: false },
    )
    const template = actions().saveProject('p')

    const newProjectId = actions().createProject(template?.id ?? '', { name: '두 번째 이사' })

    const created = state().entities.projects[newProjectId ?? '']
    expect(created.name).toBe('두 번째 이사')
    expect(tasks().filter((t) => t.projectId === newProjectId).map((t) => t.title)).toEqual(['박스'])
    expect(Object.values(state().entities.sections).filter((s) => s.projectId === newProjectId)).toHaveLength(1)
  })

  test('refuses to create a project from a task template', () => {
    seedTrip()
    const template = actions().saveTask('trip')

    expect(actions().createProject(template?.id ?? '')).toBeNull()
  })

  test('reports an error when saving a folder', () => {
    state().commit({ puts: { projects: [makeProject({ id: 'f', isFolder: true })] }, deletes: {} }, '폴더', { history: false })

    expect(actions().saveProject('f')).toBeNull()
  })
})
