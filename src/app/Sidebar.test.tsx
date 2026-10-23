import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { todayOf } from '../domain/date'
import { useApp } from '../store/app'
import { useUI } from '../store/ui'
import { makeLabel, makeProject, makeTask } from '../test/factories'
import { renderApp, resetApp } from '../test/render'
import { Sidebar } from './Sidebar'

beforeEach(async () => {
  await resetApp()
})

const today = () => todayOf(new Date(), 0)
const link = (name: string | RegExp) => screen.getByRole('link', { name })

function seed(): void {
  useApp.getState().commit(
    {
      puts: {
        projects: [
          makeProject({ id: 'work', name: '업무', order: 1 }),
          makeProject({ id: 'sub', name: '하위 프로젝트', parentId: 'work', order: 1 }),
          makeProject({ id: 'folder', name: '폴더', isFolder: true, order: 2 }),
          makeProject({ id: 'fav', name: '자주 가는 곳', favorite: true, order: 3 }),
          makeProject({ id: 'oldfav', name: '보관한 즐겨찾기', favorite: true, archived: true, order: 4 }),
        ],
        labels: [makeLabel({ id: 'l2', name: '둘째라벨', order: 2 }), makeLabel({ id: 'l1', name: '첫째라벨', order: 1 })],
        filters: [{ id: 'f1', name: '급한 일', query: 'p1', color: '#2f6f5e', favorite: false, order: 1 }],
        tasks: [
          makeTask({ id: 'i1', projectId: 'inbox' }),
          makeTask({ id: 'i2', projectId: 'inbox' }),
          makeTask({ id: 'w1', projectId: 'work', startDate: today() }),
          makeTask({ id: 'f1', projectId: 'fav' }),
          makeTask({ id: 'done', projectId: 'inbox', status: 'done', completedAt: 1 }),
        ],
      },
      deletes: {},
    },
    'seed',
    { history: false },
  )
}

describe('Sidebar', () => {
  test('shows open-task count badges on the smart lists and projects', () => {
    seed()
    renderApp(<Sidebar />)

    expect(within(link(/^받은편지함/)).getByText('2')).toBeInTheDocument()
    expect(within(link(/^오늘/)).getByText('1')).toBeInTheDocument()
    expect(within(link(/^업무/)).getByText('1')).toBeInTheDocument()
  })

  test('hides the badges when the setting turns counts off', () => {
    seed()
    useApp.getState().updateSettings({ sidebar: { ...useApp.getState().settings.sidebar, showCounts: false } })
    renderApp(<Sidebar />)

    expect(link(/^받은편지함/)).toHaveTextContent(/^받은편지함$/)
    expect(link(/^업무/)).toHaveTextContent(/^업무$/)
  })

  test('nests sub-projects under their parent and shows folders without a count', () => {
    seed()
    renderApp(<Sidebar />)

    const parent = link(/^업무/)
    const child = link('하위 프로젝트')
    expect(parent.parentElement?.querySelector('.nav-children')).toContainElement(child)
    expect(link('폴더')).toHaveTextContent(/^폴더$/)
  })

  test('lists favorites separately and leaves archived projects out of them', () => {
    seed()
    renderApp(<Sidebar />)

    expect(screen.getAllByRole('link', { name: /자주 가는 곳/ })).toHaveLength(2)
    const favorites = screen.getByRole('button', { name: '즐겨찾기' }).closest('section') as HTMLElement
    expect(within(favorites).getByRole('link', { name: /자주 가는 곳/ })).toBeInTheDocument()
    expect(within(favorites).queryByText('보관한 즐겨찾기')).not.toBeInTheDocument()
  })

  test('omits the favorites section when no project is a favorite', () => {
    renderApp(<Sidebar />)

    expect(screen.queryByRole('button', { name: '즐겨찾기' })).not.toBeInTheDocument()
  })

  test('shows labels and filters in their saved order', () => {
    seed()
    renderApp(<Sidebar />)

    const labelSection = screen.getByRole('button', { name: '라벨' }).closest('section') as HTMLElement
    expect(within(labelSection).getAllByRole('link').map((a) => a.textContent)).toEqual(['첫째라벨', '둘째라벨'])
    expect(link('급한 일')).toHaveAttribute('href', '/filter/f1')
  })

  test('hides the view modules and lists the user turned off in settings', () => {
    const { settings } = useApp.getState()
    useApp.getState().updateSettings({
      modules: { ...settings.modules, calendar: false, habits: false },
      sidebar: { ...settings.sidebar, showToday: false, showSomeday: false, showCompleted: false },
    })
    renderApp(<Sidebar />)

    for (const name of ['캘린더', '습관', '오늘', '언젠가', '완료']) {
      expect(screen.queryByRole('link', { name: new RegExp(`^${name}`) })).not.toBeInTheDocument()
    }
    expect(link('타임라인')).toBeInTheDocument()
    expect(link('집중')).toBeInTheDocument()
  })

  test('shows a hint when there are no projects yet', () => {
    renderApp(<Sidebar />)

    expect(screen.getByText('프로젝트를 만들어 할 일을 묶어 보세요.')).toBeInTheDocument()
  })

  test('collapses and expands a section from its heading', async () => {
    const user = userEvent.setup()
    seed()
    renderApp(<Sidebar />)
    const toggle = screen.getByRole('button', { name: '프로젝트' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: '하위 프로젝트' })).not.toBeInTheDocument()

    await user.click(toggle)
    expect(link('하위 프로젝트')).toBeInTheDocument()
  })

  test('starts the review group collapsed', () => {
    renderApp(<Sidebar />)

    expect(screen.getByRole('button', { name: '하루 정리' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: '주간 리뷰' })).not.toBeInTheDocument()
  })

  test('the add buttons open quick add, the palette and the entity dialogs', async () => {
    const user = userEvent.setup()
    renderApp(<Sidebar />)

    await user.click(screen.getByRole('button', { name: /작업 추가/ }))
    expect(useUI.getState().quickAdd.open).toBe(true)

    await user.click(screen.getByRole('button', { name: /검색 및 명령/ }))
    expect(useUI.getState().paletteOpen).toBe(true)

    await user.click(screen.getByRole('button', { name: '프로젝트 추가' }))
    expect(useUI.getState().entityDialog).toEqual({ kind: 'project' })
    await user.click(screen.getByRole('button', { name: '라벨 추가' }))
    expect(useUI.getState().entityDialog).toEqual({ kind: 'label' })
    await user.click(screen.getByRole('button', { name: '필터 추가' }))
    expect(useUI.getState().entityDialog).toEqual({ kind: 'filter' })
  })

  test('marks the current screen and closes the mobile menu when a link is chosen', async () => {
    const user = userEvent.setup()
    useUI.setState({ sidebarOpen: true })
    renderApp(<Sidebar />, '/inbox')
    expect(link(/^받은편지함/)).toHaveAttribute('aria-current', 'page')

    await user.click(link('휴지통'))

    expect(link('휴지통')).toHaveAttribute('aria-current', 'page')
    expect(useUI.getState().sidebarOpen).toBe(false)
  })
})
