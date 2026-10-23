import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'
import { formatDayTitle, formatMonthTitle } from '../../domain/format'
import { todayOf } from '../../domain/date'
import type { QuickAddDefaults } from '../../store/ui'
import { useUI } from '../../store/ui'
import { useTable } from '../../hooks/data'
import { useApp } from '../../store/app'
import { makeTask } from '../../test/factories'
import { renderApp, resetApp } from '../../test/render'
import { CalendarView } from './CalendarView'

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
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

function Calendar({ defaults }: { defaults?: QuickAddDefaults }) {
  const tasks = useTable('tasks')
  return (
    <>
      <Where />
      <CalendarView tasks={tasks} defaults={defaults} />
    </>
  )
}

const address = () => decodeURIComponent(screen.getByTestId('where').textContent ?? '')
const title = () => screen.getByRole('heading', { level: 2 }).textContent
const month = () => screen.getByRole('group', { name: '월간 달력' })

function seed(): void {
  const crowded = ['가', '나', '다', '라'].map((name, i) => makeTask({ id: `c${i}`, title: `겹침 ${name}`, startDate: '2026-03-20', order: i + 1 }))
  useApp.getState().commit(
    {
      puts: {
        tasks: [
          makeTask({ id: 'a', title: '발표 준비', startDate: '2026-03-10', startTime: '14:00', durationMin: 60 }),
          makeTask({ id: 'b', title: '마감 보고', dueDate: '2026-03-12' }),
          makeTask({ id: 'gone', title: '지운 일정', startDate: '2026-03-10', deletedAt: 1 }),
          ...crowded,
        ],
      },
      deletes: {},
    },
    'seed',
    { history: false },
  )
}

describe('CalendarView month', () => {
  test('shows the month of the date in the address with tasks on their start or due date', () => {
    seed()
    renderApp(<Calendar />, '/calendar?date=2026-03-15')

    expect(title()).toBe('2026년 3월')
    expect(within(month()).getByRole('button', { name: /발표 준비/ })).toBeInTheDocument()
    expect(within(month()).getByRole('button', { name: /마감 보고/ })).toBeInTheDocument()
    expect(screen.queryByText('지운 일정')).not.toBeInTheDocument()
  })

  test('shows the start time on a chip and follows the 12 hour setting', () => {
    seed()
    const { unmount } = renderApp(<Calendar />, '/calendar?date=2026-03-15')
    expect(screen.getByText('14:00')).toBeInTheDocument()
    unmount()

    useApp.getState().updateSettings({ timeFormat: '12h' })
    renderApp(<Calendar />, '/calendar?date=2026-03-15')
    expect(screen.getByText('오후 2:00')).toBeInTheDocument()
  })

  test('starts the week on the day chosen in settings', () => {
    const weekdays = () => within(month()).getAllByText(/^[일월화수목금토]$/).map((e) => e.textContent)
    const { unmount } = renderApp(<Calendar />, '/calendar?date=2026-03-15')
    expect(weekdays().slice(0, 3)).toEqual(['월', '화', '수'])
    unmount()

    useApp.getState().updateSettings({ weekStartsOn: 0 })
    renderApp(<Calendar />, '/calendar?date=2026-03-15')
    expect(weekdays().slice(0, 3)).toEqual(['일', '월', '화'])
  })

  test('clicking a day opens quick add on that date, keeping the surrounding defaults', async () => {
    const user = userEvent.setup()
    renderApp(<Calendar defaults={{ projectId: 'p9' }} />, '/calendar?date=2026-03-15')

    await user.click(within(month()).getByText('15'))

    expect(useUI.getState().quickAdd).toEqual({ open: true, defaults: { projectId: 'p9', startDate: '2026-03-15' } })
  })

  test('clicking a chip opens the task without starting a new one', async () => {
    const user = userEvent.setup()
    seed()
    renderApp(<Calendar />, '/calendar?date=2026-03-15')

    await user.click(within(month()).getByRole('button', { name: /발표 준비/ }))

    expect(address()).toContain('task=a')
    expect(useUI.getState().quickAdd.open).toBe(false)
  })

  test('folds a crowded day into a "more" button that expands and collapses', async () => {
    const user = userEvent.setup()
    seed()
    renderApp(<Calendar />, '/calendar?date=2026-03-15')
    expect(screen.queryByRole('button', { name: /겹침 라/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '+1개 더' }))
    expect(screen.getByRole('button', { name: /겹침 라/ })).toBeInTheDocument()
    expect(useUI.getState().quickAdd.open).toBe(false)

    await user.click(screen.getByRole('button', { name: '접기' }))
    expect(screen.queryByRole('button', { name: /겹침 라/ })).not.toBeInTheDocument()
  })

  test('previous, next and today move the month and keep the address tidy', async () => {
    const user = userEvent.setup()
    renderApp(<Calendar />, '/calendar?date=2026-03-15')

    await user.click(screen.getByRole('button', { name: '다음' }))
    expect(title()).toBe('2026년 4월')
    expect(address()).toContain('date=2026-04-01')

    await user.click(screen.getByRole('button', { name: '이전' }))
    await user.click(screen.getByRole('button', { name: '이전' }))
    expect(title()).toBe('2026년 2월')

    await user.click(screen.getByRole('button', { name: '오늘' }))
    expect(title()).toBe(formatMonthTitle(todayOf(new Date(), 0)))
    expect(address()).not.toContain('date=')
  })
})

