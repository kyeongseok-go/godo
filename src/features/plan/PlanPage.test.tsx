import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlanPage } from '../../app/pages/PlanPage'
import { addDays, todayOf } from '../../domain/date'
import type { Task } from '../../domain/types'
import { useApp } from '../../store/app'
import { makeTask } from '../../test/factories'
import { planOf, seedStore, taskOf } from './testUtils'

const today = (): string => todayOf(new Date(), 0)

const renderAt = (url = '/plan') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <PlanPage />
    </MemoryRouter>,
  )

const at = (hour: number, minute = 0): void => {
  vi.setSystemTime(new Date(2026, 2, 10, hour, minute))
}

const todayTask = (id: string, title: string, extra: Partial<Task> = {}): Task =>
  makeTask({ id, title, startDate: today(), ...extra })

async function goToStep(user: ReturnType<typeof userEvent.setup>, n: number): Promise<void> {
  await user.click(screen.getByRole('button', { name: new RegExp(`^${n}단계`) }))
}

describe('PlanPage tabs', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    seedStore([])
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens the morning plan before 3 pm', () => {
    at(9)
    renderAt()
    expect(screen.getByRole('tab', { name: /아침 계획/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: '어제까지 못 한 일 확인' })).toBeInTheDocument()
  })

  it('opens the evening review from 3 pm', () => {
    at(16)
    renderAt()
    expect(screen.getByRole('tab', { name: /저녁 회고/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: '오늘 한 일 돌아보기' })).toBeInTheDocument()
  })

  it('lets the user switch tabs by click and by arrow keys, and keeps it in the URL', async () => {
    at(9)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAt()
    await user.click(screen.getByRole('tab', { name: /저녁 회고/ }))
    expect(screen.getByRole('heading', { name: '오늘 한 일 돌아보기' })).toBeInTheDocument()
    screen.getByRole('tab', { name: /저녁 회고/ }).focus()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: /아침 계획/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('respects the tab in the URL over the clock', () => {
    at(9)
    renderAt('/plan?tab=evening')
    expect(screen.getByRole('heading', { name: '오늘 한 일 돌아보기' })).toBeInTheDocument()
  })
})

