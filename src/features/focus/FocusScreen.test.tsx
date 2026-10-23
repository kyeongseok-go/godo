import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { useApp } from '../../store/app'
import { emptyEntityState } from '../../store/changes'
import { defaultSettings } from '../../store/defaults'
import { makeTask } from '../../test/factories'
import { FocusScreen } from './FocusScreen'
import { useFocus } from './focusStore'
import { createTimer } from './timer'

function renderScreen(path = '/focus') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <FocusScreen />
    </MemoryRouter>,
  )
}

const seed = (tasks = [makeTask({ id: 't1', title: '보고서 쓰기' }), makeTask({ id: 't2', title: '운동하기' })]) =>
  useApp.getState().commit({ puts: { tasks }, deletes: {} }, '추가', { history: false })

beforeAll(async () => {
  await useApp.getState().load()
})

beforeEach(() => {
  useFocus.setState({ timer: createTimer() })
  useApp.setState({ entities: emptyEntityState(), settings: defaultSettings() })
  document.title = 'godo'
})

afterEach(() => {
  useFocus.setState({ timer: createTimer() })
})

describe('FocusScreen: timer', () => {
  test('starts, pauses, resumes and stops from the main buttons', async () => {
    const user = userEvent.setup()
    renderScreen()
    expect(screen.getByRole('timer')).toHaveAccessibleName(/집중, 남은 시간 25분/)

    await user.click(screen.getByRole('button', { name: '시작' }))
    expect(useFocus.getState().timer.phase).toBe('running')

    await user.click(screen.getByRole('button', { name: '일시정지' }))
    expect(useFocus.getState().timer.phase).toBe('paused')
    expect(screen.getByText('· 일시정지')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '이어서 하기' }))
    expect(useFocus.getState().timer.phase).toBe('running')

    await user.click(screen.getByRole('button', { name: '중단' }))
    expect(useFocus.getState().timer.phase).toBe('idle')
  })

  test('mode cannot be switched while a session is running', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.click(screen.getByRole('button', { name: '스톱워치' }))
    expect(screen.getByRole('button', { name: '스톱워치' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: '건너뛰기' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '시작' }))
    expect(screen.getByRole('button', { name: '포모도로' })).toBeDisabled()
  })

  test('announces the next session after a focus finishes', () => {
    const now = Date.now()
    useFocus.setState({
      timer: {
        ...createTimer(),
        phase: 'running',
        startedAt: now - 1_500_000,
        runningSince: now - 1_500_000,
        targetMs: 1_500_000,
      },
    })
    renderScreen()

    expect(screen.getByRole('button', { name: '짧은 휴식 시작' })).toBeInTheDocument()
    expect(screen.getAllByText('다음: 짧은 휴식').length).toBeGreaterThan(0)
    expect(Object.values(useApp.getState().entities.focusSessions)).toHaveLength(1)
  })

  test('shows the remaining time in the document title and restores it on leave', async () => {
    const user = userEvent.setup()
    const { unmount } = renderScreen()
    await user.click(screen.getByRole('button', { name: '시작' }))
    await waitFor(() => expect(document.title).toMatch(/^(25:00|24:5\d) 집중 · godo$/))

    unmount()
    expect(document.title).toBe('godo')
  })
})

describe('FocusScreen: linking a task', () => {
  test('pre-links the task from ?task= and removes the parameter', async () => {
    seed()
    renderScreen('/focus?task=t1')

    await waitFor(() => expect(useFocus.getState().timer.taskId).toBe('t1'))
    expect(screen.getByText('보고서 쓰기')).toBeInTheDocument()
  })

  test('ignores an unknown task id', async () => {
    seed()
    renderScreen('/focus?task=ghost')
    await waitFor(() => expect(screen.getByText('연결하지 않아도 이름 없는 세션으로 기록돼요.')).toBeInTheDocument())
    expect(useFocus.getState().timer.taskId).toBeNull()
  })

  test('does not swap the task of a running session from the URL', async () => {
    seed()
    useFocus.getState().setTask('t2')
    useFocus.getState().start()
    renderScreen('/focus?task=t1')

    await waitFor(() => expect(document.body).toHaveTextContent('운동하기'))
    expect(useFocus.getState().timer.taskId).toBe('t2')
  })

  test('searches open tasks and links the chosen one', async () => {
    seed([
      makeTask({ id: 't1', title: '보고서 쓰기' }),
      makeTask({ id: 't2', title: '운동하기' }),
      makeTask({ id: 't3', title: '끝난 일', status: 'done' }),
    ])
    const user = userEvent.setup()
    renderScreen()

    await user.click(screen.getByRole('button', { name: '할 일 연결하기' }))
    const dialog = screen.getByRole('dialog', { name: '집중할 할 일 선택' })
    expect(within(dialog).queryByText('끝난 일')).not.toBeInTheDocument()

    await user.type(within(dialog).getByRole('searchbox', { name: '할 일 검색' }), '운동')
    await user.click(within(dialog).getByRole('button', { name: /운동하기/ }))

    expect(useFocus.getState().timer.taskId).toBe('t2')
    await user.click(screen.getByRole('button', { name: '할 일 연결 해제' }))
    expect(useFocus.getState().timer.taskId).toBeNull()
  })
})

