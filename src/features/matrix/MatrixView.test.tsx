import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'
import { useTable } from '../../hooks/data'
import { useApp } from '../../store/app'
import { makeProject, makeTask } from '../../test/factories'
import { renderApp, resetApp } from '../../test/render'
import { MatrixView } from './MatrixView'

beforeEach(async () => {
  await resetApp()
})

function Matrix() {
  const { search } = useLocation()
  const tasks = useTable('tasks')
  return (
    <>
      <p data-testid="search">{search}</p>
      <MatrixView tasks={tasks} />
    </>
  )
}

function seed(): void {
  useApp.getState().commit(
    {
      puts: {
        projects: [makeProject({ id: 'p1', name: '집안일' })],
        tasks: [
          makeTask({ id: 'a', title: '급하고 중요', priority: 1, order: 1 }),
          makeTask({ id: 'b', title: '중요하지만 여유', priority: 2, order: 2 }),
          makeTask({ id: 'c', title: '급한 잡무', priority: 3, order: 3, projectId: 'p1' }),
          makeTask({ id: 'd', title: '우선순위 없음', priority: 4, order: 4 }),
          makeTask({ id: 'e', title: '끝낸 중요 일', priority: 1, status: 'done', completedAt: 1, order: 5 }),
        ],
      },
      deletes: {},
    },
    'seed',
    { history: false },
  )
}

describe('MatrixView', () => {
  test('sorts open tasks into the four quadrants by priority', () => {
    seed()
    renderApp(<Matrix />)

    const quadrant = (name: string) => screen.getByRole('region', { name })
    expect(within(quadrant('지금 하기')).getByText('급하고 중요')).toBeInTheDocument()
    expect(within(quadrant('계획하기')).getByText('중요하지만 여유')).toBeInTheDocument()
    expect(within(quadrant('빠르게 처리')).getByText('급한 잡무')).toBeInTheDocument()
    expect(within(quadrant('나중에 · 버리기')).getByText('우선순위 없음')).toBeInTheDocument()
  })

  test('leaves finished tasks out and shows the count in each quadrant header', () => {
    seed()
    renderApp(<Matrix />)

    expect(screen.queryByText('끝낸 중요 일')).not.toBeInTheDocument()
    const first = screen.getByRole('region', { name: '지금 하기' })
    expect(within(first).getByRole('heading', { name: '지금 하기' }).parentElement).toHaveTextContent('1')
    expect(within(first).getByText('중요하고 급함 · P1')).toBeInTheDocument()
  })

  test('shows a drop hint in an empty quadrant', () => {
    renderApp(<Matrix />)

    expect(screen.getAllByText('여기로 끌어다 놓으면 우선순위가 바뀌어요')).toHaveLength(4)
  })

  test('shows the project name on cards and opens a task when its card is clicked', async () => {
    const user = userEvent.setup()
    seed()
    renderApp(<Matrix />)
    const quad = screen.getByRole('region', { name: '빠르게 처리' })
    expect(within(quad).getByText('집안일')).toBeInTheDocument()

    await user.click(within(quad).getByText('급한 잡무'))

    expect(screen.getByTestId('search')).toHaveTextContent('task=c')
  })

  test('completing a task from its card removes it from the matrix', async () => {
    const user = userEvent.setup()
    seed()
    renderApp(<Matrix />)

    await user.click(screen.getByRole('checkbox', { name: '"급하고 중요" 완료' }))

    expect(useApp.getState().entities.tasks.a.status).toBe('done')
  })
})

describe('MatrixView keyboard pick-up', () => {
  test('picking a card up with Space shows it floating and Escape puts it back unchanged', async () => {
    const user = userEvent.setup()
    seed()
    renderApp(<Matrix />)
    const grip = within(screen.getByRole('region', { name: '지금 하기' })).getByRole('button', { name: '끌어서 옮기기' })

    grip.focus()
    await user.keyboard(' ')
    await waitFor(() => expect(screen.getAllByText('급하고 중요').length).toBeGreaterThan(1))

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.getAllByText('급하고 중요')).toHaveLength(1))
    expect(useApp.getState().entities.tasks.a.priority).toBe(1)
  })
})
