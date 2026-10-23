import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Habit } from '../../domain/types'
import { useApp } from '../../store/app'
import { renderApp, resetApp } from '../../test/render'
import { HabitsScreen } from './HabitsScreen'

// jsdom은 <dialog>의 showModal 을 구현하지 않는다.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open')
  }
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 23, 12, 0) }) // 금요일, 주 시작은 월요일
})

afterAll(() => {
  vi.useRealTimers()
})

beforeEach(async () => {
  await resetApp()
})

const makeHabit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1',
  name: '아침 스트레칭',
  icon: null,
  color: '#2f6f5e',
  frequency: { type: 'daily' },
  goal: { kind: 'check', target: 1, unit: null },
  startDate: '2026-10-01',
  group: null,
  reminderTime: null,
  block: null,
  archived: false,
  logs: {},
  order: 1000,
  ...over,
})

const seed = (...habits: Habit[]) =>
  act(() => useApp.getState().commit({ puts: { habits }, deletes: {} }, 'seed', { history: false }))

const habitOf = (id: string) => useApp.getState().entities.habits[id]
const render = () => renderApp(<HabitsScreen />, '/habits')

describe('HabitsScreen empty state', () => {
  test('creates a habit starting today when an example chip is pressed', async () => {
    const user = userEvent.setup()
    render()

    await user.click(screen.getByRole('button', { name: /물 마시기/ }))

    const [habit] = Object.values(useApp.getState().entities.habits)
    expect(habit).toMatchObject({ name: '물 마시기', startDate: '2026-10-23', goal: { kind: 'count', target: 8, unit: '잔' } })
  })
})

describe('week grid', () => {
  test('toggles a check habit on a past day and exposes it through aria-checked', async () => {
    const user = userEvent.setup()
    await seed(makeHabit())
    render()

    const cell = screen.getByRole('checkbox', { name: '아침 스트레칭 10월 22일' })
    expect(cell).toHaveAttribute('aria-checked', 'false')
    await user.click(cell)

    expect(habitOf('h1').logs['2026-10-22']).toBe(1)
    expect(screen.getByRole('checkbox', { name: '아침 스트레칭 10월 22일' })).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('checkbox', { name: '아침 스트레칭 10월 22일' }))
    expect(habitOf('h1').logs['2026-10-22']).toBeUndefined()
  })

  test('ignores clicks on future days', async () => {
    const user = userEvent.setup()
    await seed(makeHabit())
    render()

    const future = screen.getByRole('checkbox', { name: '아침 스트레칭 10월 24일' })
    await user.click(future)

    expect(future).toHaveAttribute('aria-disabled', 'true')
    expect(habitOf('h1').logs).toEqual({})
  })

  test('increments a count habit and shows its progress in the cell name', async () => {
    const user = userEvent.setup()
    await seed(makeHabit({ id: 'w', name: '물 마시기', goal: { kind: 'count', target: 8, unit: '잔' } }))
    render()

    await user.click(screen.getByRole('checkbox', { name: '물 마시기 10월 23일, 0/8잔' }))
    await user.click(screen.getByRole('checkbox', { name: '물 마시기 10월 23일, 1/8잔' }))

    expect(habitOf('w').logs['2026-10-23']).toBe(2)
    expect(screen.getByRole('checkbox', { name: '물 마시기 10월 23일, 2/8잔' })).toBeInTheDocument()
  })

  test('opens a value popover with the context menu and saves a typed value', async () => {
    const user = userEvent.setup()
    await seed(makeHabit({ id: 'w', name: '물 마시기', goal: { kind: 'count', target: 8, unit: '잔' } }))
    render()

    await user.pointer({ keys: '[MouseRight]', target: screen.getByRole('checkbox', { name: '물 마시기 10월 21일, 0/8잔' }) })
    const input = await screen.findByLabelText(/물 마시기 · 10월 21일/)
    await user.clear(input)
    await user.type(input, '6')
    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(habitOf('w').logs['2026-10-21']).toBe(6)
  })

  test('moves between weeks and back to the current week', async () => {
    const user = userEvent.setup()
    await seed(makeHabit())
    render()
    expect(screen.getByRole('heading', { name: '2026년 10월 19일 – 25일' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '이전 주' }))
    expect(screen.getByRole('heading', { name: '2026년 10월 12일 – 18일' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: '아침 스트레칭 10월 14일' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '이번 주로' }))
    expect(screen.getByRole('heading', { name: '2026년 10월 19일 – 25일' })).toBeInTheDocument()
  })
})

