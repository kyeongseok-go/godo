import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useApp } from '../../store/app'
import { makeTask } from '../../test/factories'
import { installHiddenPanelFocusShim } from '../../test/focusShim'
import { renderApp, resetApp } from '../../test/render'
import { DetailPanel } from './DetailPanel'

installHiddenPanelFocusShim()

// 상세 패널의 알림과 시작 조건(의존 관계·보류) 블록

beforeEach(async () => {
  await resetApp()
})

const stored = (id = 'a') => useApp.getState().entities.tasks[id]

function openPanel(task: Parameters<typeof makeTask>[0] = {}, ...others: ReturnType<typeof makeTask>[]) {
  useApp.getState().commit(
    { puts: { tasks: [makeTask({ id: 'a', title: '발표 준비', ...task }), ...others] }, deletes: {} },
    'seed',
    { history: false },
  )
  return renderApp(<DetailPanel />, '/inbox?task=a')
}

const reminders = () => screen.getByRole('region', { name: '알림' })
const dependencies = () => screen.getByRole('region', { name: '의존 관계' })

describe('reminders', () => {
  test('cannot add a reminder before the task has a date', () => {
    openPanel()

    const add = within(reminders()).getByRole('button', { name: '+ 알림 추가' })
    expect(add).toBeDisabled()
    expect(add).toHaveAttribute('title', '날짜를 먼저 정해 주세요')
  })

  test('adds a relative reminder from the menu and lists it as a chip', async () => {
    const user = userEvent.setup()
    openPanel({ startDate: '2026-10-25', startTime: '14:00' })

    await user.click(within(reminders()).getByRole('button', { name: '+ 알림 추가' }))
    await user.click(await screen.findByRole('menuitem', { name: '15분 전' }))

    expect(stored().reminders).toMatchObject([{ kind: 'relative', offsetMin: 15 }])
    expect(within(reminders()).getByText('15분 전')).toBeInTheDocument()
  })

  test('does not offer a time that is already set', async () => {
    const user = userEvent.setup()
    openPanel({ startDate: '2026-10-25', reminders: [{ id: 'r1', kind: 'relative', offsetMin: 5 }] })

    await user.click(within(reminders()).getByRole('button', { name: '+ 알림 추가' }))

    await screen.findByRole('menu')
    expect(screen.queryByRole('menuitem', { name: '5분 전' })).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: '정각에' })).toBeInTheDocument()
  })

  test('removes a reminder with its delete button', async () => {
    const user = userEvent.setup()
    openPanel({
      startDate: '2026-10-25',
      reminders: [
        { id: 'r1', kind: 'relative', offsetMin: 60 },
        { id: 'r2', kind: 'relative', offsetMin: 1440 },
      ],
    })

    await user.click(screen.getByRole('button', { name: '1시간 전 알림 삭제' }))

    expect(stored().reminders.map((r) => r.id)).toEqual(['r2'])
    expect(within(reminders()).queryByText('1시간 전')).not.toBeInTheDocument()
    expect(within(reminders()).getByText('하루 전')).toBeInTheDocument()
  })

  test('labels an unusual offset in minutes and a fixed-time reminder by its date', () => {
    openPanel({
      startDate: '2026-10-25',
      reminders: [
        { id: 'r1', kind: 'relative', offsetMin: 7 },
        { id: 'r2', kind: 'absolute', at: new Date('2026-10-24T08:30:00').getTime() },
      ],
    })

    expect(within(reminders()).getByText('7분 전')).toBeInTheDocument()
    expect(within(reminders()).getByText(/10\. 24\.|10월 24일/)).toBeInTheDocument()
  })

  test('the keep-reminding switch only appears once there is a reminder', async () => {
    const user = userEvent.setup()
    openPanel({ startDate: '2026-10-25', reminders: [{ id: 'r1', kind: 'relative', offsetMin: 0 }] })

    const toggle = within(reminders()).getByRole('checkbox', { name: '확인할 때까지 계속 알리기' })
    expect(toggle).not.toBeChecked()
    await user.click(toggle)

    expect(stored().persistentReminder).toBe(true)
    expect(toggle).toBeChecked()
  })

  test('no switch is shown while there are no reminders', () => {
    openPanel({ startDate: '2026-10-25' })
    expect(screen.queryByRole('checkbox', { name: '확인할 때까지 계속 알리기' })).not.toBeInTheDocument()
  })
})

