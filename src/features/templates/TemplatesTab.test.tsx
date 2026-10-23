import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useApp } from '../../store/app'
import { makeProject, makeSection, makeTask } from '../../test/factories'
import { resetApp } from '../../test/render'
import { renderInRouter } from '../settings/testKit'
import { buildProjectTemplate, buildTaskTemplate } from './build'
import { TemplatesTab } from './TemplatesTab'

beforeEach(async () => {
  await resetApp()
})

const state = () => useApp.getState()

function seedTemplates(): void {
  state().commit(
    {
      puts: {
        projects: [makeProject({ id: 'work', name: '업무', order: 1 })],
        sections: [makeSection({ id: 's', projectId: 'work', name: '준비' })],
        tasks: [
          makeTask({ id: 'trip', title: '출장', projectId: 'work', startDate: '2026-10-10' }),
          makeTask({ id: 'flight', parentId: 'trip', projectId: 'work', title: '항공권', startDate: '2026-10-11', sectionId: 's' }),
        ],
      },
      deletes: {},
    },
    '준비',
    { history: false },
  )
  const entities = state().entities
  const taskTemplate = buildTaskTemplate(entities, 'trip', '출장 준비', 100, 'tpl-task')
  const projectTemplate = buildProjectTemplate(entities, 'work', '업무 기본 틀', 200, 'tpl-project')
  if (!taskTemplate || !projectTemplate) throw new Error('템플릿을 만들지 못했어요')
  state().commit({ puts: { templates: [taskTemplate, projectTemplate] }, deletes: {} }, '템플릿', { history: false })
}

describe('TemplatesTab', () => {
  test('shows a hint when there are no templates', () => {
    renderInRouter(<TemplatesTab />)

    expect(screen.getByText(/아직 템플릿이 없어요/)).toBeInTheDocument()
  })

  test('lists templates newest first with a summary', () => {
    seedTemplates()
    renderInRouter(<TemplatesTab />)

    const items = within(screen.getByRole('list', { name: '템플릿 목록' })).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('업무 기본 틀')
    expect(items[0]).toHaveTextContent('섹션 1개 · 할 일 2개')
    expect(items[1]).toHaveTextContent('출장 준비')
    expect(items[1]).toHaveTextContent('할 일 1개 + 하위 작업 1개')
  })

  test('renames a template', async () => {
    const user = userEvent.setup()
    seedTemplates()
    renderInRouter(<TemplatesTab />)

    await user.click(screen.getByRole('button', { name: '출장 준비 이름 바꾸기' }))
    const input = screen.getByRole('textbox', { name: '출장 준비의 새 이름' })
    await user.clear(input)
    await user.type(input, '해외 출장{Enter}')

    expect(state().entities.templates['tpl-task'].name).toBe('해외 출장')
    expect(await screen.findByText('해외 출장')).toBeInTheDocument()
  })

  test('deletes a template and can undo it from the toast', async () => {
    const user = userEvent.setup()
    seedTemplates()
    renderInRouter(<TemplatesTab />)

    await user.click(screen.getByRole('button', { name: '출장 준비 삭제' }))
    expect(state().entities.templates['tpl-task']).toBeUndefined()

    state().undo()
    expect(state().entities.templates['tpl-task']).toBeDefined()
  })

  test('creates tasks from a task template in the chosen project with a base date, then opens the project', async () => {
    const user = userEvent.setup()
    seedTemplates()
    renderInRouter(<TemplatesTab />)

    await user.click(screen.getByRole('button', { name: '출장 준비 불러오기' }))
    await user.selectOptions(screen.getByLabelText('넣을 프로젝트'), 'work')
    fireEvent.change(screen.getByLabelText('기준일'), { target: { value: '2027-05-03' } })
    await user.click(screen.getByRole('button', { name: '할 일 만들기' }))

    await waitFor(() => expect(Object.values(state().entities.tasks).filter((t) => t.startDate === '2027-05-03')).toHaveLength(1))
    const created = Object.values(state().entities.tasks).filter((t) => t.startDate !== null && t.startDate >= '2027-01-01')
    expect(created.map((t) => [t.title, t.startDate]).sort()).toEqual([
      ['출장', '2027-05-03'],
      ['항공권', '2027-05-04'],
    ])
    expect(screen.getByTestId('location')).toHaveTextContent('/project/work')
  })

  test('creates a new project from a project template and navigates to it', async () => {
    const user = userEvent.setup()
    seedTemplates()
    renderInRouter(<TemplatesTab />)

    await user.click(screen.getByRole('button', { name: '업무 기본 틀 불러오기' }))
    const name = screen.getByLabelText('새 프로젝트 이름')
    await user.clear(name)
    await user.type(name, '2분기 업무')
    await user.click(screen.getByRole('button', { name: '프로젝트 만들기' }))

    const project = Object.values(state().entities.projects).find((p) => p.name === '2분기 업무')
    expect(project).toBeDefined()
    expect(screen.getByTestId('location')).toHaveTextContent(`/project/${project?.id}`)
    expect(Object.values(state().entities.tasks).filter((t) => t.projectId === project?.id)).toHaveLength(2)
  })

  test('disables loading a template whose content cannot be read', () => {
    state().commit({ puts: { templates: [{ id: 'bad', name: '깨진 템플릿', kind: 'task', payload: 'x', createdAt: 1 }] }, deletes: {} }, '준비', {
      history: false,
    })
    renderInRouter(<TemplatesTab />)

    expect(screen.getByRole('button', { name: '깨진 템플릿 불러오기' })).toBeDisabled()
    expect(screen.getByText(/내용을 읽을 수 없어요/)).toBeInTheDocument()
  })

  test('saves a project as a template from the form', async () => {
    const user = userEvent.setup()
    state().commit({ puts: { projects: [makeProject({ id: 'p', name: '이사', order: 1 })], tasks: [makeTask({ id: 't', projectId: 'p' })] }, deletes: {} }, '준비', {
      history: false,
    })
    renderInRouter(<TemplatesTab />)

    await user.selectOptions(screen.getByLabelText('프로젝트'), 'p')
    await user.type(screen.getByLabelText('템플릿 이름'), '이사 체크리스트')
    await user.click(screen.getByRole('button', { name: /템플릿으로 저장/ }))

    const saved = Object.values(state().entities.templates)
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ name: '이사 체크리스트', kind: 'project' })
    expect(await screen.findByText('이사 체크리스트')).toBeInTheDocument()
  })
})
