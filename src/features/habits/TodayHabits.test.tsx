import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Habit } from '../../domain/types'
import { useApp } from '../../store/app'
import { renderApp, resetApp } from '../../test/render'
import { TodayHabits } from './TodayHabits'

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 23, 12, 0) }) // 금요일
})

afterAll(() => {
  vi.useRealTimers()
})

beforeEach(async () => {
  await resetApp()
})

const makeHabit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1',
  name: '스트레칭',
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

describe('TodayHabits', () => {
  test('renders nothing when there are no habits', () => {
    const { container } = renderApp(<TodayHabits />)

    expect(container).toBeEmptyDOMElement()
  })

  test('renders nothing when no habit is due today', async () => {
    await seed(
      makeHabit({ id: 'mon', frequency: { type: 'weekdays', days: [1] } }),
      makeHabit({ id: 'old', archived: true }),
      makeHabit({ id: 'later', startDate: '2026-11-01' }),
    )
    const { container } = renderApp(<TodayHabits />)

    expect(container).toBeEmptyDOMElement()
  })

  test('shows only habits due today and checks one with a single press', async () => {
    const user = userEvent.setup()
    await seed(makeHabit(), makeHabit({ id: 'mon', name: '월요일 습관', frequency: { type: 'weekdays', days: [1] } }))
    renderApp(<TodayHabits />)

    expect(screen.queryByText('월요일 습관')).not.toBeInTheDocument()
    const chip = screen.getByRole('checkbox', { name: '스트레칭' })
    expect(chip).toHaveAttribute('aria-checked', 'false')
    await user.click(chip)

    expect(useApp.getState().entities.habits.h1.logs['2026-10-23']).toBe(1)
    expect(screen.getByRole('checkbox', { name: '스트레칭' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByLabelText('1개 중 1개 완료')).toBeInTheDocument()
  })

  test('steps a count habit up and down with the plus and minus buttons', async () => {
    const user = userEvent.setup()
    await seed(makeHabit({ id: 'w', name: '물', goal: { kind: 'count', target: 8, unit: '잔' } }))
    renderApp(<TodayHabits />)

    expect(screen.getByRole('button', { name: '물 1 줄이기' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '물 1 늘리기' }))
    await user.click(screen.getByRole('button', { name: '물 1 늘리기' }))
    expect(useApp.getState().entities.habits.w.logs['2026-10-23']).toBe(2)
    expect(screen.getByLabelText('물 오늘 2, 목표 8잔')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '물 1 줄이기' }))
    expect(useApp.getState().entities.habits.w.logs['2026-10-23']).toBe(1)
  })

  test('links to the full habits page', async () => {
    await seed(makeHabit())
    renderApp(<TodayHabits />)

    expect(screen.getByRole('link', { name: '습관 전체 보기' })).toHaveAttribute('href', '/habits')
  })
})

describe('TodayHabits 습관 블록(F12)', () => {
  test('블록이 있는 습관에 비워 둔 시각을 보여 준다', () => {
    seed(makeHabit({ block: { durationMin: 30, start: '13:00', end: '18:00' } }))

    renderApp(<TodayHabits />)

    // 테스트 시각은 12:00, 13:00 시간대의 첫 자리를 제안한다
    expect(screen.getByText(/비워 둔 시간/)).toBeInTheDocument()
    expect(screen.getByText('13:00')).toBeInTheDocument()
  })

  test('블록이 없으면 그 줄을 그리지 않는다', () => {
    seed(makeHabit())

    renderApp(<TodayHabits />)

    expect(screen.queryByText(/비워 둔 시간/)).not.toBeInTheDocument()
  })

  test('이미 달성한 습관은 시간을 비우지 않는다', () => {
    seed(makeHabit({ logs: { '2026-10-23': 1 }, block: { durationMin: 30, start: '13:00', end: '18:00' } }))

    renderApp(<TodayHabits />)

    expect(screen.queryByText(/비워 둔 시간/)).not.toBeInTheDocument()
  })
})
