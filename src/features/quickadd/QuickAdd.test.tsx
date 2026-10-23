import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useApp } from '../../store/app'
import { useUI } from '../../store/ui'
import { renderApp, resetApp } from '../../test/render'
import { QuickAdd } from './QuickAdd'

// jsdom은 <dialog>의 showModal을 구현하지 않는다.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open')
  }
})

beforeEach(async () => {
  await resetApp()
})

const tasks = () => Object.values(useApp.getState().entities.tasks)

describe('QuickAdd', () => {
  test('creates a task from natural language and recognised symbols', async () => {
    const user = userEvent.setup()
    useApp.setState((s) => ({ entities: { ...s.entities, projects: { ...s.entities.projects, w: { ...s.entities.projects.inbox, id: 'w', name: '업무' } } } }))
    renderApp(<QuickAdd />)
    useUI.getState().openQuickAdd()

    const input = await screen.findByLabelText('새 할 일')
    await user.type(input, '내일 오후 3시 팀 회의 #업무 p1')
    await user.keyboard('{Enter}')

    await waitFor(() => expect(tasks()).toHaveLength(1))
    const [task] = tasks()
    expect(task).toMatchObject({ title: '팀 회의', projectId: 'w', priority: 1, startTime: '15:00' })
    expect(task.startDate).not.toBeNull()
  })

  test('shows chips for what it recognised', async () => {
    const user = userEvent.setup()
    renderApp(<QuickAdd />)
    useUI.getState().openQuickAdd()

    await user.type(await screen.findByLabelText('새 할 일'), '보고서 내일 p2')

    const chips = await screen.findByRole('list', { name: '인식한 항목' })
    expect(within(chips).getAllByRole('listitem').length).toBeGreaterThanOrEqual(2)
  })

  test('does not submit an empty title', async () => {
    const user = userEvent.setup()
    renderApp(<QuickAdd />)
    useUI.getState().openQuickAdd()

    await screen.findByLabelText('새 할 일')
    expect(screen.getByRole('button', { name: /추가/ })).toBeDisabled()
    await user.keyboard('{Enter}')

    expect(tasks()).toHaveLength(0)
  })

  test('multi-line input creates subtasks from indentation', async () => {
    const user = userEvent.setup()
    renderApp(<QuickAdd />)
    useUI.getState().openQuickAdd()

    const input = await screen.findByLabelText('새 할 일')
    await user.type(input, '장보기{Shift>}{Enter}{/Shift}  우유{Shift>}{Enter}{/Shift}  계란')
    await user.click(screen.getByRole('button', { name: /^추가/ }))

    await waitFor(() => expect(tasks()).toHaveLength(3))
    const parent = tasks().find((t) => t.title === '장보기')
    const children = tasks().filter((t) => t.parentId === parent?.id)
    expect(children.map((c) => c.title).sort()).toEqual(['계란', '우유'])
  })

  test('creates an unknown label named in the text', async () => {
    const user = userEvent.setup()
    renderApp(<QuickAdd />)
    useUI.getState().openQuickAdd()

    await user.type(await screen.findByLabelText('새 할 일'), '책 읽기 @독서')
    await user.keyboard('{Enter}')

    await waitFor(() => expect(tasks()).toHaveLength(1))
    const labels = Object.values(useApp.getState().entities.labels)
    expect(labels.map((l) => l.name)).toContain('독서')
    expect(tasks()[0].labelIds).toHaveLength(1)
  })
})
