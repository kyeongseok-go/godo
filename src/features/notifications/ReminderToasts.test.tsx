import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { makeTask } from '../../test/factories'
import { useApp } from '../../store/app'
import { emptyEntityState } from '../../store/changes'
import { defaultSettings } from '../../store/defaults'
import { emptyState } from './reminderState'
import { useReminderStore } from './reminderStore'
import { ReminderToasts } from './ReminderToasts'
import type { DueReminder } from './schedule'

const task = makeTask({ id: 't1', title: '보고서 제출', startDate: '2026-10-24', startTime: '15:00' })
const card: DueReminder = {
  key: 't1|r1|2026-10-24',
  taskId: 't1',
  title: '보고서 제출',
  at: new Date(2026, 9, 24, 15, 0).getTime(),
  body: '15:00 시작',
}

function setup(tasks = [task]): void {
  localStorage.clear()
  useApp.setState({
    ready: true,
    entities: { ...emptyEntityState(), tasks: Object.fromEntries(tasks.map((t) => [t.id, t])) },
    settings: defaultSettings(),
  })
  useReminderStore.setState({ cards: [card], state: emptyState() })
  render(
    <MemoryRouter>
      <ReminderToasts />
    </MemoryRouter>,
  )
}

afterEach(() => {
  useReminderStore.setState({ cards: [], state: emptyState() })
  useApp.setState({ ready: false, entities: emptyEntityState(), settings: defaultSettings() })
})

describe('ReminderToasts', () => {
  test('shows the title, time and body of a due reminder', () => {
    setup()

    expect(screen.getByRole('heading', { name: '보고서 제출' })).toBeInTheDocument()
    expect(screen.getByText('15:00 시작')).toBeInTheDocument()
  })

  test('completes the task and removes the card', async () => {
    setup()

    await userEvent.click(screen.getByRole('button', { name: '완료' }))

    expect(useApp.getState().entities.tasks.t1.status).toBe('done')
    expect(useReminderStore.getState().cards).toEqual([])
  })

  test('snoozing keeps the task unchanged and stores the snooze time', async () => {
    setup()
    const before = Date.now()

    await userEvent.click(screen.getByRole('button', { name: '10분 뒤 다시 알림' }))

    const { snoozed } = useReminderStore.getState().state
    expect(snoozed['t1|r1|2026-10-24']).toBeGreaterThanOrEqual(before + 10 * 60_000)
    expect(useApp.getState().entities.tasks.t1).toBe(task)
    expect(useReminderStore.getState().cards).toEqual([])
  })

  test('offers the one-hour and next-morning snoozes too', () => {
    setup()

    expect(screen.getByRole('button', { name: '1시간 뒤 다시 알림' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '내일 아침 다시 알림' })).toBeInTheDocument()
  })

  test('closing a card removes only the card', async () => {
    setup()

    await userEvent.click(screen.getByRole('button', { name: '알림 닫기' }))

    expect(useReminderStore.getState().cards).toEqual([])
    expect(useApp.getState().entities.tasks.t1.status).toBe('todo')
  })

  test('drops the card when the task is completed elsewhere', () => {
    setup()

    act(() => {
      useApp.setState({ entities: { ...emptyEntityState(), tasks: { t1: { ...task, status: 'done' } } } })
    })

    expect(useReminderStore.getState().cards).toEqual([])
  })

  test('labels persistent reminders', () => {
    setup([{ ...task, persistentReminder: true }])

    expect(screen.getByText('계속 알림')).toBeInTheDocument()
  })

  test('folds cards beyond three into a summary with a close-all button', async () => {
    setup()
    const many = Array.from({ length: 6 }, (_, i) => ({ ...card, key: `t1|r${i}|2026-10-24` }))
    act(() => {
      useReminderStore.setState({ cards: many })
    })

    expect(screen.getAllByRole('article')).toHaveLength(3)
    expect(screen.getByText('이전 알림 3건')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '모두 닫기' }))
    expect(screen.queryAllByRole('article')).toHaveLength(0)
  })
})
