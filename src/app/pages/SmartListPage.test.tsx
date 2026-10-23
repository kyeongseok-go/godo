import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { addDays, todayOf } from '../../domain/date'
import { useApp } from '../../store/app'
import { makeTask } from '../../test/factories'
import { renderApp, resetApp } from '../../test/render'
import { useToasts } from '../../ui/toast'
import { SmartListPage } from './SmartListPage'
import type { SmartListId } from '../../features/lists/smartLists'

// jsdom은 <dialog>의 showModal을 구현하지 않는다.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open')
  }
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(async () => {
  await resetApp()
  useToasts.setState({ toasts: [] })
})

const today = () => todayOf(new Date(), 0)
const yesterday = () => addDays(today(), -1)
const task = (id: string) => useApp.getState().entities.tasks[id]

function seed(...tasks: Parameters<typeof makeTask>[0][]): void {
  const made = tasks.map((t, i) => makeTask({ order: i + 1, ...t }))
  useApp.getState().commit({ puts: { tasks: made }, deletes: {} }, 'seed', { history: false })
}

function renderList(id: SmartListId) {
  return renderApp(
    <Routes>
      <Route path="/list" element={<SmartListPage id={id} />} />
      <Route path="/replan" element={<p>미완료 정리 화면</p>} />
    </Routes>,
    '/list',
  )
}

describe('SmartListPage today', () => {
  test('shows the overdue banner and moves every overdue task to today in one undo step', async () => {
    const user = userEvent.setup()
    seed({ id: 'a', title: '어제 일 A', startDate: yesterday() }, { id: 'b', title: '어제 일 B', dueDate: yesterday() }, { id: 'c', title: '오늘 일', startDate: today() })
    renderList('today')

    expect(screen.getByText(/가 날짜를 지났어요/).closest('p')).toHaveTextContent('2개가 날짜를 지났어요')
    const undoBefore = useApp.getState().undoStack.length

    await user.click(screen.getByRole('button', { name: /모두 오늘로/ }))

    expect([task('a').startDate, task('b').startDate]).toEqual([today(), today()])
    expect(useApp.getState().undoStack).toHaveLength(undoBefore + 1)
    await waitFor(() => expect(screen.queryByText(/가 날짜를 지났어요/)).not.toBeInTheDocument())

    useApp.getState().undo()
    expect(task('a').startDate).toBe(yesterday())
    expect(task('b').startDate).toBeNull()
  })

  test('offers a link to sort overdue tasks one by one', async () => {
    const user = userEvent.setup()
    seed({ title: '어제 일', startDate: yesterday() })
    renderList('today')

    await user.click(screen.getByRole('link', { name: '하나씩 정리' }))

    expect(screen.getByText('미완료 정리 화면')).toBeInTheDocument()
  })

  test('has no overdue banner when nothing is late, and says the day is free', () => {
    renderList('today')

    expect(screen.queryByText(/가 날짜를 지났어요/)).not.toBeInTheDocument()
    expect(screen.getByText('오늘 할 일이 없어요. 여유로운 하루네요.')).toBeInTheDocument()
  })

  test('shows today with the date line and the number of tasks', () => {
    seed({ title: '오늘 일 1', startDate: today() }, { title: '오늘 일 2', startDate: today() })
    renderList('today')

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^오늘2/)
    expect(screen.getByText(/월 .+일 .요일/)).toBeInTheDocument()
  })
})

describe('SmartListPage inbox', () => {
  test('starts triage from the button, which counts the tasks still to sort', async () => {
    const user = userEvent.setup()
    seed({ title: '정리할 일 1' }, { title: '정리할 일 2' }, { title: '날짜 있는 일', startDate: today() })
    renderList('inbox')

    await user.click(screen.getByRole('button', { name: /정리 시작 \(2\)/ }))

    const dialog = await screen.findByRole('dialog', { name: '받은편지함 정리' })
    expect(dialog).toBeInTheDocument()

    fireEvent(dialog, new Event('cancel', { cancelable: true }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '받은편지함 정리' })).not.toBeInTheDocument())
  })

  test('hides the triage button when nothing needs sorting', () => {
    seed({ title: '날짜 있는 일', startDate: today() })
    renderList('inbox')

    expect(screen.queryByRole('button', { name: /정리 시작/ })).not.toBeInTheDocument()
  })

  test('shows the empty hint for an empty inbox', () => {
    renderList('inbox')

    expect(screen.getByText(/받은편지함이 비었어요/)).toBeInTheDocument()
  })
})

describe('SmartListPage other lists', () => {
  test('empties the trash from the header button and lets the user undo it', async () => {
    const user = userEvent.setup()
    seed({ id: 'gone', title: '지운 일', deletedAt: 5 })
    renderList('trash')
    expect(screen.getByText('30일이 지나면 자동으로 영구 삭제돼요.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /휴지통 비우기/ }))

    expect(task('gone')).toBeUndefined()
    useApp.getState().undo()
    expect(task('gone')).toBeDefined()
  })

  test('has no empty-trash button when the trash is empty', () => {
    renderList('trash')

    expect(screen.queryByRole('button', { name: /휴지통 비우기/ })).not.toBeInTheDocument()
    expect(screen.getByText('휴지통이 비었어요.')).toBeInTheDocument()
  })

  test.each<[SmartListId, string]>([
    ['upcoming', '앞으로 7일은 비어 있어요.'],
    ['now', '지금 바로 할 수 있는 일이 없어요.'],
    ['completed', '완료한 일이 아직 없어요.'],
    ['someday', '"언젠가" 보관함이 비었어요'],
  ])('shows the empty message for %s', (id, message) => {
    renderList(id)

    expect(screen.getByText(new RegExp(message))).toBeInTheDocument()
  })

  test('lists upcoming tasks under their date', () => {
    seed({ title: '내일 일', startDate: addDays(today(), 1) })
    renderList('upcoming')

    expect(screen.getByText('내일 일')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /내일/ })).toBeInTheDocument()
  })
})
