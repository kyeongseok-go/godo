import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Countdown } from '../../domain/types'
import { useApp } from '../../store/app'
import { installModalDialogFocusShim } from '../../test/focusShim'
import { renderApp, resetApp } from '../../test/render'
import { CountdownScreen } from './CountdownScreen'

// jsdom은 <dialog>의 showModal을 구현하지 않는다. 브라우저의 포커스 규칙까지 흉내 내는 셔임을 쓴다.
installModalDialogFocusShim()

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 23, 12, 0) })
})

afterAll(() => {
  vi.useRealTimers()
})

beforeEach(async () => {
  await resetApp()
})

const make = (over: Partial<Countdown> = {}): Countdown => ({
  id: 'c1',
  name: '생일',
  date: '2026-12-25',
  color: '#d9421c',
  repeatYearly: false,
  order: 1000,
  ...over,
})

const seed = (...countdowns: Countdown[]) =>
  act(() => useApp.getState().commit({ puts: { countdowns }, deletes: {} }, 'seed', { history: false }))

const stored = () => Object.values(useApp.getState().entities.countdowns)

describe('CountdownScreen', () => {
  test('the dialog starts with the keyboard in the name field instead of the close button', async () => {
    const user = userEvent.setup()
    renderApp(<CountdownScreen />, '/countdown')

    await user.click(screen.getByRole('button', { name: /생일/ }))

    expect(await screen.findByLabelText('이름')).toHaveFocus()
  })

  test('offers birthday, anniversary and exam examples when empty and opens a prefilled dialog', async () => {
    const user = userEvent.setup()
    renderApp(<CountdownScreen />, '/countdown')

    await user.click(screen.getByRole('button', { name: /생일/ }))

    expect(await screen.findByLabelText('이름')).toHaveValue('생일')
    expect(screen.getByRole('checkbox', { name: /매년 반복/ })).toBeChecked()
  })

  test('lists countdowns nearest first with big labels and moves past ones into a folded section', async () => {
    await seed(
      make({ id: 'far', name: '먼 날', date: '2027-01-01' }),
      make({ id: 'today', name: '오늘 일', date: '2026-10-23' }),
      make({ id: 'near', name: '가까운 날', date: '2026-10-30' }),
      make({ id: 'gone', name: '지난 일', date: '2026-10-20' }),
    )
    renderApp(<CountdownScreen />, '/countdown')

    const upcoming = screen.getByRole('list', { name: '다가오는 디데이' })
    const names = within(upcoming).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(names).toEqual(['오늘 일', '가까운 날', '먼 날'])
    expect(within(upcoming).getByText('D-DAY')).toBeInTheDocument()
    expect(within(upcoming).getByText('D-7')).toBeInTheDocument()
    expect(screen.getByText('D+3')).toBeInTheDocument()
    expect(screen.getByText('지난 디데이')).toBeInTheDocument()
  })

  test('creates a countdown from the dialog and shows the live preview', async () => {
    const user = userEvent.setup()
    renderApp(<CountdownScreen />, '/countdown')
    await user.click(screen.getAllByRole('button', { name: /새 디데이/ })[0])

    await user.type(await screen.findByLabelText('이름'), '시험')
    const date = screen.getByLabelText('날짜')
    await user.clear(date)
    await user.type(date, '2026-11-02')
    expect(screen.getByText('D-10')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '만들기' }))

    await waitFor(() => expect(stored()).toHaveLength(1))
    expect(stored()[0]).toMatchObject({ name: '시험', date: '2026-11-02', repeatYearly: false })
  })

  test('edits an existing countdown', async () => {
    const user = userEvent.setup()
    await seed(make())
    renderApp(<CountdownScreen />, '/countdown')

    await user.click(screen.getByRole('button', { name: '생일 편집' }))
    const name = await screen.findByLabelText('이름')
    await user.clear(name)
    await user.type(name, '엄마 생일')
    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(stored()[0].name).toBe('엄마 생일'))
  })

  test('asks for confirmation before deleting', async () => {
    const user = userEvent.setup()
    await seed(make())
    renderApp(<CountdownScreen />, '/countdown')

    await user.click(screen.getByRole('button', { name: '생일 편집' }))
    await user.click(await screen.findByRole('button', { name: '삭제' }))
    expect(stored()).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: '정말 삭제' }))

    expect(stored()).toHaveLength(0)
  })

  test('shows a validation message for a nameless countdown', async () => {
    const user = userEvent.setup()
    renderApp(<CountdownScreen />, '/countdown')
    await user.click(screen.getAllByRole('button', { name: /새 디데이/ })[0])

    await user.click(await screen.findByRole('button', { name: '만들기' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('이름을 입력해 주세요')
    expect(stored()).toHaveLength(0)
  })
})
