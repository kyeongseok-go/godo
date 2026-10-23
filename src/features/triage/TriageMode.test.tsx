import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { addDays, todayOf } from '../../domain/date'
import { INBOX_ID } from '../../domain/types'
import type { Project, Task } from '../../domain/types'
import { useApp } from '../../store/app'
import { applyChangeSet } from '../../store/changes'
import { makeProject, makeTask } from '../../test/factories'
import { seedStore, taskOf } from '../plan/testUtils'
import { TriageMode } from './TriageMode'

const today = (): string => todayOf(new Date(), 0)

function seed(tasks: Task[], projects: Project[] = []): void {
  seedStore(tasks)
  const { entities } = useApp.getState()
  const next = applyChangeSet(entities, { puts: { projects }, deletes: {} }).next
  useApp.setState({ entities: next })
}

const inbox = (id: string, title: string, extra: Partial<Task> = {}): Task =>
  makeTask({ id, title, projectId: INBOX_ID, order: Number(id.replace(/\D/g, '')) || 1, ...extra })

const work = makeProject({ id: 'work', name: '업무', order: 1 })
const home = makeProject({ id: 'home', name: '집', order: 2 })

let closed = 0
const renderTriage = () => {
  closed = 0
  return render(<TriageMode open onClose={() => (closed += 1)} />)
}

