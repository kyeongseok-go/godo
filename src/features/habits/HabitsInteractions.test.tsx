import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Habit } from '../../domain/types'
import { useApp } from '../../store/app'
import { renderApp, resetApp } from '../../test/render'
import { HabitsScreen } from './HabitsScreen'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open')
  }
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 23, 12, 0) })
})

afterAll(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

beforeEach(async () => {
  await resetApp()
})

const makeHabit = (over: Partial<Habit> = {}): Habit => ({
  id: 'w',
  name: '물 마시기',
  icon: null,
  color: '#2b4c7e',
  frequency: { type: 'daily' },
  goal: { kind: 'count', target: 8, unit: '잔' },
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

describe('value popover', () => {
  test('opens on a long press and clears the day with 지우기', async () => {
    const user = userEvent.setup()
    await seed(makeHabit({ logs: { '2026-10-21': 5 } }))
    render()
    const cell = screen.getByRole('checkbox', { name: '물 마시기 10월 21일, 5/8잔' })

    fireEvent.pointerDown(cell, { button: 0 })
    await screen.findByLabelText(/물 마시기 · 10월 21일/, undefined, { timeout: 1500 })
    fireEvent.pointerUp(cell)
    await user.click(screen.getByRole('button', { name: '지우기' }))

    expect(habitOf('w').logs['2026-10-21']).toBeUndefined()
  })

  test('a short press does not open it and a long press does not also toggle', async () => {
    await seed(makeHabit())
    render()
    const cell = screen.getByRole('checkbox', { name: '물 마시기 10월 21일, 0/8잔' })

    fireEvent.pointerDown(cell, { button: 0 })
    fireEvent.pointerUp(cell)
    expect(screen.queryByLabelText(/물 마시기 · 10월 21일/)).not.toBeInTheDocument()

    fireEvent.pointerDown(cell, { button: 0 })
    await screen.findByLabelText(/물 마시기 · 10월 21일/, undefined, { timeout: 1500 })
    fireEvent.pointerUp(cell)
    fireEvent.click(cell)
    expect(habitOf('w').logs).toEqual({})
  })

  test('opens from the row menu for today', async () => {
    const user = userEvent.setup()
    await seed(makeHabit())
    render()

    await user.click(screen.getByRole('button', { name: '물 마시기 메뉴' }))
    await user.click(await screen.findByRole('menuitem', { name: '오늘 값 입력' }))
    const input = await screen.findByLabelText(/물 마시기 · 10월 23일/)
    await user.clear(input)
    await user.type(input, '4.5')
    await user.keyboard('{Enter}')

    expect(habitOf('w').logs['2026-10-23']).toBe(4.5)
  })
})

describe('keyboard', () => {
  test('arrow keys move focus between the seven cells of a row', async () => {
    const user = userEvent.setup()
    await seed(makeHabit())
    render()
    const monday = screen.getByRole('checkbox', { name: '물 마시기 10월 19일, 0/8잔' })

    monday.focus()
    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('checkbox', { name: '물 마시기 10월 20일, 0/8잔' })).toHaveFocus()
    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(monday).toHaveFocus()
  })

  test('Space toggles a focused check cell', async () => {
    const user = userEvent.setup()
    await seed(makeHabit({ id: 'c', name: '스트레칭', goal: { kind: 'check', target: 1, unit: null } }))
    render()

    screen.getByRole('checkbox', { name: '스트레칭 10월 22일' }).focus()
    await user.keyboard(' ')

    expect(habitOf('c').logs['2026-10-22']).toBe(1)
  })
})

describe('detail panel', () => {
  test('steps and types the value of today for a count habit', async () => {
    const user = userEvent.setup()
    await seed(makeHabit())
    render()
    await user.click(screen.getByRole('button', { name: '물 마시기' }))
    const detail = await screen.findByRole('region', { name: '물 마시기 자세히' })

    await user.click(within(detail).getByRole('button', { name: '1 늘리기' }))
    await user.click(within(detail).getByRole('button', { name: '1 늘리기' }))
    expect(habitOf('w').logs['2026-10-23']).toBe(2)
    await user.click(within(detail).getByRole('button', { name: '1 줄이기' }))
    expect(habitOf('w').logs['2026-10-23']).toBe(1)

    const input = within(detail).getByLabelText('오늘 물 마시기 값')
    await user.clear(input)
    await user.type(input, '7')
    await user.keyboard('{Enter}')
    await waitFor(() => expect(habitOf('w').logs['2026-10-23']).toBe(7))
  })

  test('restores the typed value when the input is invalid', async () => {
    const user = userEvent.setup()
    await seed(makeHabit({ logs: { '2026-10-23': 3 } }))
    render()
    await user.click(screen.getByRole('button', { name: '물 마시기' }))
    const detail = await screen.findByRole('region', { name: '물 마시기 자세히' })

    const input = within(detail).getByLabelText('오늘 물 마시기 값')
    await user.clear(input)
    await user.tab()

    expect(habitOf('w').logs['2026-10-23']).toBe(3)
    expect(within(detail).getByLabelText('오늘 물 마시기 값')).toHaveValue(3)
  })

  test('records today for a check habit with the toggle button', async () => {
    const user = userEvent.setup()
    await seed(makeHabit({ id: 'c', name: '스트레칭', goal: { kind: 'check', target: 1, unit: null } }))
    render()
    await user.click(screen.getByRole('button', { name: '스트레칭' }))

    await user.click(await screen.findByRole('button', { name: '오늘 완료로 기록' }))
    expect(habitOf('c').logs['2026-10-23']).toBe(1)
    await user.click(screen.getByRole('button', { name: '오늘 완료 취소' }))

    expect(habitOf('c').logs['2026-10-23']).toBeUndefined()
  })

  test('archives from the detail panel and closes it', async () => {
    const user = userEvent.setup()
    await seed(makeHabit())
    render()
    await user.click(screen.getByRole('button', { name: '물 마시기' }))

    const detail = await screen.findByRole('region', { name: '물 마시기 자세히' })
    await user.click(within(detail).getByRole('button', { name: /보관/ }))

    expect(habitOf('w').archived).toBe(true)
    expect(screen.queryByRole('region', { name: '물 마시기 자세히' })).not.toBeInTheDocument()
  })

  test('closes with the close button', async () => {
    const user = userEvent.setup()
    await seed(makeHabit())
    render()
    await user.click(screen.getByRole('button', { name: '물 마시기' }))

    await user.click(await screen.findByRole('button', { name: '자세히 닫기' }))

    expect(screen.queryByRole('region', { name: '물 마시기 자세히' })).not.toBeInTheDocument()
  })
})

describe('narrow layout', () => {
  test('expands the detail inside the selected row when the container is narrow', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        callback: ResizeObserverCallback
        constructor(callback: ResizeObserverCallback) {
          this.callback = callback
        }
        observe() {
          this.callback([{ contentRect: { width: 500 } } as ResizeObserverEntry], this as unknown as ResizeObserver)
        }
        disconnect() {}
        unobserve() {}
      },
    )
    await seed(makeHabit())
    render()

    await user.click(screen.getByRole('button', { name: '물 마시기' }))

    const row = screen.getByRole('button', { name: '물 마시기' }).closest('li') as HTMLElement
    expect(within(row).getByRole('region', { name: '물 마시기 자세히' })).toBeInTheDocument()
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    vi.unstubAllGlobals()
  })
})

