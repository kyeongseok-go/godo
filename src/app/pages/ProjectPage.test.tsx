import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { addDays, todayOf } from '../../domain/date'
import { useApp } from '../../store/app'
import { useUI } from '../../store/ui'
import { makeProject, makeSection, makeTask } from '../../test/factories'
import { renderApp, resetApp } from '../../test/render'
import { ProjectPage } from './ProjectPage'

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
})

const today = () => todayOf(new Date(), 0)
const sections = () => Object.values(useApp.getState().entities.sections)

function Where() {
  const { pathname, search } = useLocation()
  return <p data-testid="where">{pathname + search}</p>
}

function renderProject(route = '/project/p1') {
  return renderApp(
    <>
      <Where />
      <Routes>
        <Route path="/project/:id" element={<ProjectPage />} />
        <Route path="/inbox" element={<p>받은편지함 화면</p>} />
      </Routes>
    </>,
    route,
  )
}

function seed(extra: Parameters<typeof makeProject>[0] = {}): void {
  useApp.getState().commit(
    {
      puts: {
        projects: [makeProject({ id: 'p1', name: '여행', ...extra })],
        sections: [makeSection({ id: 's1', projectId: 'p1', name: '준비', order: 1 })],
        tasks: [
          makeTask({ id: 'a', title: '여권 확인', projectId: 'p1', order: 1 }),
          makeTask({ id: 'b', title: '숙소 예약', projectId: 'p1', sectionId: 's1', order: 2 }),
          makeTask({ id: 'c', title: '다음 달 일정', projectId: 'p1', startDate: addDays(today(), 30), order: 3 }),
          makeTask({ id: 'd', title: '끝낸 일', projectId: 'p1', status: 'done', completedAt: 1, order: 4 }),
          makeTask({ id: 'other', title: '다른 프로젝트 일', projectId: 'inbox' }),
        ],
      },
      deletes: {},
    },
    'seed',
    { history: false },
  )
}