describe('CalendarView month drag', () => {
  test('lifting a chip floats a copy and Escape puts it back without changing its date', async () => {
    seed()
    renderApp(<Calendar />, '/calendar?date=2026-03-15')
    const chip = within(month()).getByRole('button', { name: /발표 준비/ })

    fireEvent.pointerDown(chip, { button: 0, isPrimary: true, pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(document, { isPrimary: true, pointerId: 1, clientX: 30, clientY: 0 })
    await waitFor(() => expect(screen.getAllByText('발표 준비').length).toBeGreaterThan(1))

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    await waitFor(() => expect(screen.getAllByText('발표 준비')).toHaveLength(1))
    expect(useApp.getState().entities.tasks.a.startDate).toBe('2026-03-10')

    // 끌기를 끝낸 직후에는 dnd-kit 이 잠깐 클릭을 삼킨다. 그 뒤에는 화면이 다시 반응해야 한다.
    const user = userEvent.setup()
    await waitFor(async () => {
      await user.click(screen.getByRole('button', { name: '다음' }))
      expect(title()).toBe('2026년 4월')
    })
  })
})

describe('CalendarView week and day', () => {
  test('switches between month, week and day with the tabs', async () => {
    const user = userEvent.setup()
    renderApp(<Calendar />, '/calendar?date=2026-03-15')
    const tabs = screen.getByRole('tablist', { name: '달력 단위' })
    expect(within(tabs).getByRole('tab', { name: '월' })).toHaveAttribute('aria-selected', 'true')

    await user.click(within(tabs).getByRole('tab', { name: '주' }))
    expect(title()).toBe('03/09 – 03/15')
    expect(address()).toContain('cal=week')
    expect(screen.queryByRole('group', { name: '월간 달력' })).not.toBeInTheDocument()

    await user.click(within(tabs).getByRole('tab', { name: '일' }))
    expect(title()).toBe('2026-03-15')

    await user.click(within(tabs).getByRole('tab', { name: '월' }))
    expect(address()).not.toContain('cal=')
    expect(month()).toBeInTheDocument()
  })

  test('steps a week at a time in week view and a day at a time in day view', async () => {
    const user = userEvent.setup()
    renderApp(<Calendar />, '/calendar?cal=week&date=2026-03-15')

    await user.click(screen.getByRole('button', { name: '다음' }))
    expect(title()).toBe('03/16 – 03/22')

    await user.click(screen.getByRole('tab', { name: '일' }))
    await user.click(screen.getByRole('button', { name: '이전' }))
    expect(title()).toBe('2026-03-21')
  })

  test('puts timed tasks in the grid and untimed ones in the day header', async () => {
    const user = userEvent.setup()
    seed()
    renderApp(<Calendar />, '/calendar?cal=week&date=2026-03-10')

    const block = screen.getByRole('button', { name: '발표 준비 14:00' })
    expect(block).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '마감 보고' })).toBeInTheDocument()

    block.focus()
    await user.keyboard('{Enter}')
    expect(address()).toContain('task=a')
  })

  test('shows a "+N" marker when a day has more than three untimed tasks', () => {
    seed()
    renderApp(<Calendar />, '/calendar?cal=day&date=2026-03-20')

    expect(screen.getAllByRole('button', { name: /겹침/ })).toHaveLength(3)
    expect(screen.getByText('+1')).toBeInTheDocument()
  })

  test('clicking an empty slot opens quick add at that day and half hour', () => {
    renderApp(<Calendar defaults={{ projectId: 'p9' }} />, '/calendar?cal=week&date=2026-03-10')
    const column = document.querySelector('[data-date="2026-03-10"]') as HTMLElement

    // jsdom 은 레이아웃이 없어 상자가 0 에 놓인다. 56px 이 한 시간이므로 clientY 560 은 10시 근처다.
    fireEvent.click(column, { clientY: 560 })

    expect(useUI.getState().quickAdd).toEqual({
      open: true,
      defaults: { projectId: 'p9', startDate: '2026-03-10', startTime: '10:00' },
    })
  })

  test('a click that lands on a task block does not start a new task', () => {
    seed()
    renderApp(<Calendar />, '/calendar?cal=week&date=2026-03-10')
    const block = screen.getByRole('button', { name: '발표 준비 14:00' })

    fireEvent.click(block)

    expect(useUI.getState().quickAdd.open).toBe(false)
  })

  test('follows the 12 hour setting in the grid labels', () => {
    seed()
    useApp.getState().updateSettings({ timeFormat: '12h' })
    renderApp(<Calendar />, '/calendar?cal=week&date=2026-03-10')

    expect(screen.getByRole('button', { name: '발표 준비 오후 2:00' })).toBeInTheDocument()
  })

  test('pressing a block and releasing it without moving opens the task instead of rescheduling it', () => {
    seed()
    renderApp(<Calendar />, '/calendar?cal=week&date=2026-03-10')
    const block = screen.getByRole('button', { name: '발표 준비 14:00' })

    fireEvent.pointerDown(block, { button: 0, pointerId: 1 })
    fireEvent.pointerUp(block, { pointerId: 1 })

    expect(address()).toContain('task=a')
    expect(useApp.getState().entities.tasks.a).toMatchObject({ startDate: '2026-03-10', startTime: '14:00' })
  })

  describe('a drag that barely moves', () => {
    const drag = (block: HTMLElement, clientY: number) => {
      fireEvent.pointerDown(block, { button: 0, pointerId: 1, clientX: 0, clientY: 0 })
      fireEvent.pointerMove(block, { pointerId: 1, clientX: 0, clientY })
      fireEvent.pointerUp(block, { pointerId: 1 })
    }

    test('still counts as a click: it opens the task and records no change', () => {
      seed()
      renderApp(<Calendar />, '/calendar?cal=week&date=2026-03-10')

      drag(screen.getByRole('button', { name: '발표 준비 14:00' }), 1)

      expect(address()).toContain('task=a')
      expect(useApp.getState().entities.tasks.a).toMatchObject({ startDate: '2026-03-10', startTime: '14:00' })
      expect(useApp.getState().undoStack).toHaveLength(0)
    })

    test('a real drag past the threshold does reschedule the task', () => {
      seed()
      renderApp(<Calendar />, '/calendar?cal=week&date=2026-03-10')

      // 56px 이 한 시간이다. 112px 아래로 끌면 두 시간 뒤가 된다.
      drag(screen.getByRole('button', { name: '발표 준비 14:00' }), 112)

      expect(useApp.getState().entities.tasks.a).toMatchObject({ startDate: '2026-03-10', startTime: '16:00' })
      expect(useApp.getState().undoStack.at(-1)?.label).toBe('일정 이동')
    })

    test('dragging back to the very same slot records nothing', () => {
      seed()
      renderApp(<Calendar />, '/calendar?cal=week&date=2026-03-10')
      const block = screen.getByRole('button', { name: '발표 준비 14:00' })

      fireEvent.pointerDown(block, { button: 0, pointerId: 1, clientX: 0, clientY: 0 })
      fireEvent.pointerMove(block, { pointerId: 1, clientX: 0, clientY: 112 })
      fireEvent.pointerMove(block, { pointerId: 1, clientX: 0, clientY: 0 })
      fireEvent.pointerUp(block, { pointerId: 1 })

      expect(useApp.getState().entities.tasks.a).toMatchObject({ startTime: '14:00' })
      expect(useApp.getState().undoStack).toHaveLength(0)
    })

    test('never writes a default duration onto a task that had none', () => {
      useApp.getState().commit(
        { puts: { tasks: [makeTask({ id: 'z', title: '통화', startDate: '2026-03-10', startTime: '09:00', durationMin: null })] }, deletes: {} },
        'seed',
        { history: false },
      )
      renderApp(<Calendar />, '/calendar?cal=week&date=2026-03-10')

      drag(screen.getByRole('button', { name: '통화 09:00' }), 112)

      expect(useApp.getState().entities.tasks.z).toMatchObject({ startTime: '11:00', durationMin: null })
    })
  })

describe('폰에서 보는 월간 달력', () => {
  /** jsdom 에는 matchMedia 가 없다. 좁은 화면인 척한다. */
  function pretendPhone() {
    window.matchMedia = ((query: string) => ({
      media: query,
      matches: query.includes('40rem'),
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    })) as unknown as typeof window.matchMedia
  }

  afterEach(() => {
    Reflect.deleteProperty(window, 'matchMedia')
  })

  test('날짜를 누르면 빠른 추가 대신 그날 목록이 펴진다', async () => {
    const user = userEvent.setup()
    useApp.getState().commit(
      {
        puts: {
          tasks: [
            makeTask({ id: 'a', title: '치과 예약', startDate: '2026-03-18', startTime: '14:00' }),
            makeTask({ id: 'b', title: '장보기', startDate: '2026-03-20' }),
          ],
        },
        deletes: {},
      },
      'seed',
      { history: false },
    )
    pretendPhone()
    renderApp(<Calendar />, '/calendar?date=2026-03-15')

    await user.click(within(month()).getByRole('button', { name: /^18/ }))

    const agenda = screen.getByRole('region', { name: '3월 18일 (수) 일정' })
    expect(within(agenda).getByText('치과 예약')).toBeInTheDocument()
    expect(within(agenda).queryByText('장보기')).not.toBeInTheDocument()
    // 폰에서는 칸을 눌러도 빠른 추가가 열리지 않는다
    expect(useUI.getState().quickAdd.open).toBe(false)
  })

  test('아무 날도 고르지 않았으면 오늘 목록을 보여 준다', () => {
    pretendPhone()
    renderApp(<Calendar />, '/calendar?date=2026-03-15')

    expect(screen.getByRole('region', { name: `${formatDayTitle(todayOf(new Date()))} 일정` })).toBeInTheDocument()
  })
})
})