describe('dialog', () => {
  test('creates a count habit with a weekly frequency, unit and group', async () => {
    const user = userEvent.setup()
    render()
    await user.click(screen.getAllByRole('button', { name: /새 습관/ })[0])

    await user.type(await screen.findByLabelText('이름'), '러닝')
    await user.click(screen.getByRole('radio', { name: '주 N회' }))
    const times = screen.getByLabelText('주당 횟수')
    await user.clear(times)
    await user.type(times, '4')
    await user.click(screen.getByRole('radio', { name: '횟수' }))
    const target = screen.getByLabelText('목표 횟수')
    await user.clear(target)
    await user.type(target, '5')
    await user.type(screen.getByLabelText('단위'), 'km')
    await user.type(screen.getByLabelText('그룹'), '운동')
    await user.click(screen.getByRole('button', { name: '만들기' }))

    await waitFor(() => expect(Object.keys(useApp.getState().entities.habits)).toHaveLength(1))
    expect(Object.values(useApp.getState().entities.habits)[0]).toMatchObject({
      name: '러닝',
      frequency: { type: 'timesPerWeek', times: 4 },
      goal: { kind: 'count', target: 5, unit: 'km' },
      group: '운동',
    })
  })

  test('edits an existing habit, keeping its logs', async () => {
    const user = userEvent.setup()
    await seed(makeHabit({ logs: { '2026-10-21': 3 } }))
    render()

    await user.click(screen.getByRole('button', { name: '물 마시기 메뉴' }))
    await user.click(await screen.findByRole('menuitem', { name: '편집' }))
    const name = await screen.findByLabelText('이름')
    await user.clear(name)
    await user.type(name, '물 2리터')
    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(habitOf('w').name).toBe('물 2리터'))
    expect(habitOf('w').logs).toEqual({ '2026-10-21': 3 })
  })

  test('cancelling the delete confirmation keeps the habit', async () => {
    const user = userEvent.setup()
    await seed(makeHabit())
    render()
    await user.click(screen.getByRole('button', { name: '물 마시기 메뉴' }))
    await user.click(await screen.findByRole('menuitem', { name: '편집' }))

    await user.click(await screen.findByRole('button', { name: '삭제' }))
    await user.click(screen.getByRole('button', { name: '취소' }))

    expect(habitOf('w')).toBeDefined()
    expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument()
  })

  test('opens an archived habit for editing from the collapsed archive', async () => {
    const user = userEvent.setup()
    await seed(makeHabit({ archived: true }))
    render()

    await user.click(screen.getByText('보관한 습관'))
    await user.click(screen.getByRole('button', { name: '물 마시기' }))

    const dialog = await screen.findByRole('dialog', { name: '습관 편집' })
    expect(within(dialog).getByRole('button', { name: '복원' })).toBeInTheDocument()
  })
})

