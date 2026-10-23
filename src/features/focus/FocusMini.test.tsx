import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useApp } from '../../store/app'
import { emptyEntityState } from '../../store/changes'
import { defaultSettings } from '../../store/defaults'
import { makeTask } from '../../test/factories'
import { FocusMini } from './FocusMini'
import { useFocus } from './focusStore'
import { createTimer } from './timer'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<FocusMini />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useFocus.setState({ timer: createTimer() })
  useApp.setState({ entities: emptyEntityState(), settings: defaultSettings() })
})

afterEach(() => {
  useFocus.setState({ timer: createTimer() })
})

describe('FocusMini', () => {
  test('renders nothing while the timer is idle', () => {
    const { container } = renderAt('/today')
    expect(container).toBeEmptyDOMElement()
  })

  test('shows the remaining time, session kind and linked task title while running', () => {
    useApp.getState().commit({ puts: { tasks: [makeTask({ id: 't1', title: '보고서 쓰기' })] }, deletes: {} }, '추가', {
      history: false,
    })
    useFocus.getState().setTask('t1')
    useFocus.getState().start()
    renderAt('/today')

    expect(screen.getByText(/^(25:00|24:5\d)$/)).toBeInTheDocument()
    expect(screen.getByText('집중')).toBeInTheDocument()
    expect(screen.getByText('보고서 쓰기')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /집중 화면으로 이동.*보고서 쓰기/ })).toHaveAttribute('href', '/focus')
  })

  test('labels an unlinked session', () => {
    useFocus.getState().start()
    renderAt('/today')
    expect(screen.getByText('이름 없는 세션')).toBeInTheDocument()
  })

  test('pause turns into resume, and stop clears the widget', async () => {
    const user = userEvent.setup()
    useFocus.getState().start()
    renderAt('/inbox')

    await user.click(screen.getByRole('button', { name: '일시정지' }))
    expect(useFocus.getState().timer.phase).toBe('paused')
    expect(screen.getByText(/일시정지/, { selector: '.focus-mini__kind' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '이어서 하기' }))
    expect(useFocus.getState().timer.phase).toBe('running')

    await user.click(screen.getByRole('button', { name: '중단' }))
    expect(useFocus.getState().timer.phase).toBe('idle')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  test('is hidden on the focus page itself', () => {
    useFocus.getState().start()
    const { container } = renderAt('/focus')
    expect(container).toBeEmptyDOMElement()
  })

  test('stopwatch counts up and offers a record-and-finish button', () => {
    useFocus.getState().setMode('stopwatch')
    useFocus.getState().start()
    renderAt('/today')
    expect(screen.getByText('스톱워치')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '끝내고 기록' })).toBeInTheDocument()
  })
})
