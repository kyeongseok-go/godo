import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useApp } from '../../store/app'
import { makeTask } from '../../test/factories'
import { renderApp, resetApp } from '../../test/render'
import { DetailPanel } from './DetailPanel'

// 상세 패널 아래쪽 블록(하위 작업·설명·댓글·활동 기록)을 사용자가 쓰는 흐름

beforeEach(async () => {
  await resetApp()
})

const tasks = () => Object.values(useApp.getState().entities.tasks)
const stored = (id = 'a') => useApp.getState().entities.tasks[id]

function openPanel(...extra: ReturnType<typeof makeTask>[]) {
  useApp.getState().commit(
    { puts: { tasks: [makeTask({ id: 'a', title: '이사 준비' }), ...extra] }, deletes: {} },
    'seed',
    { history: false },
  )
  return renderApp(<DetailPanel />, '/inbox?task=a')
}

const subtasks = () => screen.getByRole('region', { name: '하위 작업' })
const comments = () => screen.getByRole('region', { name: '댓글' })

describe('subtasks', () => {
  test('adds a subtask under the open task with Enter and clears the field', async () => {
    const user = userEvent.setup()
    openPanel()

    const input = screen.getByLabelText('하위 작업 추가')
    await user.type(input, '박스 구하기{Enter}')

    const child = tasks().find((t) => t.title === '박스 구하기')
    expect(child).toMatchObject({ parentId: 'a', projectId: stored().projectId })
    expect(input).toHaveValue('')
    expect(within(subtasks()).getByRole('button', { name: '박스 구하기' })).toBeInTheDocument()
  })

  test('ignores blank input and Enter pressed while a Korean syllable is composing', async () => {
    const user = userEvent.setup()
    openPanel()
    const input = screen.getByLabelText('하위 작업 추가')

    await user.type(input, '   {Enter}')
    expect(tasks()).toHaveLength(1)
    await user.clear(input)
    await user.type(input, '이삿짐')
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })

    expect(tasks()).toHaveLength(1)
    expect(input).toHaveValue('이삿짐')
  })

  test('checking a subtask completes it and updates the progress count', async () => {
    const user = userEvent.setup()
    openPanel(
      makeTask({ id: 'c1', title: '박스', parentId: 'a', order: 1 }),
      makeTask({ id: 'c2', title: '테이프', parentId: 'a', order: 2 }),
    )
    expect(within(subtasks()).getByText('0/2')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: '"박스" 완료' }))
    await waitFor(() => expect(stored('c1').status).toBe('done'))
    expect(within(subtasks()).getByText('1/2')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: '"박스" 완료' }))
    await waitFor(() => expect(stored('c1').status).toBe('todo'))
  })

  test('opens a subtask in the panel when its title is clicked, and hides trashed ones', async () => {
    const user = userEvent.setup()
    openPanel(
      makeTask({ id: 'c1', title: '박스', parentId: 'a', order: 1 }),
      makeTask({ id: 'c2', title: '버린 일', parentId: 'a', order: 2, deletedAt: 1 }),
    )
    expect(screen.queryByText('버린 일')).not.toBeInTheDocument()

    await user.click(within(subtasks()).getByRole('button', { name: '박스' }))

    await waitFor(() => expect(screen.getByLabelText('제목')).toHaveValue('박스'))
  })
})

describe('description', () => {
  test('renders markdown and saves an edit with Cmd+Enter', async () => {
    const user = userEvent.setup()
    useApp.getState().commit({ puts: { tasks: [makeTask({ id: 'a', description: '- 가구 **해체**' })] }, deletes: {} }, 'seed', { history: false })
    renderApp(<DetailPanel />, '/inbox?task=a')
    expect(screen.getByText('해체').tagName).toBe('STRONG')

    await user.click(screen.getByTitle('눌러서 편집'))
    const editor = screen.getByLabelText('설명')
    expect(editor).toHaveValue('- 가구 **해체**')
    await user.type(editor, ' 끝')
    await user.keyboard('{Meta>}{Enter}{/Meta}')

    await waitFor(() => expect(stored().description).toBe('- 가구 **해체** 끝'))
    expect(screen.queryByLabelText('설명')).not.toBeInTheDocument()
  })

  test('Escape throws the edit away and leaves the saved text alone', async () => {
    const user = userEvent.setup()
    useApp.getState().commit({ puts: { tasks: [makeTask({ id: 'a', description: '원래 메모' })] }, deletes: {} }, 'seed', { history: false })
    renderApp(<DetailPanel />, '/inbox?task=a')

    await user.click(screen.getByTitle('눌러서 편집'))
    await user.type(screen.getByLabelText('설명'), ' 바꾼 내용')
    await user.keyboard('{Escape}')

    expect(screen.queryByLabelText('설명')).not.toBeInTheDocument()
    expect(stored().description).toBe('원래 메모')
    expect(stored().updatedAt).toBe(0)
    expect(screen.getByText('원래 메모')).toBeInTheDocument()
  })

  test('does not write anything when the text was not changed', async () => {
    const user = userEvent.setup()
    openPanel()

    await user.click(screen.getByRole('button', { name: /설명 추가/ }))
    await user.click(screen.getByLabelText('제목'))

    expect(stored().updatedAt).toBe(0)
  })
})