describe('습관 블록(F12)', () => {
  test('시간 비워 두기를 켜고 시간대와 길이를 정해 저장한다', async () => {
    const user = userEvent.setup()
    render()
    await user.click(screen.getAllByRole('button', { name: /새 습관/ })[0])

    await user.type(await screen.findByLabelText('이름'), '운동')
    await user.click(screen.getByRole('checkbox', { name: /빈 자리에 매일 다시 잡기/ }))
    fireEvent.change(screen.getByLabelText('블록 시작 시각'), { target: { value: '06:30' } })
    fireEvent.change(screen.getByLabelText('블록 종료 시각'), { target: { value: '08:30' } })
    const length = screen.getByLabelText('블록 길이(분)')
    await user.clear(length)
    await user.type(length, '45')
    await user.click(screen.getByRole('button', { name: '만들기' }))

    await waitFor(() => expect(Object.keys(useApp.getState().entities.habits)).toHaveLength(1))
    expect(Object.values(useApp.getState().entities.habits)[0].block).toEqual({
      durationMin: 45,
      start: '06:30',
      end: '08:30',
    })
  })

  test('블록 길이가 시간대보다 길면 이유를 보여 주고 저장하지 않는다', async () => {
    const user = userEvent.setup()
    render()
    await user.click(screen.getAllByRole('button', { name: /새 습관/ })[0])

    await user.type(await screen.findByLabelText('이름'), '운동')
    await user.click(screen.getByRole('checkbox', { name: /빈 자리에 매일 다시 잡기/ }))
    fireEvent.change(screen.getByLabelText('블록 종료 시각'), { target: { value: '07:20' } })
    const length = screen.getByLabelText('블록 길이(분)')
    await user.clear(length)
    await user.type(length, '60')
    await user.click(screen.getByRole('button', { name: '만들기' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('블록 길이가 시간대보다 길어요')
    expect(Object.keys(useApp.getState().entities.habits)).toHaveLength(0)
  })
})
