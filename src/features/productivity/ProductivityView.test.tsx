import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Task } from '../../domain/types'
import { useApp } from '../../store/app'
import { makeProject, makeTask } from '../../test/factories'
import { renderApp, resetApp } from '../../test/render'
import { ProductivityView } from './ProductivityView'

function seed(tasks: Task[], projectIds: string[] = []): void {
  const projects = projectIds.map((id, order) => makeProject({ id, name: `프로젝트 ${id}`, order }))
  useApp.getState().commit({ puts: { projects, tasks }, deletes: {} }, 'seed', { history: false })
}

const done = (id: string, extra: Partial<Task> = {}): Task =>
  makeTask({ id, title: id, status: 'done', completedAt: Date.now(), ...extra })

const statOf = (label: string): HTMLElement => {
  const stat = screen.getByText(label).closest<HTMLElement>('.prod-stat')
  if (!stat) throw new Error(`stat not found: ${label}`)
  return stat
}

const settings = () => useApp.getState().settings.productivity

beforeEach(async () => {
  await resetApp()
})

describe('ProductivityView', () => {
  test('shows points, level and progress to the next level', () => {
    seed([done('a'), done('b')]) // 기본 5점 x 2건

    renderApp(<ProductivityView />)

    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('시작자')).toBeInTheDocument()
    const bar = screen.getByRole('progressbar', { name: '다음 레벨까지 진행' })
    expect(bar).toHaveAttribute('aria-valuenow', '2')
    expect(screen.getByText('다음 레벨까지 490점')).toBeInTheDocument()
  })

  test('shows today and week counts against the goals', () => {
    seed([done('a'), done('b'), done('c')])

    renderApp(<ProductivityView />)

    expect(statOf('오늘 완료')).toHaveTextContent('3/ 5')
    expect(statOf('오늘 완료')).toHaveTextContent('2건 남음')
    expect(statOf('이번 주 완료')).toHaveTextContent('3/ 25')
  })

  test('marks a met goal with text, not only color', () => {
    useApp.getState().updateSettings({ productivity: { ...settings(), dailyGoal: 1 } })
    seed([done('a')])

    renderApp(<ProductivityView />)

    expect(statOf('오늘 완료')).toHaveTextContent('목표 달성')
  })

  test('gives the same 30-day data as an accessible table', () => {
    seed([done('a'), done('b')])

    renderApp(<ProductivityView />)

    const table = screen.getByRole('table', { name: '최근 30일 일별 완료 건수' })
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(31)
    expect(within(rows.at(-1) as HTMLElement).getByText('2')).toBeInTheDocument()
    expect(rows.at(-1)).toHaveTextContent('오늘')
  })

  test('reads values with the arrow keys and shows them in a tooltip', async () => {
    const user = userEvent.setup()
    seed([done('a'), done('b')])
    const { container } = renderApp(<ProductivityView />)
    const tooltip = () => container.querySelector('.prod-trend__tooltip') as HTMLElement
    const chart = screen.getByRole('group', { name: /최근 30일 완료 추이/ })

    act(() => chart.focus())
    expect(tooltip()).toHaveTextContent('2건 완료')
    expect(tooltip()).toHaveTextContent('오늘')

    await user.keyboard('{ArrowLeft}')
    expect(tooltip()).toHaveTextContent('완료 없음')
    expect(tooltip()).not.toHaveTextContent('오늘')

    await user.keyboard('{Home}')
    expect(tooltip()).toHaveAttribute('data-visible', 'true')
    expect(tooltip()).not.toHaveTextContent('오늘')

    act(() => chart.blur())
    expect(tooltip()).toHaveAttribute('data-visible', 'false')
  })

  test('hovering a bar shows its value and leaving hides it', () => {
    seed([done('a')])
    const { container } = renderApp(<ProductivityView />)
    const tooltip = container.querySelector('.prod-trend__tooltip') as HTMLElement
    const svg = container.querySelector('svg.prod-trend__svg') as SVGSVGElement

    fireEvent.pointerMove(svg, { clientX: 28 + 20 * 29 + 5 }) // 마지막 막대 = 오늘
    expect(tooltip).toHaveAttribute('data-visible', 'true')
    expect(tooltip).toHaveTextContent('1건 완료')

    fireEvent.pointerLeave(svg)
    expect(tooltip).toHaveAttribute('data-visible', 'false')
  })

  test('shows an empty state instead of a chart before anything is completed', () => {
    seed([makeTask({ id: 'open' })])

    renderApp(<ProductivityView />)

    expect(screen.getByText(/아직 끝낸 일이 없어요/)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByText(/최근 30일에 끝낸 일이 없어요/)).toBeInTheDocument()
  })

  test('lists at most five projects and counts the rest', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f']
    seed(ids.map((id) => done(`t-${id}`, { projectId: id })), ids)

    renderApp(<ProductivityView />)

    expect(screen.getAllByText(/^프로젝트 /)).toHaveLength(5)
    expect(screen.getByText('그 밖에 1개 프로젝트에서도 끝냈어요.')).toBeInTheDocument()
  })

  test('saves goal steppers immediately and stops at the minimum', async () => {
    const user = userEvent.setup()
    seed([])
    renderApp(<ProductivityView />)

    await user.click(screen.getByRole('button', { name: '일일 목표 늘리기' }))
    await user.click(screen.getByRole('button', { name: '주간 목표 줄이기' }))

    expect(settings().dailyGoal).toBe(6)
    expect(settings().weeklyGoal).toBe(24)

    useApp.getState().updateSettings({ productivity: { ...settings(), dailyGoal: 1 } })
    expect(await screen.findByRole('button', { name: '일일 목표 줄이기' })).toBeDisabled()
  })

  test('toggles days off, listed from the configured week start', async () => {
    const user = userEvent.setup()
    seed([])
    renderApp(<ProductivityView />)
    const days = within(screen.getByRole('group', { name: '쉬는 요일' }))

    expect(days.getAllByRole('button').map((b) => b.textContent)).toEqual(['월', '화', '수', '목', '금', '토', '일'])
    expect(days.getByRole('button', { name: '토요일' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(days.getByRole('button', { name: '월요일' }))
    await user.click(days.getByRole('button', { name: '토요일' }))

    expect(settings().daysOff).toEqual([0, 1])
  })

  test('turns karma off: hides score and level but keeps goals', async () => {
    const user = userEvent.setup()
    seed([done('a')])
    renderApp(<ProductivityView />)

    await user.click(screen.getByRole('switch', { name: '카르마 사용' }))

    expect(settings().karmaEnabled).toBe(false)
    expect(screen.getByText('카르마가 꺼져 있어요')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(statOf('오늘 완료')).toHaveTextContent('1/ 5')
  })

  test('vacation mode shows an explanation when switched on', async () => {
    const user = userEvent.setup()
    seed([])
    renderApp(<ProductivityView />)
    expect(screen.queryByText(/휴가 중이에요/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('switch', { name: '휴가 모드' }))

    expect(settings().vacationMode).toBe(true)
    expect(screen.getByText(/휴가 중이에요/)).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: '휴가 모드' })).toBeChecked()
  })
})
