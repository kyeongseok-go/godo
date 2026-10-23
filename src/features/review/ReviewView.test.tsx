import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'
import { addDays, todayOf } from '../../domain/date'
import type { Task } from '../../domain/types'
import { useApp } from '../../store/app'
import { makeTask } from '../../test/factories'
import { renderApp, resetApp } from '../../test/render'
import { useToasts } from '../../ui/toast'
import { ReviewView } from './ReviewView'

const DAY = 86_400_000
const today = (): string => todayOf(new Date(), useApp.getState().settings.dayStartHour)
const taskOf = (id: string): Task => useApp.getState().entities.tasks[id]

function seed(tasks: Task[]): void {
  useApp.getState().commit({ puts: { tasks }, deletes: {} }, 'seed', { history: false })
}

const stale = (id: string, title: string, extra: Partial<Task> = {}) =>
  makeTask({ id, title, updatedAt: Date.now() - 30 * DAY, ...extra })

function LocationProbe() {
  return <output data-testid="search">{useLocation().search}</output>
}

const renderReview = (route = '/review') =>
  renderApp(
    <>
      <ReviewView />
      <LocationProbe />
    </>,
    route,
  )

const rowOf = (title: string): HTMLElement => {
  const row = screen.getByText(title).closest<HTMLElement>('[data-task-id]')
  if (!row) throw new Error(`row not found: ${title}`)
  return row
}

beforeEach(async () => {
  await resetApp()
  useToasts.setState({ toasts: [] })
})