describe('morning plan', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    at(9)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('step 1 points to the replan session with the leftover count', () => {
    seedStore([makeTask({ startDate: addDays(today(), -2) }), makeTask({ startDate: addDays(today(), -4) })])
    renderAt()
    expect(screen.getByText('어제까지 못 끝낸 일이 2개 있어요.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /밀린 일 정리하러 가기/ })).toHaveAttribute('href', '/replan')
  })

  it('step 1 says so when nothing is left over', () => {
    seedStore([])
    renderAt()
    expect(screen.getByText('밀린 일이 없어요. 가볍게 시작해 봐요.')).toBeInTheDocument()
  })

  it('step 2 puts an undated task on today when checked and takes it back when unchecked', async () => {
    seedStore([makeTask({ id: 'free', title: '메일 정리' })])
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAt()
    await goToStep(user, 2)
    const box = screen.getByRole('checkbox', { name: '"메일 정리" 오늘에 담기' })
    await user.click(box)
    expect(taskOf('free').startDate).toBe(today())
    expect(box).toHaveAttribute('aria-checked', 'true')
    await user.click(box)
    expect(taskOf('free').startDate).toBeNull()
  })

  it('step 2 lists what is already on today separately', async () => {
    seedStore([todayTask('t1', '회의 준비')])
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAt()
    await goToStep(user, 2)
    expect(screen.getByText('회의 준비')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /회의 준비/ })).not.toBeInTheDocument()
  })

  it('step 3 suggests tasks to push when the day overflows and pushes them all at once', async () => {
    seedStore([
      todayTask('big', '큰 일', { estimateMin: 300, priority: 1, dueDate: today() }),
      todayTask('s1', '작은 일 1', { estimateMin: 90 }),
      todayTask('s2', '작은 일 2', { estimateMin: 90 }),
    ])
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAt()
    await goToStep(user, 3)
    expect(screen.getByText(/넘쳤어요/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /한 번에 내일로 밀기/ }))
    const tomorrow = addDays(today(), 1)
    expect(taskOf('s1').startDate).toBe(tomorrow)
    expect(taskOf('s2').startDate).toBe(tomorrow)
    expect(taskOf('s1').postponeCount).toBe(1)
    expect(taskOf('big').startDate).toBe(today())
    expect(screen.queryByText(/넘쳤어요/)).not.toBeInTheDocument()
  })

  it('step 3 pushes one task with its own button', async () => {
    seedStore([todayTask('a', '가', { estimateMin: 240 }), todayTask('b', '나', { estimateMin: 240 })])
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAt()
    await goToStep(user, 3)
    await user.click(screen.getAllByRole('button', { name: /내일로$/ })[0])
    const moved = ['a', 'b'].filter((id) => taskOf(id).startDate === addDays(today(), 1))
    expect(moved).toHaveLength(1)
  })

  it('step 3 reassures when the day has room', async () => {
    seedStore([todayTask('a', '가', { estimateMin: 60 })])
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAt()
    await goToStep(user, 3)
    expect(screen.getByText('오늘은 여유 있게 담았어요. 이대로 괜찮아요.')).toBeInTheDocument()
  })

  it('step 4 stores up to three highlights and refuses a fourth', async () => {
    seedStore(['a', 'b', 'c', 'd'].map((id) => todayTask(id, `일 ${id}`)))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAt()
    await goToStep(user, 4)
    for (const id of ['a', 'b', 'c']) {
      await user.click(screen.getByRole('button', { name: `"일 ${id}" 오늘의 핵심으로` }))
    }
    expect(planOf(today())?.highlightIds).toEqual(['a', 'b', 'c'])
    await user.click(screen.getByRole('button', { name: '"일 d" 오늘의 핵심으로' }))
    expect(planOf(today())?.highlightIds).toEqual(['a', 'b', 'c'])
    expect(document.querySelector('.plan-count')).toHaveTextContent('3 / 3개 선택')
  })

  it('step 4 lets a highlight be removed', async () => {
    seedStore([todayTask('a', '일 a')])
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAt()
    await goToStep(user, 4)
    await user.click(screen.getByRole('button', { name: '"일 a" 오늘의 핵심으로' }))
    await user.click(screen.getByRole('button', { name: '"일 a" 핵심에서 빼기' }))
    expect(planOf(today())?.highlightIds).toEqual([])
  })

  it('step 4 points back to picking when nothing is planned', async () => {
    seedStore([])
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAt()
    await goToStep(user, 4)
    await user.click(screen.getByRole('button', { name: '후보 고르기로 가기' }))
    expect(screen.getByRole('heading', { name: '오늘 후보 고르기' })).toBeInTheDocument()
  })

  it('step 5 only previews until apply is pressed, then writes times and records the ritual', async () => {
    seedStore([todayTask('a', '보고서', { estimateMin: 60 }), todayTask('b', '정리', { estimateMin: 30 })])
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAt()
    await goToStep(user, 5)
    const preview = screen.getByRole('list', { name: '배치 제안 미리보기' })
    expect(within(preview).getAllByRole('listitem')).toHaveLength(2)
    expect(taskOf('a').startTime).toBeNull()

    await user.click(screen.getByRole('button', { name: '2개 적용하기' }))
    expect(taskOf('a').startTime).toBe('09:00')
    expect(taskOf('b').startTime).not.toBeNull()
    expect(taskOf('a').durationMin).toBe(60)

    await user.click(screen.getByRole('button', { name: '아침 계획 마치기' }))
    expect(planOf(today())?.morningDoneAt).not.toBeNull()
    expect(screen.getByRole('link', { name: '오늘 화면으로' })).toHaveAttribute('href', '/today')
  })

  it('step 5 explains in Korean why a task could not be placed', async () => {
    seedStore([todayTask('huge', '너무 긴 일', { estimateMin: 700 })])
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAt()
    await goToStep(user, 5)
    expect(screen.getByText('너무 긴 일')).toBeInTheDocument()
    expect(screen.getByText(/하루 용량\(360분\)보다 길어서/)).toBeInTheDocument()
  })

  it('step 5 says nothing needs a time when there is nothing to place', async () => {
    seedStore([])
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAt()
    await goToStep(user, 5)
    expect(screen.getByText(/시간을 정할 일이 없어요/)).toBeInTheDocument()
  })

  it('moves through the steps with next and previous buttons', async () => {
    seedStore([])
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAt()
    await user.click(screen.getByRole('button', { name: /오늘 후보 고르기/ }))
    expect(screen.getByRole('heading', { name: '오늘 후보 고르기' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /이전/ }))
    expect(screen.getByRole('heading', { name: '어제까지 못 한 일 확인' })).toBeInTheDocument()
  })

  it('marks the current step for assistive technology', () => {
    seedStore([])
    renderAt()
    expect(screen.getByRole('button', { name: /^1단계/ })).toHaveAttribute('aria-current', 'step')
  })
})