describe('TriageMode', () => {
  // jsdom 에는 <dialog> 의 showModal/close 가 없어 열림 속성만 흉내 낸다
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute('open')
    }
  })

  beforeEach(() => {
    seed([])
  })

  it('shows the first inbox item large with a position counter', () => {
    seed([inbox('a1', '메일 답장'), inbox('a2', '병원 예약')], [work])
    renderTriage()
    expect(screen.getByRole('heading', { name: '메일 답장' })).toBeInTheDocument()
    expect(screen.getByText('/ 2', { exact: false })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '병원 예약' })).not.toBeInTheDocument()
  })

  it('does not render anything while closed', () => {
    seed([inbox('a1', '메일 답장')])
    render(<TriageMode open={false} onClose={() => undefined} />)
    expect(screen.queryByText('메일 답장')).not.toBeInTheDocument()
  })

  it('schedules for today with T and tomorrow with M, staying in the inbox', async () => {
    seed([inbox('a1', '하나'), inbox('a2', '둘')], [work])
    const user = userEvent.setup()
    renderTriage()
    await user.keyboard('t')
    await user.keyboard('m')
    expect(taskOf('a1')).toMatchObject({ startDate: today(), projectId: INBOX_ID })
    expect(taskOf('a2').startDate).toBe(addDays(today(), 1))
  })

  it('shelves with S, deletes with X, and leaves a skipped item untouched with N', async () => {
    seed([inbox('a1', '하나'), inbox('a2', '둘'), inbox('a3', '셋')])
    const user = userEvent.setup()
    renderTriage()
    await user.keyboard('s')
    await user.keyboard('x')
    await user.keyboard('n')
    expect(taskOf('a1').someday).toBe(true)
    expect(taskOf('a2').deletedAt).not.toBeNull()
    expect(taskOf('a3')).toMatchObject({ someday: false, deletedAt: null, startDate: null })
  })

  it('moves to a project straight away with a number key', async () => {
    seed([inbox('a1', '하나'), inbox('a2', '둘')], [work, home])
    const user = userEvent.setup()
    renderTriage()
    await user.keyboard('2')
    expect(taskOf('a1').projectId).toBe('home')
    await user.keyboard('1')
    expect(taskOf('a2').projectId).toBe('work')
  })

  it('ignores a number with no project behind it', async () => {
    seed([inbox('a1', '하나')], [work])
    const user = userEvent.setup()
    renderTriage()
    await user.keyboard('5')
    expect(taskOf('a1').projectId).toBe(INBOX_ID)
    expect(screen.getByRole('heading', { name: '하나' })).toBeInTheDocument()
  })

  it('accepts with a project and a date through the accept panel', async () => {
    seed([inbox('a1', '하나')], [work, home])
    const user = userEvent.setup()
    renderTriage()
    await user.keyboard('a')
    expect(screen.getByRole('region', { name: '프로젝트와 날짜 정하기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /옮기기/ })).toBeDisabled()
    await user.keyboard('2')
    await user.keyboard('m')
    expect(taskOf('a1').projectId).toBe(INBOX_ID)
    await user.keyboard('{Enter}')
    expect(taskOf('a1')).toMatchObject({ projectId: 'home', startDate: addDays(today(), 1) })
  })

  it('lets the accept panel be driven by clicks too', async () => {
    seed([inbox('a1', '하나')], [work])
    const user = userEvent.setup()
    renderTriage()
    await user.click(screen.getByRole('button', { name: /수락/ }))
    const projects = screen.getByRole('group', { name: '프로젝트' })
    await user.click(within(projects).getByRole('button', { name: /업무/ }))
    await user.click(screen.getByRole('button', { name: /^.*옮기기/ }))
    expect(taskOf('a1').projectId).toBe('work')
  })

  it('closes only the accept panel with Escape and keeps the card', async () => {
    seed([inbox('a1', '하나')], [work])
    const user = userEvent.setup()
    renderTriage()
    await user.keyboard('a')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('region', { name: '프로젝트와 날짜 정하기' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '하나' })).toBeInTheDocument()
  })

  it('undoes the previous decision with Backspace and Z', async () => {
    seed([inbox('a1', '하나'), inbox('a2', '둘')])
    const user = userEvent.setup()
    renderTriage()
    await user.keyboard('x')
    await user.keyboard('{Backspace}')
    expect(taskOf('a1').deletedAt).toBeNull()
    expect(screen.getByRole('heading', { name: '하나' })).toBeInTheDocument()
    await user.keyboard('s')
    await user.keyboard('z')
    expect(taskOf('a1').someday).toBe(false)
  })

  it('ends with a summary and can close', async () => {
    seed([inbox('a1', '하나'), inbox('a2', '둘'), inbox('a3', '셋')], [work])
    const user = userEvent.setup()
    renderTriage()
    await user.keyboard('1')
    await user.keyboard('t')
    await user.keyboard('n')
    expect(screen.getByRole('heading', { name: '3개 중 프로젝트로 1, 오늘 1, 건너뜀 1' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '닫기' }))
    expect(closed).toBe(1)
  })

  it('shows a calm message when the inbox is already clear', () => {
    renderTriage()
    expect(screen.getByRole('heading', { name: '받은편지함이 비었어요.' })).toBeInTheDocument()
  })

  it('skips dated, someday and subtask items', () => {
    seed(
      [inbox('a1', '날짜 있음', { startDate: today() }), inbox('a2', '언젠가', { someday: true }), inbox('a3', '처리할 것')],
      [work],
    )
    renderTriage()
    expect(screen.getByRole('heading', { name: '처리할 것' })).toBeInTheDocument()
    expect(screen.getByText('/ 1', { exact: false })).toBeInTheDocument()
  })

  it('records each decision in the shared undo history with a label', async () => {
    seed([inbox('a1', '하나')])
    const user = userEvent.setup()
    renderTriage()
    await user.keyboard('x')
    expect(useApp.getState().undoStack.at(-1)?.label).toBe('받은편지함 정리: 삭제')
  })

  it('works with the buttons as well as the keys', async () => {
    seed([inbox('a1', '1'), inbox('a2', '2'), inbox('a3', '3'), inbox('a4', '4'), inbox('a5', '5'), inbox('a6', '6')], [work])
    const user = userEvent.setup()
    renderTriage()
    await user.click(screen.getByRole('button', { name: '오늘로' }))
    await user.click(screen.getByRole('button', { name: '내일로' }))
    await user.click(screen.getByRole('button', { name: '언젠가' }))
    await user.click(screen.getByRole('button', { name: '삭제' }))
    await user.click(screen.getByRole('button', { name: '건너뛰기' }))
    const quick = screen.getByRole('group', { name: '프로젝트로 바로 옮기기' })
    await user.click(within(quick).getByRole('button', { name: /업무/ }))
    expect(taskOf('a1').startDate).toBe(today())
    expect(taskOf('a2').startDate).toBe(addDays(today(), 1))
    expect(taskOf('a3').someday).toBe(true)
    expect(taskOf('a4').deletedAt).not.toBeNull()
    expect(taskOf('a5')).toMatchObject({ projectId: INBOX_ID, startDate: null })
    expect(taskOf('a6').projectId).toBe('work')
  })

  it('offers projects beyond the ninth in a select inside the accept panel', async () => {
    const many = Array.from({ length: 11 }, (_, i) => makeProject({ id: `p${i + 1}`, name: `프로젝트 ${i + 1}`, order: i + 1 }))
    seed([inbox('a1', '하나')], many)
    const user = userEvent.setup()
    renderTriage()
    await user.keyboard('a')
    await user.selectOptions(screen.getByLabelText('다른 프로젝트 고르기'), 'p11')
    await user.keyboard('0')
    await user.click(screen.getByRole('button', { name: /옮기기/ }))
    expect(taskOf('a1')).toMatchObject({ projectId: 'p11', startDate: null })
  })

  it('toggles a date chip off when pressed twice and returns with the back button', async () => {
    seed([inbox('a1', '하나')], [work])
    const user = userEvent.setup()
    renderTriage()
    await user.keyboard('a')
    await user.keyboard('t')
    expect(screen.getByRole('button', { name: /오늘/, pressed: true })).toBeInTheDocument()
    await user.keyboard('t')
    expect(screen.queryByRole('button', { name: /오늘/, pressed: true })).not.toBeInTheDocument()
    await user.keyboard('w')
    await user.click(screen.getByRole('button', { name: /돌아가기/ }))
    expect(screen.getByRole('heading', { name: '하나' })).toBeInTheDocument()
  })

  it('says there are no projects yet when none exist', async () => {
    seed([inbox('a1', '하나')], [])
    const user = userEvent.setup()
    renderTriage()
    await user.keyboard('a')
    expect(screen.getByText(/프로젝트가 아직 없어요/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /옮기기/ })).toBeDisabled()
  })

  it('closes with the X button and undoes with the card button', async () => {
    seed([inbox('a1', '하나'), inbox('a2', '둘')], [work])
    const user = userEvent.setup()
    renderTriage()
    await user.keyboard('x')
    await user.click(screen.getByRole('button', { name: /직전 결정 되돌리기/ }))
    expect(taskOf('a1').deletedAt).toBeNull()
    await user.click(screen.getByRole('button', { name: '정리 닫기' }))
    expect(closed).toBe(1)
  })

  it('undoes from the summary screen', async () => {
    seed([inbox('a1', '하나')])
    const user = userEvent.setup()
    renderTriage()
    await user.keyboard('x')
    await user.click(screen.getByRole('button', { name: '마지막 결정 되돌리기' }))
    expect(taskOf('a1').deletedAt).toBeNull()
    expect(screen.getByRole('heading', { name: '하나' })).toBeInTheDocument()
  })

  it('moves past an item that was handled elsewhere while the session was open', async () => {
    seed([inbox('a1', '하나'), inbox('a2', '둘')])
    renderTriage()
    act(() => {
      useApp.getState().commit({ puts: { tasks: [{ ...taskOf('a1'), projectId: 'work' }] }, deletes: {} }, '다른 곳에서 이동')
    })
    expect(await screen.findByRole('heading', { name: '둘' })).toBeInTheDocument()
  })
})
