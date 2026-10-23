import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeTask } from '../../test/factories'
import { useApp } from '../../store/app'
import { renderApp, resetApp } from '../../test/render'
import { useUI } from '../../store/ui'
import { TaskList } from './TaskList'

beforeEach(async () => {
  await resetApp()
})

const group = (tasks: ReturnType<typeof makeTask>[]) => [{ key: 'all', title: '', tasks }]

describe('TaskList', () => {
  test('renders titles with their meta and shows the empty message when there is nothing', () => {
    const { unmount } = renderApp(<TaskList groups={group([makeTask({ id: 'a', title: '우유 사기', startDate: '2026-10-23' })])} />)
    expect(screen.getByText('우유 사기')).toBeInTheDocument()
    unmount()

    renderApp(<TaskList groups={group([])} empty="비었어요" />)
    expect(screen.getByText('비었어요')).toBeInTheDocument()
  })

  test('checking the box completes the task in the store', async () => {
    const user = userEvent.setup()
    const task = makeTask({ id: 'a', title: '할 일 A' })
    useApp.getState().commit({ puts: { tasks: [task] }, deletes: {} }, 'seed', { history: false })
    renderApp(<TaskList groups={group([task])} />)

    await user.click(screen.getByRole('checkbox', { name: '"할 일 A" 완료' }))

    await waitFor(() => expect(useApp.getState().entities.tasks.a.status).toBe('done'))
  })

  test('nests subtasks and collapses them with the chevron', async () => {
    const user = userEvent.setup()
    const parent = makeTask({ id: 'p', title: '부모', order: 1 })
    const child = makeTask({ id: 'c', title: '자식', parentId: 'p', order: 1 })
    renderApp(<TaskList groups={group([parent, child])} />)
    expect(screen.getByText('자식')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '하위 작업 접기' }))

    expect(screen.queryByText('자식')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '하위 작업 펼치기' }))
    expect(screen.getByText('자식')).toBeInTheDocument()
  })

  test('shows subtask progress on the parent', () => {
    const parent = makeTask({ id: 'p', title: '부모', order: 1 })
    const done = makeTask({ id: 'c1', parentId: 'p', status: 'done', order: 1 })
    const open = makeTask({ id: 'c2', parentId: 'p', order: 2 })
    renderApp(<TaskList groups={group([parent, done, open])} />)

    const row = screen.getByText('부모').closest('[data-task-id]') as HTMLElement
    expect(within(row).getByText('1/2')).toBeInTheDocument()
  })

  test('renders group headers with counts when there are several groups', () => {
    renderApp(
      <TaskList
        groups={[
          { key: 'a', title: '오전', tasks: [makeTask({ title: '가' })] },
          { key: 'b', title: '오후', tasks: [makeTask({ title: '나' }), makeTask({ title: '다' })] },
        ]}
      />,
    )

    expect(screen.getByRole('heading', { name: /오전/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /오후/ })).toHaveTextContent('2')
  })

  test('marks completed tasks and shows the sortable grip only when sortable', () => {
    const done = makeTask({ id: 'd', title: '끝낸 일', status: 'done' })
    const { unmount } = renderApp(<TaskList groups={group([done])} />)
    expect(screen.getByRole('checkbox', { name: /완료 취소/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('button', { name: '끌어서 순서 바꾸기' })).not.toBeInTheDocument()
    unmount()

    renderApp(<TaskList groups={group([makeTask({ title: '정렬 가능' })])} sortable />)
    expect(screen.getByRole('button', { name: '끌어서 순서 바꾸기' })).toBeInTheDocument()
  })

  describe('lingering completed rows', () => {
    // 열린 할 일만 보여주는 목록: 완료하면 groups 에서 사라지는 실제 화면과 같은 조건
    function OpenOnly() {
      const tasks = useApp((s) => s.entities.tasks)
      const open = Object.values(tasks).filter((t) => t.status !== 'done')
      return <TaskList groups={group(open)} />
    }

    test('keeps a just-completed row visible until it stops lingering', async () => {
      const user = userEvent.setup()
      const task = makeTask({ id: 'a', title: '방금 끝낸 일' })
      useApp.getState().commit({ puts: { tasks: [task, makeTask({ id: 'b', title: '남은 일' })] }, deletes: {} }, 'seed', { history: false })
      renderApp(<OpenOnly />)

      await user.click(screen.getByRole('checkbox', { name: '"방금 끝낸 일" 완료' }))

      await waitFor(() => expect(useApp.getState().entities.tasks.a.status).toBe('done'))
      expect(screen.getByText('방금 끝낸 일')).toBeInTheDocument()
      await waitFor(() => expect(Object.keys(useUI.getState().lingering)).toEqual(['a']))

      useUI.setState({ lingering: {} })

      await waitFor(() => expect(screen.queryByText('방금 끝낸 일')).not.toBeInTheDocument())
      expect(screen.getByText('남은 일')).toBeInTheDocument()
    })

    test('does not show a completed row that was never marked as lingering', () => {
      useApp.getState().commit({ puts: { tasks: [makeTask({ id: 'x', title: '이미 끝난 일' })] }, deletes: {} }, 'seed', { history: false })
      renderApp(<OpenOnly />)
      useApp.getState().commit({ puts: { tasks: [{ ...useApp.getState().entities.tasks.x, status: 'done' }] }, deletes: {} }, 'done', { history: false })

      return waitFor(() => expect(screen.queryByText('이미 끝난 일')).not.toBeInTheDocument())
    })
  })
})
