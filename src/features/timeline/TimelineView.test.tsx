import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'
import { useTable } from '../../hooks/data'
import { useApp } from '../../store/app'
import { makeTask } from '../../test/factories'
import { renderApp, resetApp } from '../../test/render'
import { TimelineView } from './TimelineView'

beforeAll(() => {
  // jsdom 에는 포인터 캡처가 없다. 이동 없이 누르고 떼는 흐름만 확인하므로 빈 함수면 충분하다.
  HTMLElement.prototype.setPointerCapture = vi.fn()
})

beforeEach(async () => {
  await resetApp()
})

function Where() {
  const { pathname, search } = useLocation()
  return <p data-testid="where">{pathname + search}</p>
}

function Timeline() {
  const tasks = useTable('tasks')
  return (
    <>
      <Where />
      <TimelineView tasks={tasks} />
    </>
  )
}

const address = () => decodeURIComponent(screen.getByTestId('where').textContent ?? '')
const task = (id: string) => useApp.getState().entities.tasks[id]

function seed(): void {
  useApp.getState().commit(
    {
      puts: {
        tasks: [
          makeTask({ id: 'span', title: '긴 작업', startDate: '2026-03-12', dueDate: '2026-03-16', order: 1 }),
          makeTask({ id: 'due', title: '마감만 있는 일', dueDate: '2026-03-20', order: 2 }),
          makeTask({ id: 'far', title: '범위 밖 일', startDate: '2027-01-01', order: 3 }),
          makeTask({ id: 'nodate', title: '날짜 없는 일', order: 4 }),
          makeTask({ id: 'done', title: '끝난 일', startDate: '2026-03-12', status: 'done', completedAt: 1, order: 5 }),
          makeTask({ id: 'off', title: '취소한 일', startDate: '2026-03-12', status: 'canceled', order: 6 }),
          makeTask({ id: 'later', title: '언젠가 일', startDate: '2026-03-12', someday: true, order: 7 }),
          makeTask({ id: 'gone', title: '지운 일', startDate: '2026-03-12', deletedAt: 1, order: 8 }),
        ],
      },
      deletes: {},
    },
    'seed',
    { history: false },
  )
}