describe('evening review', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    at(20)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const doneToday = (id: string, title: string, extra: Partial<Task> = {}): Task =>
    makeTask({ id, title, status: 'done', completedAt: new Date(2026, 2, 10, 11, 0).getTime(), ...extra })

  it('step 1 lists what was done with estimate against actual time', () => {
    seedStore([
      doneToday('a', '아침에 끝낸 일', { estimateMin: 30, actualMin: { [today()]: 45 } }),
      doneToday('b', '또 끝낸 일', { estimateMin: 60, actualMin: { [today()]: 50 } }),
    ])
    renderAt()
    expect(screen.getByText('아침에 끝낸 일')).toBeInTheDocument()
    expect(screen.getByText('1시간 30분')).toBeInTheDocument()
    expect(screen.getByText('1시간 35분')).toBeInTheDocument()
    expect(screen.getByText('실제 45분')).toBeInTheDocument()
  })

  it('step 1 is gentle when nothing was finished', () => {
    seedStore([])
    renderAt()
    expect(screen.getByText(/오늘 끝낸 일이 아직 없어요/)).toBeInTheDocument()
  })

  it('step 1 reports how many highlights were completed', () => {
    seedStore(
      [doneToday('a', '핵심 일'), todayTask('b', '핵심 아닌 일')],
      [{ date: today(), capacityMin: null, highlightIds: ['a', 'b'], morningDoneAt: null, eveningDoneAt: null, reflection: '' }],
    )
    renderAt()
    expect(screen.getByText('오늘의 핵심 2개 중 1개를 끝냈어요.')).toBeInTheDocument()
  })

  it('step 2 carries leftovers to tomorrow, someday, or cancels them inline', async () => {
    seedStore([todayTask('a', '가'), todayTask('b', '나'), todayTask('c', '다')])
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAt()
    await goToStep(user, 2)
    await user.click(within(screen.getByRole('group', { name: '"가" 처리' })).getByRole('button', { name: '내일로' }))
    await user.click(within(screen.getByRole('group', { name: '"나" 처리' })).getByRole('button', { name: '언젠가' }))
    await user.click(within(screen.getByRole('group', { name: '"다" 처리' })).getByRole('button', { name: '취소' }))
    expect(taskOf('a').startDate).toBe(addDays(today(), 1))
    expect(taskOf('b')).toMatchObject({ someday: true, startDate: null })
    expect(taskOf('c').status).toBe('canceled')
    expect(screen.getByText('못 끝낸 일이 없어요. 깔끔하게 마무리했네요.')).toBeInTheDocument()
  })

  it('step 2 pushes everything to tomorrow at once and can be undone', async () => {
    seedStore([todayTask('a', '가'), todayTask('b', '나')])
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAt()
    await goToStep(user, 2)
    await user.click(screen.getByRole('button', { name: '2개 모두 내일로' }))
    expect(taskOf('a').startDate).toBe(addDays(today(), 1))
    useApp.getState().undo()
    expect(taskOf('a').startDate).toBe(today())
    expect(taskOf('b').startDate).toBe(today())
  })

  it('step 3 saves the reflection and stamps the evening ritual', async () => {
    seedStore([])
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAt()
    await goToStep(user, 3)
    await user.type(screen.getByLabelText('오늘은 어땠나요?'), '  차분한 하루  ')
    await user.click(screen.getByRole('button', { name: '저녁 회고 마치기' }))
    expect(planOf(today())).toMatchObject({ reflection: '차분한 하루' })
    expect(planOf(today())?.eveningDoneAt).not.toBeNull()
    expect(screen.getByRole('button', { name: '회고 고쳐 저장' })).toBeInTheDocument()
  })

  it('step 3 shows the last seven days of reflections in a collapsed section', async () => {
    const day = (n: number) => addDays(today(), -n)
    const plan = (date: string, reflection: string) => ({
      date,
      capacityMin: null,
      highlightIds: [],
      morningDoneAt: null,
      eveningDoneAt: null,
      reflection,
    })
    seedStore([], [plan(day(1), '어제 회고'), plan(day(3), '사흘 전 회고'), plan(day(9), '너무 오래된 회고')])
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAt()
    await goToStep(user, 3)
    const details = screen.getByText(/지난 7일 회고/).closest('details')
    expect(details).not.toHaveAttribute('open')
    await user.click(screen.getByText(/지난 7일 회고/))
    expect(screen.getByText('어제 회고')).toBeInTheDocument()
    expect(screen.getByText('사흘 전 회고')).toBeInTheDocument()
    expect(screen.queryByText('너무 오래된 회고')).not.toBeInTheDocument()
  })
})