describe('ReviewView', () => {
  test('groups candidates by reason with the most urgent group first', () => {
    seed([
      stale('s', '묵은 일'),
      makeTask({ id: 'o', title: '마감 지난 일', dueDate: addDays(today(), -3), updatedAt: Date.now() }),
      makeTask({ id: 'p', title: '미룬 일', postponeCount: 4, updatedAt: Date.now() }),
    ])

    renderReview()

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings).toEqual(['마감이 지났어요1', '자주 미뤘어요1', '오래 묵었어요1'])
  })

  test('the K key on a focused item keeps it: refreshes the record, hides the item and offers undo', async () => {
    const user = userEvent.setup()
    seed([stale('a', '묵은 일'), stale('b', '또 묵은 일')])
    renderReview()

    act(() => rowOf('묵은 일').focus())
    await user.keyboard('k')

    expect(taskOf('a').updatedAt).toBeGreaterThan(Date.now() - 5_000)
    expect(screen.queryByText('묵은 일', { exact: true })).not.toBeInTheDocument()
    expect(screen.getByText('또 묵은 일')).toBeInTheDocument()
    expect(useToasts.getState().toasts.at(-1)).toMatchObject({ message: '유지했어요: "묵은 일"', actionLabel: '되돌리기' })
    expect(useApp.getState().undoStack.at(-1)?.label).toBe('리뷰: 유지')
  })

  test('moves focus to the neighbouring item after handling one', async () => {
    const user = userEvent.setup()
    seed([stale('a', '첫째', { order: 1 }), stale('b', '둘째', { order: 2 })])
    renderReview()

    act(() => rowOf('첫째').focus())
    await user.keyboard('k')

    await waitFor(() => expect(rowOf('둘째')).toHaveFocus())
  })

  test.each([
    ['t', (t: Task) => t.startDate === today()],
    ['w', (t: Task) => t.startDate === addDays(today(), 7 - ((new Date().getDay() + 6) % 7)) && t.postponeCount === 1],
    ['s', (t: Task) => t.someday && t.startDate === null],
    ['x', (t: Task) => t.status === 'canceled'],
  ])('the %s key applies its action', async (key, check) => {
    const user = userEvent.setup()
    seed([stale('a', '묵은 일')])
    renderReview()

    act(() => rowOf('묵은 일').focus())
    await user.keyboard(key)

    expect(check(taskOf('a'))).toBe(true)
  })

  test('letters pressed on other elements do nothing', async () => {
    const user = userEvent.setup()
    seed([stale('a', '묵은 일')])
    renderReview()

    await user.keyboard('x')

    expect(taskOf('a').status).toBe('todo')
  })

  test('buttons do the same, and delete sends the item to the trash', async () => {
    const user = userEvent.setup()
    seed([stale('a', '묵은 일')])
    renderReview()

    await user.click(screen.getByRole('button', { name: '삭제: 묵은 일' }))

    expect(taskOf('a').deletedAt).not.toBeNull()
  })

  test('shows the clean state with a count once everything is handled', async () => {
    const user = userEvent.setup()
    seed([stale('a', '하나'), stale('b', '둘')])
    renderReview()

    await user.click(screen.getByRole('button', { name: '유지: 하나' }))
    await user.click(screen.getByRole('button', { name: '유지: 둘' }))

    expect(screen.getByText('깨끗해졌어요')).toBeInTheDocument()
    expect(screen.getByText(/2개를 정리했어요/)).toBeInTheDocument()
  })

  test('shows the clean state right away when nothing needs review', () => {
    renderReview()

    expect(screen.getByText('깨끗해졌어요')).toBeInTheDocument()
    expect(screen.getByText(/리뷰할 일이 없어요/)).toBeInTheDocument()
  })

  test('the undo toast brings the item back', async () => {
    const user = userEvent.setup()
    seed([stale('a', '묵은 일')])
    renderReview()

    await user.click(screen.getByRole('button', { name: '언젠가로: 묵은 일' }))
    expect(screen.queryByText('묵은 일')).not.toBeInTheDocument()
    act(() => useToasts.getState().toasts.at(-1)?.onAction?.())

    expect(await screen.findByText('묵은 일')).toBeInTheDocument()
    expect(taskOf('a').someday).toBe(false)
  })

  test('an undo that is no longer the latest action explains itself instead of undoing the wrong one', async () => {
    const user = userEvent.setup()
    seed([stale('a', '하나'), stale('b', '둘')])
    renderReview()

    await user.click(screen.getByRole('button', { name: '유지: 하나' }))
    const firstUndo = useToasts.getState().toasts.at(-1)?.onAction
    await user.click(screen.getByRole('button', { name: '유지: 둘' }))
    act(() => firstUndo?.())

    expect(useToasts.getState().toasts.at(-1)?.message).toMatch(/가장 최근 것부터/)
    expect(screen.queryByText('하나')).not.toBeInTheDocument()
  })

  test('a handled item reappears when it is edited again after handling', async () => {
    const user = userEvent.setup()
    seed([stale('a', '묵은 일')])
    renderReview()
    await user.click(screen.getByRole('button', { name: '유지: 묵은 일' }))

    act(() => useApp.getState().commit({ puts: { tasks: [{ ...taskOf('a'), updatedAt: 1 }] }, deletes: {} }, 'edit'))

    expect(await screen.findByText('묵은 일')).toBeInTheDocument()
  })

  test('reads the criteria from the URL and writes changes back', async () => {
    const user = userEvent.setup()
    seed([makeTask({ id: 'a', title: '20일 묵음', updatedAt: Date.now() - 20 * DAY })])
    renderReview('/review?stale=30')

    expect(screen.getByText('깨끗해졌어요')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '묵은 일수 기준 줄이기' }))

    expect(screen.getByTestId('search')).toHaveTextContent('stale=29')
    expect(within(screen.getByRole('group', { name: '묵은 일수 기준' })).getByText('29')).toBeInTheDocument()
    for (let i = 0; i < 15; i += 1) await user.click(screen.getByRole('button', { name: '묵은 일수 기준 줄이기' }))
    expect(await screen.findByText('20일 묵음')).toBeInTheDocument()
  })

  test('the postponement threshold is editable and lives in the URL too', async () => {
    const user = userEvent.setup()
    seed([makeTask({ id: 'a', title: '세 번 미룸', postponeCount: 3, updatedAt: Date.now() })])
    renderReview()
    expect(screen.getByText('세 번 미룸')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '미룬 횟수 기준 늘리기' }))

    expect(screen.getByTestId('search')).toHaveTextContent('postponed=4')
    expect(screen.queryByText('세 번 미룸')).not.toBeInTheDocument()
  })

  test('completing from the checkbox removes the item too', async () => {
    const user = userEvent.setup()
    seed([stale('a', '묵은 일')])
    renderReview()

    await user.click(screen.getByRole('checkbox', { name: '"묵은 일" 완료' }))

    await waitFor(() => expect(taskOf('a').status).toBe('done'))
    expect(screen.queryByText('묵은 일')).not.toBeInTheDocument()
  })
})
