import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { todayOf } from '../../domain/date'
import { useApp } from '../../store/app'
import { useUI } from '../../store/ui'
import { makeLabel, makeTask } from '../../test/factories'
import { renderApp, resetApp } from '../../test/render'
import { CalendarPage, FilterPage, LabelPage, MatrixPage, SearchPage, TimelinePage } from './QueryPages'

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

function Where() {
  const { pathname, search } = useLocation()
  return <p data-testid="where">{pathname + search}</p>
}

function renderRoutes(route: string) {
  return renderApp(
    <>
      <Where />
      <Routes>
        <Route path="/search" element={<SearchPage />} />
        <Route path="/label/:id" element={<LabelPage />} />
        <Route path="/filter/:id" element={<FilterPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/matrix" element={<MatrixPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/inbox" element={<p>받은편지함 화면</p>} />
      </Routes>
    </>,
    route,
  )
}

/** 화면에 나온 할 일 제목을 위에서 아래로(검색창의 "완료 포함" 체크박스는 제외) */
const titles = () =>
  screen
    .queryAllByRole('checkbox')
    .flatMap((c) => /^"(.+)" 완료( 취소)?$/.exec(c.getAttribute('aria-label') ?? '')?.[1] ?? [])
const address = () => decodeURIComponent(screen.getByTestId('where').textContent ?? '')

function seed(): void {
  useApp.getState().commit(
    {
      puts: {
        labels: [makeLabel({ id: 'l1', name: '장보기' })],
        filters: [
          { id: 'f1', name: '오늘 것', query: 'today', color: '#2f6f5e', favorite: false, order: 1 },
          { id: 'bad', name: '깨진 필터', query: 'p5', color: '#2f6f5e', favorite: false, order: 2 },
          { id: 'two', name: '두 묶음', query: 'today, p1', color: '#2f6f5e', favorite: false, order: 3 },
        ],
        tasks: [
          makeTask({ id: 'desc', title: '정리하기', description: '우유 사기 메모', order: 1 }),
          makeTask({ id: 'title', title: '우유 사기', order: 2 }),
          makeTask({ id: 'both', title: '아침 우유', description: '우유', order: 3 }),
          makeTask({ id: 'mid', title: '냉장고우유', order: 10 }),
          makeTask({ id: 'done', title: '우유 마신 일', status: 'done', completedAt: 1, order: 4 }),
          makeTask({ id: 'gone', title: '지운 우유', deletedAt: 3, order: 5 }),
          makeTask({ id: 'lab', title: '라벨 있는 일', labelIds: ['l1'], order: 6 }),
          makeTask({ id: 'lab2', title: '끝난 라벨 일', labelIds: ['l1'], status: 'done', completedAt: 1, order: 7 }),
          makeTask({ id: 'now', title: '오늘 할 일', startDate: today(), order: 8 }),
          makeTask({ id: 'urgent', title: '급한 일', priority: 1, order: 9 }),
        ],
      },
      deletes: {},
    },
    'seed',
    { history: false },
  )
}

describe('SearchPage', () => {
  test('asks for a search term when the query is empty', () => {
    renderRoutes('/search')

    expect(screen.getByText('검색어를 입력하면 결과가 여기에 나와요.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '필터로 저장' })).not.toBeInTheDocument()
  })

  test('ranks title matches above description-only matches and skips deleted tasks', () => {
    seed()
    renderRoutes('/search?q=우유')

    const order = titles()
    expect(order).not.toContain('지운 우유')
    expect(order).toHaveLength(5)
    const rank = (title: string) => order.indexOf(title)
    expect(rank('우유 사기')).toBeLessThan(rank('아침 우유'))
    expect(rank('아침 우유')).toBeLessThan(rank('냉장고우유'))
    expect(rank('냉장고우유')).toBeLessThan(rank('정리하기'))
    expect(order.at(-1)).toBe('정리하기')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^검색5/)
  })

  test('also finds a task by the text of its comments', () => {
    seed()
    useApp.getState().commit(
      { puts: { comments: [{ id: 'c1', taskId: 'lab', body: '쿠팡에서 주문', createdAt: 1 }] }, deletes: {} },
      'seed',
      { history: false },
    )
    renderRoutes('/search?q=쿠팡')

    expect(titles()).toEqual(['라벨 있는 일'])
  })

  test('leaves completed tasks out when "완료 포함" is unchecked', async () => {
    const user = userEvent.setup()
    seed()
    renderRoutes('/search?q=우유')

    await user.click(screen.getByRole('checkbox', { name: '완료 포함' }))

    expect(titles()).not.toContain('우유 마신 일')
    expect(address()).toContain('done=0')
  })

  test('typing in the box puts the term in the address and clearing it removes it', async () => {
    const user = userEvent.setup()
    seed()
    renderRoutes('/search')

    await user.type(screen.getByRole('searchbox', { name: '검색어' }), '급한')
    expect(address()).toBe('/search?q=급한')
    expect(titles()).toEqual(['급한 일'])

    await user.clear(screen.getByRole('searchbox', { name: '검색어' }))
    expect(address()).toBe('/search')
  })

  test('says so when nothing matches', () => {
    seed()
    renderRoutes('/search?q=없는말')

    expect(screen.getByText('검색 결과가 없어요.')).toBeInTheDocument()
  })

  test('saves the search as a filter, quoting terms that contain spaces', async () => {
    const user = userEvent.setup()
    seed()
    renderRoutes('/search?q=우유 사기')

    await user.click(screen.getByRole('button', { name: '필터로 저장' }))

    expect(useUI.getState().entityDialog).toEqual({ kind: 'filter', query: 'search: "우유 사기"' })
  })
})

describe('LabelPage', () => {
  test('lists the open tasks of the label with the label as the title', () => {
    seed()
    renderRoutes('/label/l1')

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^# 장보기1/)
    expect(titles()).toEqual(['라벨 있는 일'])
  })

  test('shows the label tasks that were completed when asked to', () => {
    seed()
    renderRoutes('/label/l1?done=1')

    expect(screen.getByText('끝난 라벨 일')).toBeInTheDocument()
  })

  test('sends an unknown label back to the inbox', () => {
    renderRoutes('/label/nope')

    expect(screen.getByText('받은편지함 화면')).toBeInTheDocument()
  })

  test('the edit button opens the label dialog', async () => {
    const user = userEvent.setup()
    seed()
    renderRoutes('/label/l1')

    await user.click(screen.getByRole('button', { name: '라벨 편집' }))

    expect(useUI.getState().entityDialog).toEqual({ kind: 'label', id: 'l1' })
  })

  test('says so when no task has the label', () => {
    useApp.getState().commit({ puts: { labels: [makeLabel({ id: 'empty', name: '빈 라벨' })] }, deletes: {} }, 'seed', { history: false })
    renderRoutes('/label/empty')

    expect(screen.getByText('이 라벨이 붙은 할 일이 없어요.')).toBeInTheDocument()
  })
})

describe('FilterPage', () => {
  test('runs the saved query and shows its matches with the query as a caption', () => {
    seed()
    renderRoutes('/filter/f1')

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^오늘 것1/)
    expect(titles()).toEqual(['오늘 할 일'])
    expect(screen.getByText('today', { selector: 'code' })).toBeInTheDocument()
  })

  test('shows each comma-separated group under its own heading', () => {
    seed()
    renderRoutes('/filter/two')

    expect(screen.getByRole('heading', { name: /묶음 1/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /묶음 2/ })).toBeInTheDocument()
  })

  test('explains where a broken query failed instead of showing tasks', () => {
    seed()
    renderRoutes('/filter/bad')

    expect(screen.getByRole('alert')).toHaveTextContent('조건을 해석하지 못했어요: 알 수 없는 조건 "p5"입니다 (위치 1)')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  test('sends an unknown filter back to the inbox and edits through the dialog', async () => {
    const user = userEvent.setup()
    seed()
    const { unmount } = renderRoutes('/filter/nope')
    expect(screen.getByText('받은편지함 화면')).toBeInTheDocument()
    unmount()

    renderRoutes('/filter/f1')
    await user.click(screen.getByRole('button', { name: '필터 편집' }))

    expect(useUI.getState().entityDialog).toEqual({ kind: 'filter', id: 'f1' })
  })
})

describe('calendar, matrix and timeline pages', () => {
  test('render their views with the open and scheduled tasks', async () => {
    seed()
    const calendar = renderRoutes('/calendar')
    expect(await screen.findByRole('group', { name: '월간 달력' })).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: '월간 달력' })).getByText('오늘 할 일')).toBeInTheDocument()
    calendar.unmount()

    const matrix = renderRoutes('/matrix')
    expect(screen.getByRole('region', { name: '지금 하기' })).toHaveTextContent('급한 일')
    matrix.unmount()

    renderRoutes('/timeline')
    expect(screen.getByRole('button', { name: '오늘 할 일' })).toBeInTheDocument()
  })
})
