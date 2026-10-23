import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'
import { useTable } from '../../hooks/data'
import { useApp } from '../../store/app'
import { useUI } from '../../store/ui'
import { makeTask } from '../../test/factories'
import { renderApp, resetApp } from '../../test/render'
import { useToasts } from '../../ui/toast'
import { TaskList } from '../tasks/TaskList'
import { useGlobalShortcuts } from './useGlobalShortcuts'

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(async () => {
  await resetApp()
  useToasts.setState({ toasts: [] })
})

afterEach(() => {
  vi.useRealTimers()
})

function Screen({ withDialog = false }: { withDialog?: boolean }) {
  useGlobalShortcuts()
  const { pathname } = useLocation()
  const tasks = useTable('tasks').filter((t) => t.deletedAt === null)
  return (
    <>
      <p data-testid="where">{pathname}</p>
      <input aria-label="메모" />
      {withDialog ? <dialog open aria-label="열린 대화상자" /> : null}
      <TaskList groups={[{ key: 'all', title: '', tasks }]} />
    </>
  )
}

function seed(...titles: string[]): void {
  const tasks = titles.map((title, i) => makeTask({ id: `t${i}`, title, order: i + 1 }))
  useApp.getState().commit({ puts: { tasks }, deletes: {} }, 'seed', { history: false })
}

const where = () => screen.getByTestId('where').textContent
const press = (init: KeyboardEventInit) => fireEvent.keyDown(document.body, init)
const status = (id: string) => useApp.getState().entities.tasks[id].status

describe('useGlobalShortcuts', () => {
  test('moves between screens with two-key sequences like G then I', async () => {
    const user = userEvent.setup()
    renderApp(<Screen />, '/today')

    await user.keyboard('gi')
    expect(where()).toBe('/inbox')

    await user.keyboard('gt')
    expect(where()).toBe('/today')
  })

  test('does not run letter shortcuts or change data while typing in an input', async () => {
    const user = userEvent.setup()
    seed('첫째')
    renderApp(<Screen />, '/today')
    const input = screen.getByRole('textbox', { name: '메모' })

    await user.click(input)
    useUI.setState({ focusedId: 't0' })
    await user.keyboard('egi')

    expect(status('t0')).toBe('todo')
    expect(where()).toBe('/today')
    expect(input).toHaveValue('egi')
  })

  test('leaves Ctrl+Z to the input and does not undo app data while typing', async () => {
    const user = userEvent.setup()
    seed('첫째')
    useApp.getState().commit({ puts: { tasks: [{ ...useApp.getState().entities.tasks.t0, title: '고친 제목' }] }, deletes: {} }, '제목 수정')
    renderApp(<Screen />, '/today')

    await user.click(screen.getByRole('textbox', { name: '메모' }))
    await user.keyboard('{Control>}z{/Control}')

    expect(useApp.getState().entities.tasks.t0.title).toBe('고친 제목')
    expect(useApp.getState().undoStack).toHaveLength(1)
  })

  test('undoes the last change with Ctrl+Z when focus is not in an input', async () => {
    const user = userEvent.setup()
    seed('첫째')
    useApp.getState().commit({ puts: { tasks: [{ ...useApp.getState().entities.tasks.t0, title: '고친 제목' }] }, deletes: {} }, '제목 수정')
    renderApp(<Screen />, '/today')

    await user.keyboard('{Control>}z{/Control}')

    expect(useApp.getState().entities.tasks.t0.title).toBe('첫째')
    expect(useToasts.getState().toasts.at(-1)?.message).toBe('되돌렸어요: 제목 수정')
  })

  test('blocks shortcuts while a dialog is open but still lets Ctrl+K open the palette', async () => {
    const user = userEvent.setup()
    renderApp(<Screen withDialog />, '/today')

    await user.keyboard('gi')
    expect(where()).toBe('/today')
    await user.keyboard('q')
    expect(useUI.getState().quickAdd.open).toBe(false)

    await user.keyboard('{Control>}k{/Control}')
    expect(useUI.getState().paletteOpen).toBe(true)
  })

  test('opens the palette with Ctrl+K even from inside an input', async () => {
    const user = userEvent.setup()
    renderApp(<Screen />, '/today')

    await user.click(screen.getByRole('textbox', { name: '메모' }))
    await user.keyboard('{Control>}k{/Control}')

    expect(useUI.getState().paletteOpen).toBe(true)
  })

  test('forgets a half-typed sequence after one second', () => {
    vi.useFakeTimers()
    renderApp(<Screen />, '/today')

    press({ key: 'g' })
    act(() => {
      vi.advanceTimersByTime(1001)
    })
    press({ key: 'i' })
    expect(where()).toBe('/today')

    press({ key: 'g' })
    act(() => {
      vi.advanceTimersByTime(900)
    })
    press({ key: 'i' })
    expect(where()).toBe('/inbox')
  })

  test('recognises shortcuts by physical key when a Korean keyboard layout is active', () => {
    renderApp(<Screen />, '/today')

    press({ key: 'ㅎ', code: 'KeyG' })
    press({ key: 'ㅑ', code: 'KeyI' })

    expect(where()).toBe('/inbox')
  })

  test('ignores keys while an IME composition is in progress', () => {
    renderApp(<Screen />, '/today')

    press({ key: 'g', isComposing: true })
    press({ key: 'i', isComposing: true })

    expect(where()).toBe('/today')
  })

  test('retries the last key on its own after a wrong sequence', async () => {
    const user = userEvent.setup()
    renderApp(<Screen />, '/today')

    await user.keyboard('gq')
    expect(useUI.getState().quickAdd.open).toBe(true)
  })

  test('keeps a repeated prefix alive so G G I still goes to the inbox', async () => {
    const user = userEvent.setup()
    renderApp(<Screen />, '/today')

    await user.keyboard('ggi')

    expect(where()).toBe('/inbox')
  })

  test('honours user-defined shortcuts and a cleared shortcut does nothing', async () => {
    const user = userEvent.setup()
    useApp.getState().updateSettings({ shortcuts: { 'go.inbox': 'z', 'go.today': '' } })
    renderApp(<Screen />, '/upcoming')

    await user.keyboard('z')
    expect(where()).toBe('/inbox')

    await user.keyboard('gt')
    expect(where()).toBe('/inbox')
  })

  test('remembers which task row has keyboard focus', async () => {
    const user = userEvent.setup()
    seed('첫째', '둘째')
    renderApp(<Screen />, '/today')

    await user.tab()
    await user.tab()

    const focusedRow = document.activeElement as HTMLElement
    expect(focusedRow.dataset.taskId).toBeDefined()
    expect(useUI.getState().focusedId).toBe(focusedRow.dataset.taskId)
  })

  test('stops listening once the screen unmounts', async () => {
    const user = userEvent.setup()
    const { unmount } = renderApp(<Screen />, '/today')
    unmount()

    await user.keyboard('q')

    expect(useUI.getState().quickAdd.open).toBe(false)
  })
})