describe('TimelineView', () => {
  test('draws a bar for each dated open task and lists the undated ones separately', () => {
    seed()
    renderApp(<Timeline />, '/timeline?from=2026-03-10&zoom=28')

    expect(screen.getByRole('button', { name: '긴 작업 일정 막대' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '마감만 있는 일 일정 막대' })).toBeInTheDocument()
    const undated = screen.getByRole('region', { name: '날짜 없는 할 일' })
    expect(within(undated).getByText('날짜 없는 일')).toBeInTheDocument()
    for (const hidden of ['끝난 일', '취소한 일', '언젠가 일', '지운 일']) {
      expect(screen.queryByText(hidden)).not.toBeInTheDocument()
    }
  })

  test('lists a task outside the visible range on its row but draws no bar for it', () => {
    seed()
    renderApp(<Timeline />, '/timeline?from=2026-03-10&zoom=28')

    expect(screen.getByRole('button', { name: '범위 밖 일' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '범위 밖 일 일정 막대' })).not.toBeInTheDocument()
  })

  test('shows the day columns for the chosen range and marks the first of a month', () => {
    renderApp(<Timeline />, '/timeline?from=2026-02-27&zoom=14')

    expect(screen.getByText('3월')).toBeInTheDocument()
    expect(screen.getAllByText('토').length).toBeGreaterThan(0)
  })

  test('says so when no task has a date', () => {
    renderApp(<Timeline />, '/timeline')

    expect(screen.getByText(/날짜가 있는 할 일이 없어요/)).toBeInTheDocument()
  })

  test('previous, next and zoom change the range in the address', async () => {
    const user = userEvent.setup()
    renderApp(<Timeline />, '/timeline?from=2026-03-10&zoom=28')

    await user.click(screen.getByRole('button', { name: '다음' }))
    expect(address()).toContain('from=2026-03-17')

    await user.click(screen.getByRole('button', { name: '이전' }))
    await user.click(screen.getByRole('button', { name: '이전' }))
    expect(address()).toContain('from=2026-03-03')

    await user.click(screen.getByRole('tab', { name: '8주' }))
    expect(address()).toContain('zoom=56')
    expect(screen.getByRole('tab', { name: '8주' })).toHaveAttribute('aria-selected', 'true')
  })

  test('the today button brings the range back near today', async () => {
    const user = userEvent.setup()
    renderApp(<Timeline />, '/timeline?from=2026-03-10')

    await user.click(screen.getByRole('button', { name: '오늘' }))

    expect(address()).not.toContain('from=2026-03-10')
    expect(address()).toMatch(/from=\d{4}-\d{2}-\d{2}/)
  })

  test('opens a task from its row label or by pressing Enter on its bar', async () => {
    const user = userEvent.setup()
    seed()
    renderApp(<Timeline />, '/timeline?from=2026-03-10&zoom=28')

    await user.click(screen.getByRole('button', { name: '긴 작업' }))
    expect(address()).toContain('task=span')

    screen.getByRole('button', { name: '마감만 있는 일 일정 막대' }).focus()
    await user.keyboard('{Enter}')
    expect(address()).toContain('task=due')
  })

  test('"오늘로" gives an undated task a start date of today', async () => {
    const user = userEvent.setup()
    seed()
    renderApp(<Timeline />, '/timeline?from=2026-03-10&zoom=28')
    const undated = screen.getByRole('region', { name: '날짜 없는 할 일' })

    await user.click(within(undated).getByRole('button', { name: '오늘로' }))

    expect(task('nodate').startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(useApp.getState().undoStack.at(-1)?.label).toBe('일정 지정')
  })

  test('opens a task from the untimed list by its title', async () => {
    const user = userEvent.setup()
    seed()
    renderApp(<Timeline />, '/timeline?from=2026-03-10&zoom=28')

    await user.click(within(screen.getByRole('region', { name: '날짜 없는 할 일' })).getByRole('button', { name: '날짜 없는 일' }))

    expect(address()).toContain('task=nodate')
  })

  test('clicking an empty day on a deadline-only row schedules it on that day', () => {
    seed()
    renderApp(<Timeline />, '/timeline?from=2026-03-10&zoom=28')
    const row = screen.getByRole('button', { name: '마감만 있는 일' }).closest('.tl__row') as HTMLElement

    // jsdom 은 레이아웃이 없어 왼쪽이 0 이다. 칸 하나가 36px 이므로 clientX 113 은 네 번째 칸(3월 13일)이다.
    fireEvent.click(row.querySelectorAll('.tl__track i[data-cell]')[3], { clientX: 113 })

    expect(task('due').startDate).toBe('2026-03-13')
  })

  test('clicking a day on a row that already has a start date changes nothing', () => {
    seed()
    renderApp(<Timeline />, '/timeline?from=2026-03-10&zoom=28')
    const row = screen.getByRole('button', { name: '긴 작업' }).closest('.tl__row') as HTMLElement

    fireEvent.click(row.querySelectorAll('.tl__track i[data-cell]')[0], { clientX: 5 })

    expect(task('span').startDate).toBe('2026-03-12')
  })

  test('pressing a bar and releasing it without moving opens the task and keeps its dates', () => {
    seed()
    renderApp(<Timeline />, '/timeline?from=2026-03-10&zoom=28')
    const bar = screen.getByRole('button', { name: '긴 작업 일정 막대' })

    fireEvent.pointerDown(bar, { button: 0, pointerId: 1, clientX: 100 })
    fireEvent.pointerUp(bar, { pointerId: 1, clientX: 100 })

    expect(address()).toContain('task=span')
    expect(task('span')).toMatchObject({ startDate: '2026-03-12', dueDate: '2026-03-16' })
  })
})
