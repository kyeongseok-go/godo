import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useApp } from '../../store/app'
import { useToasts } from '../../ui/toast'
import { makeProject, makeTask } from '../../test/factories'
import { renderApp, resetApp } from '../../test/render'
import { DetailPanel } from './DetailPanel'

beforeEach(async () => {
  await resetApp()
  useToasts.setState({ toasts: [] })
})

const taskA = (overrides: Parameters<typeof makeTask>[0] = {}) => makeTask({ id: 'a', title: '보고서 쓰기', ...overrides })
const seed = (...tasks: ReturnType<typeof makeTask>[]) =>
  useApp.getState().commit({ puts: { tasks }, deletes: {} }, 'seed', { history: false })
const stored = (id = 'a') => useApp.getState().entities.tasks[id]
const toastMessages = () => useToasts.getState().toasts.map((t) => t.message)
const panel = () => screen.getByLabelText('할 일 상세', { selector: 'aside' })

function openPanel(task = taskA()) {
  seed(task)
  return renderApp(<DetailPanel />, `/inbox?task=${task.id}`)
}

async function chooseFromMenu(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name: '더 보기' }))
  await user.click(await screen.findByRole('menuitem', { name }))
}

describe('DetailPanel', () => {
  test('stays hidden and inert when no task is open', () => {
    seed(taskA())
    renderApp(<DetailPanel />, '/inbox')

    expect(panel()).toHaveAttribute('aria-hidden', 'true')
    expect(panel()).toHaveAttribute('data-open', 'false')
    expect(screen.queryByLabelText('제목')).not.toBeInTheDocument()
  })

  test('shows the open task with the project it belongs to', () => {
    useApp.getState().commit({ puts: { projects: [makeProject({ id: 'w', name: '업무' })] }, deletes: {} }, 'seed', { history: false })
    openPanel(taskA({ projectId: 'w' }))

    expect(panel()).toHaveAttribute('data-open', 'true')
    expect(screen.getByLabelText('제목')).toHaveValue('보고서 쓰기')
    // 머리글의 프로젝트 이름과 프로젝트 필드 버튼, 두 군데에 나온다.
    expect(within(panel()).getAllByText('업무')).toHaveLength(2)
  })

  describe('title', () => {
    test('saves the edited title when focus leaves the field', async () => {
      const user = userEvent.setup()
      openPanel()

      const input = screen.getByLabelText('제목')
      await user.clear(input)
      await user.type(input, '보고서 다듬기')
      await user.tab()

      await waitFor(() => expect(stored().title).toBe('보고서 다듬기'))
    })

    test('saves with Enter but ignores Enter while a Korean syllable is still composing', async () => {
      const user = userEvent.setup()
      openPanel()
      const input = screen.getByLabelText('제목')
      await user.clear(input)
      await user.type(input, '새 제목')

      fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
      expect(stored().title).toBe('보고서 쓰기')

      await user.keyboard('{Enter}')
      await waitFor(() => expect(stored().title).toBe('새 제목'))
    })

    test('puts the old title back when the field is emptied', async () => {
      const user = userEvent.setup()
      openPanel()

      const input = screen.getByLabelText('제목')
      await user.clear(input)
      await user.tab()

      expect(input).toHaveValue('보고서 쓰기')
      expect(stored().title).toBe('보고서 쓰기')
    })

    test('Escape discards the edit without closing the panel', async () => {
      const user = userEvent.setup()
      openPanel()

      const input = screen.getByLabelText('제목')
      await user.type(input, ' 추가')
      await user.keyboard('{Escape}')

      expect(input).toHaveValue('보고서 쓰기')
      expect(stored().title).toBe('보고서 쓰기')
      expect(panel()).toHaveAttribute('data-open', 'true')
    })
  })

  test('the checkbox completes the task and then reopens it', async () => {
    const user = userEvent.setup()
    openPanel()

    await user.click(screen.getByRole('checkbox', { name: '완료' }))
    await waitFor(() => expect(stored().status).toBe('done'))

    await user.click(screen.getByRole('checkbox', { name: '완료 취소' }))
    await waitFor(() => expect(stored().status).toBe('todo'))
  })

  describe('closing', () => {
    test('the close button hides the panel', async () => {
      const user = userEvent.setup()
      openPanel()

      await user.click(screen.getByRole('button', { name: '닫기' }))

      await waitFor(() => expect(panel()).toHaveAttribute('data-open', 'false'))
      expect(screen.queryByLabelText('제목')).not.toBeInTheDocument()
    })

    test('Escape closes the panel', async () => {
      const user = userEvent.setup()
      openPanel()

      await user.keyboard('{Escape}')

      await waitFor(() => expect(panel()).toHaveAttribute('data-open', 'false'))
    })

    test('Escape only closes an open menu first and keeps the panel', async () => {
      const user = userEvent.setup()
      openPanel()
      await user.click(screen.getByRole('button', { name: '더 보기' }))
      await screen.findByRole('menu')

      await user.keyboard('{Escape}')

      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
      expect(panel()).toHaveAttribute('data-open', 'true')
    })
  })

  describe('more menu', () => {
    test('pins the task and offers to unpin it afterwards', async () => {
      const user = userEvent.setup()
      openPanel()

      await chooseFromMenu(user, '상단에 고정')
      expect(stored().pinned).toBe(true)

      await user.click(screen.getByRole('button', { name: '더 보기' }))
      expect(await screen.findByRole('menuitem', { name: '고정 해제' })).toBeInTheDocument()
    })

    test('duplicates the task and says so', async () => {
      const user = userEvent.setup()
      openPanel()

      await chooseFromMenu(user, '복제')

      const copies = Object.values(useApp.getState().entities.tasks).filter((t) => t.title === '보고서 쓰기')
      expect(copies).toHaveLength(2)
      expect(toastMessages()).toContain('복제했어요')
    })

    test('saves the task as a template', async () => {
      const user = userEvent.setup()
      openPanel()

      await chooseFromMenu(user, '템플릿으로 저장')

      const templates = Object.values(useApp.getState().entities.templates)
      expect(templates).toHaveLength(1)
      expect(templates[0].name).toBe('보고서 쓰기')
      expect(toastMessages().some((m) => m.includes('템플릿으로 저장했어요'))).toBe(true)
    })

    test('cancels the plan and disables that menu item afterwards', async () => {
      const user = userEvent.setup()
      openPanel()

      await chooseFromMenu(user, '계획 취소')
      expect(stored().status).toBe('canceled')

      await user.click(screen.getByRole('button', { name: '더 보기' }))
      expect(await screen.findByRole('menuitem', { name: '계획 취소' })).toBeDisabled()
    })

    test('only offers to skip an occurrence for repeating tasks', async () => {
      const user = userEvent.setup()
      const { unmount } = openPanel()
      await user.click(screen.getByRole('button', { name: '더 보기' }))
      await screen.findByRole('menu')
      expect(screen.queryByRole('menuitem', { name: '이번 회차 건너뛰기' })).not.toBeInTheDocument()
      unmount()

      openPanel(
        makeTask({
          id: 'r',
          title: '매일 운동',
          startDate: '2026-10-23',
          recurrence: { freq: 'daily', interval: 1, anchor: 'due', end: { type: 'never' }, resetSubtasks: false },
        }),
      )
      await chooseFromMenu(user, '이번 회차 건너뛰기')
      await waitFor(() => expect(stored('r').startDate).toBe('2026-10-24'))
    })

    test('copies a link that points at the task', async () => {
      const user = userEvent.setup()
      openPanel()

      await chooseFromMenu(user, '링크 복사')

      await waitFor(() => expect(toastMessages()).toContain('링크를 복사했어요'))
      expect(await navigator.clipboard.readText()).toContain('#/inbox?task=a')
    })

    test('reports an error when the clipboard refuses the link', async () => {
      const user = userEvent.setup()
      openPanel()
      vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('denied'))

      await chooseFromMenu(user, '링크 복사')

      await waitFor(() => expect(toastMessages()).toContain('링크를 복사하지 못했어요'))
    })

    test('moves the task to the trash and closes the panel', async () => {
      const user = userEvent.setup()
      openPanel()

      await chooseFromMenu(user, '휴지통으로')

      expect(stored().deletedAt).not.toBeNull()
      await waitFor(() => expect(panel()).toHaveAttribute('data-open', 'false'))
      expect(toastMessages()).toContain('휴지통으로 옮겼어요')
    })
  })

  describe('a task in the trash', () => {
    const trashed = () => taskA({ deletedAt: 1 })

    test('shows the banner and locks every field', () => {
      openPanel(trashed())

      expect(screen.getByText(/휴지통에 있어요/)).toBeInTheDocument()
      expect(screen.getByLabelText('제목')).toBeDisabled()
      expect(screen.getByLabelText('마감일')).toBeDisabled()
    })

    test('restores from the menu and the banner goes away', async () => {
      const user = userEvent.setup()
      openPanel(trashed())

      await chooseFromMenu(user, '복원')

      await waitFor(() => expect(stored().deletedAt).toBeNull())
      expect(screen.queryByText(/휴지통에 있어요/)).not.toBeInTheDocument()
      expect(screen.getByLabelText('제목')).toBeEnabled()
    })

    test('deletes forever from the menu and closes the panel', async () => {
      const user = userEvent.setup()
      openPanel(trashed())

      await chooseFromMenu(user, '영구 삭제')

      await waitFor(() => expect(stored()).toBeUndefined())
      await waitFor(() => expect(panel()).toHaveAttribute('data-open', 'false'))
    })
  })

  test('shows how often the task was postponed and the time actually spent', () => {
    openPanel(taskA({ postponeCount: 3, actualMin: { '2026-10-20': 40, '2026-10-21': 20 } }))

    expect(screen.getByText('3번 미룸')).toBeInTheDocument()
    expect(screen.getByText('실제 1시간 사용')).toBeInTheDocument()
  })
})
