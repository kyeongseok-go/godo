import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { addDays, todayOf } from '../../domain/date'
import type { Task } from '../../domain/types'
import { useApp } from '../../store/app'
import { useToasts } from '../../ui/toast'
import { applyChangeSet, emptyEntityState } from '../../store/changes'
import { defaultSettings } from '../../store/defaults'
import { makeTask } from '../../test/factories'
import { ReplanSession } from './ReplanSession'

const today = (): string => todayOf(new Date(), useApp.getState().settings.dayStartHour)

function seed(tasks: Task[]): void {
  const entities = applyChangeSet(emptyEntityState(), { puts: { tasks }, deletes: {} }).next
  useApp.setState({ ready: true, entities, settings: defaultSettings(), undoStack: [], redoStack: [] })
}

const overdue = (id: string, title: string, daysAgo: number, extra: Partial<Task> = {}): Task =>
  makeTask({ id, title, startDate: addDays(today(), -daysAgo), ...extra })

const renderSession = () =>
  render(
    <MemoryRouter>
      <ReplanSession />
    </MemoryRouter>,
  )

const taskOf = (id: string): Task => useApp.getState().entities.tasks[id]

describe('ReplanSession', () => {
  beforeEach(() => {
    seed([])
  })

  it('shows one card at a time with a position counter', () => {
    seed([overdue('a', '보고서', 5), overdue('b', '청소', 2)])
    renderSession()
    expect(screen.getByRole('heading', { name: '보고서' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: '정리 진행' })).toHaveAttribute('aria-valuenow', '1')
    expect(screen.getByText('/ 2')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '청소' })).not.toBeInTheDocument()
  })

  it('reschedules to today with the T key, advances, and keeps the change undoable', async () => {
    seed([overdue('a', '보고서', 5), overdue('b', '청소', 2)])
    const user = userEvent.setup()
    renderSession()
    await user.keyboard('t')
    expect(taskOf('a').startDate).toBe(today())
    expect(taskOf('a').postponeCount).toBe(1)
    expect(screen.getByRole('heading', { name: '청소' })).toBeInTheDocument()
    expect(useApp.getState().undoStack.at(-1)?.label).toBe('미완료 정리: 다시 잡기')
  })

  it('maps E, X and S to complete, delete and someday', async () => {
    seed([overdue('a', 'A', 5), overdue('b', 'B', 4), overdue('c', 'C', 3)])
    const user = userEvent.setup()
    renderSession()
    await user.keyboard('e')
    await user.keyboard('x')
    await user.keyboard('s')
    expect(taskOf('a').status).toBe('done')
    expect(taskOf('b').deletedAt).not.toBeNull()
    expect(taskOf('c').someday).toBe(true)
  })

  it('sends to the inbox with the I key', async () => {
    seed([overdue('a', 'A', 5, { projectId: 'work' })])
    const user = userEvent.setup()
    renderSession()
    await user.keyboard('i')
    expect(taskOf('a')).toMatchObject({ projectId: 'inbox', startDate: null })
  })

  it('goes back one card and restores the task with Backspace', async () => {
    seed([overdue('a', 'A', 5), overdue('b', 'B', 4)])
    const user = userEvent.setup()
    renderSession()
    await user.keyboard('x')
    expect(taskOf('a').deletedAt).not.toBeNull()
    await user.keyboard('{Backspace}')
    expect(taskOf('a').deletedAt).toBeNull()
    expect(screen.getByRole('heading', { name: 'A' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')
  })

  it('also undoes with the Z key', async () => {
    seed([overdue('a', 'A', 5), overdue('b', 'B', 4)])
    const user = userEvent.setup()
    renderSession()
    await user.keyboard('e')
    await user.keyboard('z')
    expect(taskOf('a').status).toBe('todo')
  })

  it('opens an inline date picker with D and picks a day', async () => {
    seed([overdue('a', 'A', 5)])
    const user = userEvent.setup()
    renderSession()
    await user.keyboard('d')
    expect(screen.getByRole('region', { name: '다시 잡을 날짜 고르기' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '내일' }))
    expect(taskOf('a').startDate).toBe(addDays(today(), 1))
  })

  it('closes the date picker with Escape without deciding', async () => {
    seed([overdue('a', 'A', 5)])
    const user = userEvent.setup()
    renderSession()
    await user.keyboard('d')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('region', { name: '다시 잡을 날짜 고르기' })).not.toBeInTheDocument()
    expect(taskOf('a').startDate).toBe(addDays(today(), -5))
  })

  it('warns and highlights the archive button when a task has been stuck for days', () => {
    seed([overdue('a', 'A', 30)])
    renderSession()
    expect(screen.getByRole('note')).toHaveTextContent('30일째 못 하고 있어요. 보관할까요?')
    expect(screen.getByRole('button', { name: /언젠가로 보관/ })).toBeInTheDocument()
  })

  it('shows no warning band for a fresh leftover', () => {
    seed([overdue('a', 'A', 1)])
    renderSession()
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('ends with a summary sentence and a link to the plan page', async () => {
    seed([overdue('a', 'A', 5), overdue('b', 'B', 4), overdue('c', 'C', 3)])
    const user = userEvent.setup()
    renderSession()
    await user.keyboard('t')
    await user.keyboard('s')
    await user.keyboard('x')
    expect(screen.getByRole('heading', { name: '3개 중 오늘로 1, 언젠가 1, 삭제 1' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /오늘 계획하기/ })).toHaveAttribute('href', '/plan')
  })

  it('undoes from the summary screen and returns to the last card', async () => {
    seed([overdue('a', 'A', 5)])
    const user = userEvent.setup()
    renderSession()
    await user.keyboard('x')
    await user.click(screen.getByRole('button', { name: /마지막 결정 되돌리기/ }))
    expect(screen.getByRole('heading', { name: 'A' })).toBeInTheDocument()
    expect(taskOf('a').deletedAt).toBeNull()
  })

  it('shows a calm empty state when nothing is left over', () => {
    renderSession()
    expect(screen.getByRole('heading', { name: '밀린 일이 없어요. 가볍게 시작해요.' })).toBeInTheDocument()
  })

  it('skips a subtask card that its parent decision already finished', async () => {
    seed([overdue('p', '부모', 5), overdue('c', '자식', 4, { parentId: 'p' }), overdue('z', '다른 일', 3)])
    const user = userEvent.setup()
    renderSession()
    await user.keyboard('e')
    expect(await screen.findByRole('heading', { name: '다른 일' })).toBeInTheDocument()
    expect(taskOf('c').status).toBe('done')
  })

  it('restores the skipped subtask when the parent decision is undone', async () => {
    seed([overdue('p', '부모', 5), overdue('c', '자식', 4, { parentId: 'p' }), overdue('z', '다른 일', 3)])
    const user = userEvent.setup()
    renderSession()
    await user.keyboard('e')
    await screen.findByRole('heading', { name: '다른 일' })
    await user.keyboard('{Backspace}')
    expect(await screen.findByRole('heading', { name: '부모' })).toBeInTheDocument()
    expect(taskOf('c').status).toBe('todo')
  })

  it('leaves letter keys alone while typing in an input', async () => {
    seed([overdue('a', 'A', 5)])
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <input aria-label="메모" />
        <ReplanSession />
      </MemoryRouter>,
    )
    await act(async () => {
      screen.getByLabelText('메모').focus()
    })
    await user.keyboard('x')
    expect(taskOf('a').deletedAt).toBeNull()
  })

  it('works with the buttons as well as the keys', async () => {
    seed([overdue('a', 'A', 6), overdue('b', 'B', 5), overdue('c', 'C', 4), overdue('d', 'D', 3, { projectId: 'work' }), overdue('e', 'E', 2)])
    const user = userEvent.setup()
    renderSession()
    await user.click(screen.getByRole('button', { name: '오늘로 다시 잡기' }))
    await user.click(screen.getByRole('button', { name: '완료' }))
    await user.click(screen.getByRole('button', { name: '삭제' }))
    await user.click(screen.getByRole('button', { name: '받은편지함으로' }))
    await user.click(screen.getByRole('button', { name: '언젠가로' }))
    expect(taskOf('a').startDate).toBe(today())
    expect(taskOf('b').status).toBe('done')
    expect(taskOf('c').deletedAt).not.toBeNull()
    expect(taskOf('d').projectId).toBe('inbox')
    expect(taskOf('e').someday).toBe(true)
    expect(screen.getByRole('heading', { name: /5개 중 오늘로 1, 받은편지함 1, 완료 1, 언젠가 1, 삭제 1/ })).toBeInTheDocument()
  })

  it('refuses a past date in the picker with a gentle message', async () => {
    seed([overdue('a', 'A', 5)])
    const user = userEvent.setup()
    renderSession()
    await user.keyboard('d')
    await user.click(screen.getAllByRole('gridcell', { name: addDays(today(), -1) })[0])
    expect(taskOf('a').startDate).toBe(addDays(today(), -5))
    expect(useToasts.getState().toasts.at(-1)?.message).toBe('오늘 이후 날짜를 골라 주세요.')
  })

  it('goes back from the date picker with the back button', async () => {
    seed([overdue('a', 'A', 5)])
    const user = userEvent.setup()
    renderSession()
    await user.click(screen.getByRole('button', { name: '다른 날로' }))
    await user.click(screen.getByRole('button', { name: /돌아가기/ }))
    expect(screen.getByRole('heading', { name: 'A' })).toBeInTheDocument()
  })

  it('uses the undo button on the card', async () => {
    seed([overdue('a', 'A', 5), overdue('b', 'B', 4)])
    const user = userEvent.setup()
    renderSession()
    expect(screen.getByRole('button', { name: /직전 결정 되돌리기/ })).toBeDisabled()
    await user.keyboard('x')
    await user.click(screen.getByRole('button', { name: /직전 결정 되돌리기/ }))
    expect(taskOf('a').deletedAt).toBeNull()
  })
})