describe('comments', () => {
  test('posts a comment with the button, renders markdown and clears the box', async () => {
    const user = userEvent.setup()
    openPanel()
    const submit = screen.getByRole('button', { name: '댓글 등록' })
    expect(submit).toBeDisabled()

    await user.type(screen.getByLabelText('댓글 입력'), '이사 업체 **확정**')
    await user.click(submit)

    const saved = Object.values(useApp.getState().entities.comments)
    expect(saved).toMatchObject([{ taskId: 'a', body: '이사 업체 **확정**' }])
    expect(screen.getByLabelText('댓글 입력')).toHaveValue('')
    expect(within(comments()).getByText('확정').tagName).toBe('STRONG')
    expect(within(comments()).getByText('1')).toBeInTheDocument()
  })

  test('Cmd+Enter posts, while a plain Enter only adds a new line', async () => {
    const user = userEvent.setup()
    openPanel()
    const box = screen.getByLabelText('댓글 입력')

    await user.type(box, '첫 줄{Enter}둘째 줄')
    expect(Object.values(useApp.getState().entities.comments)).toHaveLength(0)

    await user.keyboard('{Meta>}{Enter}{/Meta}')
    expect(Object.values(useApp.getState().entities.comments)[0].body).toBe('첫 줄\n둘째 줄')
  })

  test('deleting a comment removes it and undo brings it back', async () => {
    const user = userEvent.setup()
    openPanel()
    await user.type(screen.getByLabelText('댓글 입력'), '지울 댓글')
    await user.click(screen.getByRole('button', { name: '댓글 등록' }))

    await user.click(screen.getByRole('button', { name: '댓글 삭제' }))
    expect(Object.values(useApp.getState().entities.comments)).toHaveLength(0)
    expect(within(comments()).queryByText('지울 댓글')).not.toBeInTheDocument()

    useApp.getState().undo()
    expect(await within(comments()).findByText('지울 댓글')).toBeInTheDocument()
  })

  test('only shows comments that belong to the open task, oldest first', () => {
    useApp.getState().commit(
      {
        puts: {
          tasks: [makeTask({ id: 'a' }), makeTask({ id: 'b' })],
          comments: [
            { id: 'c2', taskId: 'a', body: '나중 댓글', createdAt: 2000 },
            { id: 'c1', taskId: 'a', body: '먼저 댓글', createdAt: 1000 },
            { id: 'c3', taskId: 'b', body: '남의 댓글', createdAt: 1500 },
          ],
        },
        deletes: {},
      },
      'seed',
      { history: false },
    )
    renderApp(<DetailPanel />, '/inbox?task=a')

    const items = within(comments()).getAllByRole('listitem').map((li) => li.textContent ?? '')
    expect(items).toHaveLength(2)
    expect(items[0]).toContain('먼저 댓글')
    expect(items[1]).toContain('나중 댓글')
    expect(screen.queryByText('남의 댓글')).not.toBeInTheDocument()
  })
})

describe('activity log', () => {
  const log = (id: string, at: number, summary: string, taskId = 'a') => ({ id, taskId, type: 'updated' as const, summary, at })

  test('is hidden when the task has no history', () => {
    openPanel()
    expect(screen.queryByRole('region', { name: '활동 기록' })).not.toBeInTheDocument()
  })

  test('expands on click and lists the newest entry first', async () => {
    const user = userEvent.setup()
    useApp.getState().commit(
      {
        puts: {
          tasks: [makeTask({ id: 'a' })],
          activity: [log('x1', 1000, '처음 만듦'), log('x2', 3000, '제목 수정'), log('x3', 2000, '날짜 변경'), log('x4', 4000, '다른 일 기록', 'b')],
        },
        deletes: {},
      },
      'seed',
      { history: false },
    )
    renderApp(<DetailPanel />, '/inbox?task=a')
    const toggle = screen.getByRole('button', { name: /활동 기록/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('제목 수정')).not.toBeInTheDocument()

    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const region = screen.getByRole('region', { name: '활동 기록' })
    const rows = within(region).getAllByRole('listitem').map((li) => li.textContent ?? '')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toContain('제목 수정')
    expect(rows[2]).toContain('처음 만듦')
    expect(screen.queryByText('다른 일 기록')).not.toBeInTheDocument()

    await user.click(toggle)
    expect(screen.queryByText('제목 수정')).not.toBeInTheDocument()
  })

  test('shows at most the 30 most recent entries', async () => {
    const user = userEvent.setup()
    const many = Array.from({ length: 35 }, (_, i) => log(`m${i}`, i + 1, `기록 ${i}`))
    useApp.getState().commit({ puts: { tasks: [makeTask({ id: 'a' })], activity: many }, deletes: {} }, 'seed', { history: false })
    renderApp(<DetailPanel />, '/inbox?task=a')

    await user.click(screen.getByRole('button', { name: /활동 기록/ }))

    const region = screen.getByRole('region', { name: '활동 기록' })
    expect(within(region).getAllByRole('listitem')).toHaveLength(30)
    expect(within(region).getByText(/기록 34$/)).toBeInTheDocument()
    expect(within(region).queryByText(/기록 0$/)).not.toBeInTheDocument()
  })
})