describe('ProjectPage', () => {
  test('shows the project name, its open task count and only its own tasks by section', () => {
    seed()
    renderProject()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^여행3/)
    expect(screen.getByText('프로젝트')).toBeInTheDocument()
    expect(screen.getByText('여권 확인')).toBeInTheDocument()
    const section = screen.getByRole('region', { name: '준비' })
    expect(within(section).getByText('숙소 예약')).toBeInTheDocument()
    expect(screen.queryByText('다른 프로젝트 일')).not.toBeInTheDocument()
    expect(screen.queryByText('끝낸 일')).not.toBeInTheDocument()
  })

  test('labels a folder project as a folder', () => {
    seed({ isFolder: true })
    renderProject()

    expect(screen.getByText('폴더')).toBeInTheDocument()
  })

  test('sends the user to the inbox when the project does not exist or was deleted', () => {
    seed({ deletedAt: 5 })
    renderProject('/project/p1')

    expect(screen.getByText('받은편지함 화면')).toBeInTheDocument()
  })

  test('adds a section by typing its name and pressing Enter, exactly once', async () => {
    const user = userEvent.setup()
    seed()
    renderProject()

    await user.click(screen.getByRole('button', { name: /섹션 추가/ }))
    await user.type(screen.getByRole('textbox', { name: '새 섹션 이름' }), '  진행 중  {Enter}')

    await waitFor(() => expect(sections().map((s) => s.name).sort()).toEqual(['준비', '진행 중']))
    expect(screen.getByRole('region', { name: '진행 중' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: '새 섹션 이름' })).not.toBeInTheDocument()
    expect(useApp.getState().undoStack.at(-1)?.label).toBe('섹션 추가')
  })

  test('adds a section when the name field loses focus', async () => {
    const user = userEvent.setup()
    seed()
    renderProject()

    await user.click(screen.getByRole('button', { name: /섹션 추가/ }))
    await user.type(screen.getByRole('textbox', { name: '새 섹션 이름' }), '마무리')
    await user.click(document.body)

    await waitFor(() => expect(sections().map((s) => s.name)).toContain('마무리'))
  })

  test('Escape and an empty name add no section', async () => {
    const user = userEvent.setup()
    seed()
    renderProject()

    await user.click(screen.getByRole('button', { name: /섹션 추가/ }))
    await user.type(screen.getByRole('textbox', { name: '새 섹션 이름' }), '버릴 이름{Escape}')
    expect(screen.queryByRole('textbox', { name: '새 섹션 이름' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /섹션 추가/ }))
    await user.type(screen.getByRole('textbox', { name: '새 섹션 이름' }), '   {Enter}')

    expect(sections()).toHaveLength(1)
  })

  test('hides tasks that have not started yet only when the setting is on', () => {
    seed()
    const { unmount } = renderProject()
    expect(screen.getByText('다음 달 일정')).toBeInTheDocument()
    unmount()

    useApp.getState().updateSettings({ hideFutureTasks: true })
    renderProject()

    expect(screen.queryByText('다음 달 일정')).not.toBeInTheDocument()
    expect(screen.getByText('여권 확인')).toBeInTheDocument()
  })

  test('switches between list and board and keeps the choice in the address', async () => {
    const user = userEvent.setup()
    seed()
    renderProject()
    const views = screen.getByRole('tablist', { name: '보기 방식' })

    await user.click(within(views).getByRole('tab', { name: /칸반/ }))
    expect(screen.getByTestId('where')).toHaveTextContent('/project/p1?view=board')
    expect(await screen.findByRole('button', { name: /열 추가/ })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '섹션 없음' })).toBeInTheDocument()

    await user.click(within(views).getByRole('tab', { name: /목록/ }))
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/project\/p1$/)
    expect(screen.getByRole('button', { name: /섹션 추가/ })).toBeInTheDocument()
  })

  test('opens in the project default view and lists only the enabled view modules', () => {
    seed({ defaultView: 'board' })
    const { settings } = useApp.getState()
    useApp.getState().updateSettings({ modules: { ...settings.modules, calendar: false, timeline: false } })
    renderProject()

    const views = screen.getByRole('tablist', { name: '보기 방식' })
    expect(within(views).getByRole('tab', { name: /칸반/ })).toHaveAttribute('aria-selected', 'true')
    expect(within(views).queryByRole('tab', { name: /캘린더/ })).not.toBeInTheDocument()
    expect(within(views).queryByRole('tab', { name: /타임라인/ })).not.toBeInTheDocument()
    expect(within(views).getByRole('tab', { name: /매트릭스/ })).toBeInTheDocument()
  })

  test.each([
    ['calendar', 'group', '월간 달력'],
    ['timeline', 'region', '날짜 없는 할 일'],
    ['matrix', 'region', '지금 하기'],
  ] as const)('renders the %s view for the project', async (view, role, name) => {
    seed()
    renderProject(`/project/p1?view=${view}`)

    expect(await screen.findByRole(role, { name })).toBeInTheDocument()
  })

  test('groups the list by priority instead of sections when a grouping is chosen', () => {
    seed()
    renderProject('/project/p1?group=priority')

    expect(screen.queryByRole('button', { name: /섹션 추가/ })).not.toBeInTheDocument()
    expect(screen.getByText('여권 확인')).toBeInTheDocument()
  })

  test('shows completed tasks when the view option asks for them', () => {
    seed()
    renderProject('/project/p1?done=1')

    expect(screen.getByText('끝낸 일')).toBeInTheDocument()
  })

  test('the settings button opens the project dialog for this project', async () => {
    const user = userEvent.setup()
    seed()
    renderProject()

    await user.click(screen.getByRole('button', { name: '프로젝트 설정' }))

    expect(useUI.getState().entityDialog).toEqual({ kind: 'project', id: 'p1' })
  })
})