describe('FocusScreen: stats and settings', () => {
  test('shows an empty hint with no sessions', () => {
    renderScreen()
    expect(screen.getByText(/아직 기록이 없어요/)).toBeInTheDocument()
    expect(screen.getByText(/할 일을 연결해 집중하면/)).toBeInTheDocument()
  })

  test('summarises sessions: totals, accessible 14-day table and top tasks with titles', () => {
    const startedAt = Date.now() - 60_000
    seed()
    useApp.getState().commit(
      {
        puts: {
          focusSessions: [
            { id: 's1', taskId: 't1', kind: 'pomodoro', startedAt, durationSec: 1500, completed: true },
            { id: 's2', taskId: 't1', kind: 'pomodoro', startedAt, durationSec: 1500, completed: true },
            { id: 's3', taskId: null, kind: 'stopwatch', startedAt, durationSec: 600, completed: true },
            { id: 's4', taskId: 't2', kind: 'pomodoro', startedAt, durationSec: 900, completed: false },
          ],
        },
        deletes: {},
      },
      '기록',
      { history: false },
    )
    renderScreen()

    const stats = screen.getByRole('region', { name: '집중 기록' })
    // 오늘 칸과 전체 칸이 같은 값이다(세션이 모두 오늘 시작).
    expect(within(stats).getAllByText('1시간', { selector: 'strong' })).toHaveLength(2)
    expect(within(stats).getAllByText('3회', { selector: 'span' })).toHaveLength(2)
    expect(within(stats).getByRole('img', { name: /최근 14일 집중 시간/ })).toBeInTheDocument()
    expect(within(stats).getAllByRole('row')).toHaveLength(15)
    expect(within(stats).getByText('보고서 쓰기')).toBeInTheDocument()
    expect(within(stats).queryByText('운동하기')).not.toBeInTheDocument()
    expect(within(stats).getByText('연결 없는 세션 10분')).toBeInTheDocument()
  })

  test('counts only completed pomodoros as dots', () => {
    const startedAt = Date.now() - 60_000
    useApp.getState().commit(
      {
        puts: {
          focusSessions: [
            { id: 's1', taskId: null, kind: 'pomodoro', startedAt, durationSec: 1500, completed: true },
            { id: 's2', taskId: null, kind: 'stopwatch', startedAt, durationSec: 1500, completed: true },
            { id: 's3', taskId: null, kind: 'pomodoro', startedAt, durationSec: 100, completed: false },
          ],
        },
        deletes: {},
      },
      '기록',
      { history: false },
    )
    renderScreen()
    expect(screen.getByRole('img', { name: '오늘 완료한 포모 1개' })).toBeInTheDocument()
  })

  test('saves valid settings and flags invalid ones without saving them', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.click(screen.getByText('타이머 설정'))

    const focusInput = screen.getByLabelText('집중')
    await user.clear(focusInput)
    expect(focusInput).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('1~180 사이 정수로 입력하세요')).toBeInTheDocument()
    expect(useApp.getState().settings.pomodoro.focusMin).toBe(25)

    await user.type(focusInput, '50')
    expect(useApp.getState().settings.pomodoro.focusMin).toBe(50)
    expect(screen.getByRole('timer')).toHaveAccessibleName(/남은 시간 50분/)

    await user.click(screen.getByLabelText('다음 세션 자동 시작'))
    await user.click(screen.getByLabelText('끝나면 알림음 재생'))
    expect(useApp.getState().settings.pomodoro).toMatchObject({ autoStart: true, sound: false })
  })
})