describe('start conditions', () => {
  const others = () => [
    makeTask({ id: 'b', title: '자료 조사' }),
    makeTask({ id: 'c', title: '슬라이드 작성' }),
    makeTask({ id: 'd', title: '끝낸 일', status: 'done' }),
    makeTask({ id: 'e', title: '버린 일', deletedAt: 1 }),
    makeTask({ id: 'f', title: '나를 기다리는 일', blockedBy: ['a'] }),
  ]

  test('lists only tasks that can still block this one', async () => {
    const user = userEvent.setup()
    openPanel({}, ...others())

    await user.click(within(dependencies()).getByRole('button', { name: '+ 먼저 끝나야 할 일' }))

    const pop = await screen.findByRole('dialog', { name: '먼저 끝나야 할 일 선택' })
    const titles = within(pop).getAllByRole('button').map((b) => b.textContent)
    expect(titles).toEqual(['자료 조사', '슬라이드 작성'])
  })

  test('picking a task adds it as a blocker and closes the picker', async () => {
    const user = userEvent.setup()
    openPanel({}, ...others())

    await user.click(within(dependencies()).getByRole('button', { name: '+ 먼저 끝나야 할 일' }))
    await user.click(await screen.findByRole('button', { name: '자료 조사' }))

    expect(stored().blockedBy).toEqual(['b'])
    expect(screen.queryByRole('dialog', { name: '먼저 끝나야 할 일 선택' })).not.toBeInTheDocument()
    expect(within(dependencies()).getByText('자료 조사')).toBeInTheDocument()
  })

  test('the search box takes focus as soon as the picker is up', async () => {
    const user = userEvent.setup()
    openPanel({}, ...others())

    await user.click(within(dependencies()).getByRole('button', { name: '+ 먼저 끝나야 할 일' }))

    expect(await screen.findByPlaceholderText('할 일 검색')).toHaveFocus()
  })

  test('typing narrows the candidates and says so when nothing matches', async () => {
    const user = userEvent.setup()
    openPanel({}, ...others())
    await user.click(within(dependencies()).getByRole('button', { name: '+ 먼저 끝나야 할 일' }))
    const search = await screen.findByPlaceholderText('할 일 검색')

    await user.type(search, '슬라')
    const pop = screen.getByRole('dialog', { name: '먼저 끝나야 할 일 선택' })
    expect(within(pop).getAllByRole('button').map((b) => b.textContent)).toEqual(['슬라이드 작성'])

    await user.type(search, '없는말')
    expect(within(pop).getByText('찾는 할 일이 없어요')).toBeInTheDocument()
  })

  test('releases a blocker with its x button', async () => {
    const user = userEvent.setup()
    openPanel({ blockedBy: ['b'] }, ...others())
    expect(within(dependencies()).getByText('자료 조사')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '"자료 조사" 조건 해제' }))

    expect(stored().blockedBy).toEqual([])
    expect(within(dependencies()).queryByText('자료 조사')).not.toBeInTheDocument()
  })

  test('the hold switch pauses and resumes the task', async () => {
    const user = userEvent.setup()
    openPanel()
    const hold = within(dependencies()).getByRole('checkbox', { name: /보류/ })

    await user.click(hold)
    await waitFor(() => expect(stored().onHold).toBe(true))

    await user.click(hold)
    await waitFor(() => expect(stored().onHold).toBe(false))
  })
})