describe('groups and details', () => {
  test('groups habits under their group name and lists ungrouped ones last', async () => {
    await seed(
      makeHabit({ id: 'a', name: '운동하기', group: '아침', order: 1 }),
      makeHabit({ id: 'b', name: '일기', order: 2 }),
    )
    render()

    expect(screen.getByRole('heading', { name: /아침/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /그룹 없음/ })).toBeInTheDocument()
  })

  test('shows streaks, completion rate and the 12-week heatmap when a habit is selected', async () => {
    const user = userEvent.setup()
    await seed(makeHabit({ logs: { '2026-10-21': 1, '2026-10-22': 1 } }))
    render()

    await user.click(screen.getByRole('button', { name: '아침 스트레칭' }))

    const detail = await screen.findByRole('region', { name: '아침 스트레칭 자세히' })
    expect(within(detail).getByText('현재 연속')).toBeInTheDocument()
    expect(within(detail).getByRole('img', { name: /최근 12주 동안 2일 기록/ })).toBeInTheDocument()
  })
})

describe('creating, editing, archiving and deleting', () => {
  test('creates a weekday habit through the dialog', async () => {
    const user = userEvent.setup()
    render()
    await user.click(screen.getAllByRole('button', { name: /새 습관/ })[0])

    await user.type(await screen.findByLabelText('이름'), '요가')
    await user.click(screen.getByRole('radio', { name: '요일 선택' }))
    await user.click(screen.getByRole('button', { name: '토' }))
    await user.click(screen.getByRole('button', { name: '만들기' }))

    await waitFor(() => expect(Object.values(useApp.getState().entities.habits)).toHaveLength(1))
    const [habit] = Object.values(useApp.getState().entities.habits)
    expect(habit.name).toBe('요가')
    expect(habit.frequency).toEqual({ type: 'weekdays', days: [1, 2, 3, 4, 5, 6] })
  })

  test('shows a validation message instead of saving a nameless habit', async () => {
    const user = userEvent.setup()
    render()
    await user.click(screen.getAllByRole('button', { name: /새 습관/ })[0])

    await user.click(await screen.findByRole('button', { name: '만들기' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('이름을 입력해 주세요')
    expect(Object.keys(useApp.getState().entities.habits)).toHaveLength(0)
  })

  test('archives from the menu, then restores from the collapsed archive', async () => {
    const user = userEvent.setup()
    await seed(makeHabit())
    render()

    await user.click(screen.getByRole('button', { name: '아침 스트레칭 메뉴' }))
    await user.click(await screen.findByRole('menuitem', { name: '보관' }))
    expect(habitOf('h1').archived).toBe(true)

    await user.click(screen.getByText('보관한 습관'))
    await user.click(screen.getByRole('button', { name: /복원/ }))
    expect(habitOf('h1').archived).toBe(false)
  })

  test('asks for confirmation before deleting and then removes the habit', async () => {
    const user = userEvent.setup()
    await seed(makeHabit())
    render()

    await user.click(screen.getByRole('button', { name: '아침 스트레칭 메뉴' }))
    await user.click(await screen.findByRole('menuitem', { name: '편집' }))
    await user.click(await screen.findByRole('button', { name: '삭제' }))
    expect(habitOf('h1')).toBeDefined()
    await user.click(screen.getByRole('button', { name: '정말 삭제' }))

    expect(habitOf('h1')).toBeUndefined()
  })
})
