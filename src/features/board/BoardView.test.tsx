import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useTable } from '../../hooks/data'
import { useApp } from '../../store/app'
import { useUI } from '../../store/ui'
import { makeProject, makeSection, makeTask } from '../../test/factories'
import { renderApp, resetApp } from '../../test/render'
import { BoardView } from './BoardView'

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

function Board() {
  const tasks = useTable('tasks').filter((t) => t.projectId === 'p1' && t.deletedAt === null)
  const sections = useTable('sections')
    .filter((s) => s.projectId === 'p1')
    .sort((a, b) => a.order - b.order)
  return <BoardView projectId="p1" tasks={tasks} sections={sections} />
}

const sections = () => Object.values(useApp.getState().entities.sections).sort((a, b) => a.order - b.order)
const column = (name: string) => screen.getByRole('region', { name })

function seed(withSections: boolean): void {
  useApp.getState().commit(
    {
      puts: {
        projects: [makeProject({ id: 'p1', name: '칸반 프로젝트' })],
        sections: withSections
          ? [
              makeSection({ id: 'todo', projectId: 'p1', name: '대기', order: 1, category: 'todo' }),
              makeSection({ id: 'done', projectId: 'p1', name: '끝', order: 2, category: 'done' }),
            ]
          : [],
        tasks: [
          makeTask({ id: 'loose', title: '분류 전', projectId: 'p1', order: 1 }),
          makeTask({ id: 'queued', title: '대기 중', projectId: 'p1', sectionId: 'todo', order: 1 }),
          makeTask({ id: 'finished', title: '끝낸 카드', projectId: 'p1', sectionId: 'done', status: 'done', completedAt: 1, order: 1 }),
          makeTask({ id: 'child', title: '하위 카드', projectId: 'p1', sectionId: 'todo', parentId: 'queued', order: 2 }),
          makeTask({ id: 'stray', title: '사라진 섹션 카드', projectId: 'p1', sectionId: 'removed', order: 2 }),
          makeTask({ id: 'doneloose', title: '끝났지만 열 없음', projectId: 'p1', status: 'done', completedAt: 1, order: 3 }),
        ],
      },
      deletes: {},
    },
    'seed',
    { history: false },
  )
}

describe('BoardView', () => {
  test('puts each task in its section column and unsorted ones in the first column', () => {
    seed(true)
    renderApp(<Board />)

    expect(within(column('섹션 없음')).getByText('분류 전')).toBeInTheDocument()
    expect(within(column('섹션 없음')).getByText('사라진 섹션 카드')).toBeInTheDocument()
    expect(within(column('대기')).getByText('대기 중')).toBeInTheDocument()
    expect(within(column('끝')).getByText('끝낸 카드')).toBeInTheDocument()
  })

  test('hides subtasks and finished cards except in a column that means done', () => {
    seed(true)
    renderApp(<Board />)

    expect(screen.queryByText('하위 카드')).not.toBeInTheDocument()
    expect(screen.queryByText('끝났지만 열 없음')).not.toBeInTheDocument()
  })

  test('offers to create the three standard columns only while there are none', () => {
    seed(true)
    const { unmount } = renderApp(<Board />)
    expect(screen.queryByRole('button', { name: /할 일 · 진행 중 · 완료로 시작/ })).not.toBeInTheDocument()
    unmount()

    seed(false)
    useApp.getState().commit({ puts: {}, deletes: { sections: ['todo', 'done'] } }, 'clear', { history: false })
    renderApp(<Board />)
    expect(screen.getByRole('button', { name: /할 일 · 진행 중 · 완료로 시작/ })).toBeInTheDocument()
  })

  test('creating the three standard columns is one undo step', async () => {
    const user = userEvent.setup()
    seed(false)
    renderApp(<Board />)
    const undoBefore = useApp.getState().undoStack.length

    await user.click(screen.getByRole('button', { name: /할 일 · 진행 중 · 완료로 시작/ }))

    expect(sections().map((s) => [s.name, s.category])).toEqual([
      ['할 일', 'todo'],
      ['진행 중', 'active'],
      ['완료', 'done'],
    ])
    expect(useApp.getState().undoStack).toHaveLength(undoBefore + 1)
    expect(screen.getByRole('region', { name: '진행 중' })).toBeInTheDocument()

    useApp.getState().undo()
    expect(sections()).toHaveLength(0)
    await waitFor(() => expect(screen.queryByRole('region', { name: '진행 중' })).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: /할 일 · 진행 중 · 완료로 시작/ })).toBeInTheDocument()
  })

  test('adds a column with Enter, exactly once, and ignores empty names and Escape', async () => {
    const user = userEvent.setup()
    seed(true)
    renderApp(<Board />)

    await user.click(screen.getByRole('button', { name: /열 추가/ }))
    await user.type(screen.getByRole('textbox', { name: '새 열 이름' }), '검토{Enter}')
    await waitFor(() => expect(sections().map((s) => s.name)).toEqual(['대기', '끝', '검토']))
    expect(screen.getByRole('region', { name: '검토' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /열 추가/ }))
    await user.type(screen.getByRole('textbox', { name: '새 열 이름' }), '버릴 열{Escape}')
    await user.click(screen.getByRole('button', { name: /열 추가/ }))
    await user.type(screen.getByRole('textbox', { name: '새 열 이름' }), '   {Enter}')

    expect(sections()).toHaveLength(3)
  })

  test('adds a column when the name field loses focus', async () => {
    const user = userEvent.setup()
    seed(true)
    renderApp(<Board />)

    await user.click(screen.getByRole('button', { name: /열 추가/ }))
    await user.type(screen.getByRole('textbox', { name: '새 열 이름' }), '배포')
    await user.click(document.body)

    await waitFor(() => expect(sections().map((s) => s.name)).toContain('배포'))
  })

  test("each column's add button opens quick add for that section", async () => {
    const user = userEvent.setup()
    seed(true)
    renderApp(<Board />)

    await user.click(within(column('대기')).getByRole('button', { name: /작업 추가/ }))
    expect(useUI.getState().quickAdd).toEqual({ open: true, defaults: { projectId: 'p1', sectionId: 'todo' } })

    await user.click(within(column('섹션 없음')).getByRole('button', { name: /작업 추가/ }))
    expect(useUI.getState().quickAdd).toEqual({ open: true, defaults: { projectId: 'p1', sectionId: null } })
  })

  test('shows the number of cards in each column header', () => {
    seed(true)
    renderApp(<Board />)

    expect(within(column('섹션 없음')).getByRole('heading', { name: /분류 안 됨/ })).toHaveTextContent('2')
    expect(within(column('대기')).getByRole('heading')).toHaveTextContent('1')
  })
})

describe('BoardView keyboard pick-up', () => {
  test('picking a card up with Space floats it and Escape drops it back where it was', async () => {
    const user = userEvent.setup()
    seed(true)
    renderApp(<Board />)
    const grip = within(column('대기')).getByRole('button', { name: '끌어서 옮기기' })

    grip.focus()
    await user.keyboard(' ')
    await waitFor(() => expect(screen.getAllByText('대기 중').length).toBeGreaterThan(1))

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.getAllByText('대기 중')).toHaveLength(1))
    expect(useApp.getState().entities.tasks.queued.sectionId).toBe('todo')
  })
})
