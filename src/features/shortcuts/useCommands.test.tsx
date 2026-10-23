import { act, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { addDays, todayOf } from '../../domain/date'
import { nextWeekStart } from '../../domain/calendarGrid'
import type { Task } from '../../domain/types'
import { useTable } from '../../hooks/data'
import { useApp } from '../../store/app'
import { useUI } from '../../store/ui'
import { makeTask } from '../../test/factories'
import { renderApp, resetApp } from '../../test/render'
import { useToasts } from '../../ui/toast'
import { SelectionBar } from '../tasks/SelectionBar'
import { TaskList } from '../tasks/TaskList'
import { effectiveKeys, useCommands } from './useCommands'
import { useGlobalShortcuts } from './useGlobalShortcuts'

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(async () => {
  await resetApp()
  useToasts.setState({ toasts: [] })
})

function Screen() {
  useGlobalShortcuts()
  const { pathname, search } = useLocation()
  const tasks = useTable('tasks').filter((t) => t.deletedAt === null)
  return (
    <>
      <p data-testid="where">{pathname + search}</p>
      <TaskList groups={[{ key: 'all', title: '', tasks }]} />
      <SelectionBar />
    </>
  )
}

function seed(...tasks: Partial<Task>[]): void {
  const made = tasks.map((t, i) => makeTask({ id: `t${i}`, title: `할 일 ${i}`, order: i + 1, ...t }))
  useApp.getState().commit({ puts: { tasks: made }, deletes: {} }, 'seed', { history: false })
}

const task = (id: string) => useApp.getState().entities.tasks[id]
const row = (title: string) => screen.getByText(title).closest('[data-task-id]') as HTMLElement
const lastToast = () => useToasts.getState().toasts.at(-1)?.message
const today = () => todayOf(new Date(), 0)

describe('useCommands through the keyboard', () => {
  test('E completes the focused task and reopens it when pressed again', async () => {
    const user = userEvent.setup()
    seed({})
    renderApp(<Screen />)

    row('할 일 0').focus()
    await user.keyboard('e')
    await waitFor(() => expect(task('t0').status).toBe('done'))

    await user.keyboard('e')
    await waitFor(() => expect(task('t0').status).toBe('todo'))
  })

  test('shows a hint toast instead of acting when no task is focused', async () => {
    const user = userEvent.setup()
    seed({})
    renderApp(<Screen />)

    await user.keyboard('e')

    expect(task('t0').status).toBe('todo')
    expect(lastToast()).toBe('먼저 할 일을 선택해 주세요 (J/K로 이동)')
  })

  test('S T, S M, S W and S X set today, tomorrow, next week and clear the date', async () => {
    const user = userEvent.setup()
    seed({ startDate: '2020-01-01', startTime: '09:30' })
    renderApp(<Screen />)
    row('할 일 0').focus()

    await user.keyboard('st')
    expect(task('t0').startDate).toBe(today())

    await user.keyboard('sm')
    expect(task('t0').startDate).toBe(addDays(today(), 1))

    await user.keyboard('sw')
    expect(task('t0').startDate).toBe(nextWeekStart(today(), useApp.getState().settings.weekStartsOn))

    await user.keyboard('sx')
    expect(task('t0')).toMatchObject({ startDate: null, startTime: null })
  })

  test('Y 1 to Y 4 change the priority of the focused task', async () => {
    const user = userEvent.setup()
    seed({})
    renderApp(<Screen />)
    row('할 일 0').focus()

    await user.keyboard('y1')
    expect(task('t0').priority).toBe(1)
    await user.keyboard('y3')
    expect(task('t0').priority).toBe(3)
    await user.keyboard('y4')
    expect(task('t0').priority).toBe(4)
  })

  test('Ctrl+] makes the task a subtask of the one above and Ctrl+[ brings it back', async () => {
    const user = userEvent.setup()
    seed({}, {})
    renderApp(<Screen />)
    row('할 일 1').focus()

    await user.keyboard('{Control>}]{/Control}')
    await waitFor(() => expect(task('t1').parentId).toBe('t0'))

    row('할 일 1').focus()
    await user.keyboard('{Control>}[[{/Control}')
    await waitFor(() => expect(task('t1').parentId).toBeNull())
  })

  test('P pins, X selects, Ctrl+D duplicates the focused task', async () => {
    const user = userEvent.setup()
    seed({})
    renderApp(<Screen />)
    row('할 일 0').focus()

    await user.keyboard('p')
    expect(task('t0').pinned).toBe(true)

    await user.keyboard('x')
    expect(useUI.getState().selectedIds).toEqual(['t0'])

    await user.keyboard('{Control>}d{/Control}')
    await waitFor(() => expect(Object.keys(useApp.getState().entities.tasks)).toHaveLength(2))
  })

  test('Ctrl+Backspace deletes only the focused row when it is not part of the selection', async () => {
    const user = userEvent.setup()
    seed({}, {}, {})
    useUI.setState({ selectedIds: ['t0', 't1'] })
    renderApp(<Screen />)

    row('할 일 2').focus()
    await user.keyboard('{Control>}{Backspace}{/Control}')

    await waitFor(() => expect(task('t2').deletedAt).not.toBeNull())
    expect(task('t0').deletedAt).toBeNull()
    expect(task('t1').deletedAt).toBeNull()
  })

  test('Ctrl+Backspace deletes the whole selection when the focused row belongs to it', async () => {
    const user = userEvent.setup()
    seed({}, {}, {})
    useUI.setState({ selectedIds: ['t0', 't1'] })
    renderApp(<Screen />)

    row('할 일 0').focus()
    await user.keyboard('{Control>}{Backspace}{/Control}')

    await waitFor(() => expect(task('t0').deletedAt).not.toBeNull())
    expect(task('t1').deletedAt).not.toBeNull()
    expect(task('t2').deletedAt).toBeNull()
    expect(lastToast()).toBe('2개를 휴지통으로 옮겼어요')
  })

  test('deleting the selection with the shortcut also clears it, so no bar is left for tasks in the trash', async () => {
    const user = userEvent.setup()
    seed({}, {}, {})
    useUI.setState({ selectedIds: ['t0', 't1'] })
    renderApp(<Screen />)
    expect(screen.getByRole('toolbar', { name: '선택한 할 일 작업' })).toBeInTheDocument()

    row('할 일 0').focus()
    await user.keyboard('{Control>}{Backspace}{/Control}')

    await waitFor(() => expect(task('t0').deletedAt).not.toBeNull())
    expect(useUI.getState().selectedIds).toEqual([])
    expect(screen.queryByRole('toolbar', { name: '선택한 할 일 작업' })).not.toBeInTheDocument()
  })

  test('J and K move keyboard focus down and up the task rows', async () => {
    const user = userEvent.setup()
    seed({}, {}, {})
    renderApp(<Screen />)

    await user.keyboard('j')
    expect(document.activeElement).toBe(row('할 일 0'))
    await user.keyboard('j')
    expect(document.activeElement).toBe(row('할 일 1'))
    await user.keyboard('k')
    expect(document.activeElement).toBe(row('할 일 0'))
    await user.keyboard('k')
    expect(document.activeElement).toBe(row('할 일 0'))
  })

  test('Shift+A opens quick add for a subtask of the focused task', async () => {
    const user = userEvent.setup()
    seed({ projectId: 'inbox' })
    renderApp(<Screen />)
    row('할 일 0').focus()

    await user.keyboard('{Shift>}a{/Shift}')

    expect(useUI.getState().quickAdd).toMatchObject({ open: true, defaults: { parentId: 't0', projectId: 'inbox' } })
  })

  test('Q, question mark and M open quick add, help and the sidebar', async () => {
    const user = userEvent.setup()
    renderApp(<Screen />)

    await user.keyboard('q')
    expect(useUI.getState().quickAdd.open).toBe(true)
    await user.keyboard('?')
    expect(useUI.getState().helpOpen).toBe(true)
    await user.keyboard('m')
    expect(useUI.getState().sidebarOpen).toBe(true)
  })

  test('Ctrl+Shift+Z redoes what Ctrl+Z undid', async () => {
    const user = userEvent.setup()
    seed({})
    useApp.getState().commit({ puts: { tasks: [{ ...task('t0'), title: '고침' }] }, deletes: {} }, '제목 수정')
    renderApp(<Screen />)

    await user.keyboard('{Control>}z{/Control}')
    expect(task('t0').title).toBe('할 일 0')
    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')

    expect(task('t0').title).toBe('고침')
    expect(lastToast()).toBe('다시 실행했어요: 제목 수정')
  })

  test('V K switches a project to the board view and says so when not on a project', async () => {
    const user = userEvent.setup()
    const first = renderApp(<Screen />, '/project/p1')

    await user.keyboard('vk')
    expect(screen.getByTestId('where')).toHaveTextContent('/project/p1?view=board')
    first.unmount()

    renderApp(<Screen />, '/inbox')
    await user.keyboard('vk')
    expect(lastToast()).toBe('프로젝트 화면에서 쓸 수 있어요')
  })
})

describe('useCommands list', () => {
  const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>

  test('cycles the theme auto, light, dark and back to auto', () => {
    const { result } = renderHook(() => useCommands(), { wrapper })
    const theme = () => result.current.find((c) => c.id === 'app.theme')!

    act(() => theme().run())
    expect(useApp.getState().settings.theme).toBe('light')
    act(() => theme().run())
    expect(useApp.getState().settings.theme).toBe('dark')
    act(() => theme().run())
    expect(useApp.getState().settings.theme).toBe('auto')
  })

  test('add commands open the matching entity dialog', () => {
    const { result } = renderHook(() => useCommands(), { wrapper })
    const run = (id: string) => act(() => result.current.find((c) => c.id === id)!.run())

    run('add.project')
    expect(useUI.getState().entityDialog).toEqual({ kind: 'project' })
    run('add.label')
    expect(useUI.getState().entityDialog).toEqual({ kind: 'label' })
    run('add.filter')
    expect(useUI.getState().entityDialog).toEqual({ kind: 'filter' })
  })

  test('every shortcut key is unique and effectiveKeys honours user overrides', () => {
    const { result } = renderHook(() => useCommands(), { wrapper })
    const keys = result.current.flatMap((c) => (c.keys ? [c.keys] : []))
    expect(new Set(keys).size).toBe(keys.length)

    const inbox = result.current.find((c) => c.id === 'go.inbox')!
    expect(effectiveKeys(inbox, {})).toBe('g i')
    expect(effectiveKeys(inbox, { 'go.inbox': 'z' })).toBe('z')
    expect(effectiveKeys(inbox, { 'go.inbox': '' })).toBeUndefined()
  })
})
