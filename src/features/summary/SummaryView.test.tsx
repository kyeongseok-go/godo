import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'
import { todayOf } from '../../domain/date'
import type { Task } from '../../domain/types'
import { useApp } from '../../store/app'
import { makeProject, makeTask } from '../../test/factories'
import { renderApp, resetApp } from '../../test/render'
import { useToasts } from '../../ui/toast'
import { SummaryView } from './SummaryView'

const today = (): string => todayOf(new Date(), useApp.getState().settings.dayStartHour)

function seed(tasks: Task[]): void {
  const projects = [makeProject({ id: 'work', name: '업무', order: 1 }), makeProject({ id: 'home', name: '집', order: 2 })]
  useApp.getState().commit({ puts: { projects, tasks }, deletes: {} }, 'seed', { history: false })
}

const doneToday = (id: string, title: string, projectId = 'work'): Task =>
  makeTask({ id, title, projectId, status: 'done', completedAt: Date.now() })

function LocationProbe() {
  return <output data-testid="search">{useLocation().search}</output>
}

const renderSummary = (route = '/summary') =>
  renderApp(
    <>
      <SummaryView />
      <LocationProbe />
    </>,
    route,
  )

function mockClipboard(writeText: (text: string) => Promise<void>): void {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
}

beforeEach(async () => {
  await resetApp()
  useToasts.setState({ toasts: [] })
})

describe('SummaryView', () => {
  test('previews the markdown for the period in the URL', () => {
    seed([doneToday('a', '보고서 작성'), doneToday('b', '청소', 'home')])

    renderSummary('/summary?range=today')

    expect(screen.getByRole('heading', { name: '업무' })).toBeInTheDocument()
    expect(within(screen.getByRole('tabpanel')).getByText(`기간: ${today()} ~ ${today()} · 완료 2건 · 미완료 0건`)).toBeInTheDocument()
    expect(screen.getByText(/보고서 작성/)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '오늘' })).toBeChecked()
  })

  test('writes option changes to the URL and keeps unrelated keys', async () => {
    const user = userEvent.setup()
    seed([])
    renderSummary('/summary?task=abc')

    await user.click(screen.getByRole('radio', { name: '지난 주' }))
    await user.click(screen.getByRole('radio', { name: '완료' }))

    const search = screen.getByTestId('search').textContent ?? ''
    expect(search).toContain('range=lastWeek')
    expect(search).toContain('status=completed')
    expect(search).toContain('task=abc')
  })

  test('filters by project chips and returns to "all"', async () => {
    const user = userEvent.setup()
    seed([doneToday('a', '보고서 작성'), doneToday('b', '청소', 'home')])
    renderSummary('/summary?range=today')

    await user.click(screen.getByRole('button', { name: '집' }))

    expect(screen.queryByText(/보고서 작성/)).not.toBeInTheDocument()
    expect(screen.getByText(/청소/)).toBeInTheDocument()
    expect(screen.getByTestId('search')).toHaveTextContent('projects=home')

    await user.click(screen.getByRole('button', { name: '전체' }))
    expect(screen.getByText(/보고서 작성/)).toBeInTheDocument()
    expect(screen.getByTestId('search').textContent).not.toContain('projects')
  })

  test('shows custom date inputs seeded from the current range', async () => {
    const user = userEvent.setup()
    seed([])
    renderSummary('/summary?range=today')

    await user.click(screen.getByRole('radio', { name: '사용자 지정' }))

    expect(screen.getByLabelText('시작')).toHaveValue(today())
    expect(screen.getByLabelText('끝')).toHaveValue(today())
    expect(screen.getByTestId('search')).toHaveTextContent(`from=${today()}`)
  })

  test('editing the custom dates updates the URL and the report', () => {
    seed([makeTask({ id: 'a', title: '옛날 일', status: 'done', completedAt: new Date(2026, 8, 10, 12).getTime() })])
    renderSummary('/summary?range=custom&from=2026-10-01&to=2026-10-02')
    expect(screen.queryByText(/옛날 일/)).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('시작'), { target: { value: '2026-09-01' } })
    fireEvent.change(screen.getByLabelText('끝'), { target: { value: '2026-09-30' } })

    expect(screen.getByTestId('search')).toHaveTextContent('from=2026-09-01')
    expect(screen.getByTestId('search')).toHaveTextContent('to=2026-09-30')
    expect(screen.getByText(/옛날 일/)).toBeInTheDocument()
  })

  test('quick buttons set period and status and light up while active', async () => {
    const user = userEvent.setup()
    seed([])
    renderSummary()

    await user.click(screen.getByRole('button', { name: '다음 주 할 일' }))

    expect(screen.getByRole('button', { name: '다음 주 할 일' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '이번 주 한 일' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('search')).toHaveTextContent('status=pending')

    await user.click(screen.getByRole('button', { name: '이번 주 한 일' }))
    expect(screen.getByRole('radio', { name: '이번 주' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '완료' })).toBeChecked()
  })

  test('switches between preview and raw markdown with the keyboard', async () => {
    const user = userEvent.setup()
    seed([doneToday('a', '보고서 작성')])
    renderSummary('/summary?range=today')

    await user.click(screen.getByRole('tab', { name: '원문' }))
    expect(screen.getByLabelText('마크다운 원문')).toHaveTextContent('- [x] 보고서 작성')

    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: '미리보기' })).toHaveAttribute('aria-selected', 'true')
  })

  test('copies the markdown to the clipboard', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    seed([doneToday('a', '보고서 작성')])
    renderSummary('/summary?range=today')
    mockClipboard(writeText)

    await user.click(screen.getByRole('button', { name: /복사/ }))

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('- [x] 보고서 작성'))
    expect(useToasts.getState().toasts.at(-1)).toMatchObject({ message: '보고서를 복사했어요', tone: 'info' })
  })

  test('explains a clipboard failure with a toast and switches to the raw tab', async () => {
    const user = userEvent.setup()
    seed([doneToday('a', '보고서 작성')])
    renderSummary('/summary?range=today')
    mockClipboard(() => Promise.reject(new Error('denied')))

    await user.click(screen.getByRole('button', { name: /복사/ }))

    const toast = useToasts.getState().toasts.at(-1)
    expect(toast?.tone).toBe('error')
    expect(toast?.message).toContain('복사하지 못했어요')
    expect(await screen.findByLabelText('마크다운 원문')).toBeInTheDocument()
  })

  test('downloads a .md file named after the period', async () => {
    const user = userEvent.setup()
    seed([doneToday('a', '보고서 작성')])
    renderSummary('/summary?range=today')
    const createObjectURL = vi.fn(() => 'blob:summary')
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const names: string[] = []
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download)
    })

    await user.click(screen.getByRole('button', { name: /\.md 파일로 저장/ }))

    expect(names).toEqual([`godo-summary-${today()}.md`])
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0]
    expect(await blob.text()).toContain('보고서 작성')
    expect(useToasts.getState().toasts.at(-1)?.message).toBe('.md 파일로 저장했어요')
    click.mockRestore()
  })

  test('reports a download failure instead of swallowing it', async () => {
    const user = userEvent.setup()
    seed([])
    renderSummary()
    Object.assign(URL, {
      createObjectURL: () => {
        throw new Error('blocked')
      },
    })

    await user.click(screen.getByRole('button', { name: /\.md 파일로 저장/ }))

    expect(useToasts.getState().toasts.at(-1)).toMatchObject({ tone: 'error' })
    expect(useToasts.getState().toasts.at(-1)?.message).toContain('blocked')
    act(() => undefined)
  })
})
