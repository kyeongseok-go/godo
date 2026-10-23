import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'
import { useApp } from '../../store/app'
import { useUI } from '../../store/ui'
import type { EntityDialogTarget } from '../../store/ui'
import { useToasts } from '../../ui/toast'
import { makeLabel, makeProject, makeTask } from '../../test/factories'
import { installModalDialogFocusShim } from '../../test/focusShim'
import { renderApp, resetApp } from '../../test/render'
import { EntityDialogs } from './EntityDialogs'

// jsdom은 <dialog>의 showModal을 구현하지 않는다. 브라우저의 포커스 규칙까지 흉내 내는 셔임을 쓴다.
installModalDialogFocusShim()

beforeEach(async () => {
  await resetApp()
  useToasts.setState({ toasts: [] })
})

const entities = () => useApp.getState().entities
const seed = (puts: Parameters<ReturnType<typeof useApp.getState>['commit']>[0]['puts']) =>
  useApp.getState().commit({ puts, deletes: {} }, 'seed', { history: false })

function Where() {
  const { pathname } = useLocation()
  return <output aria-label="현재 경로">{pathname}</output>
}
const path = () => screen.getByLabelText('현재 경로').textContent

function openDialog(target: EntityDialogTarget) {
  renderApp(
    <>
      <EntityDialogs />
      <Where />
    </>,
  )
  act(() => useUI.getState().openEntityDialog(target))
}

const nameField = () => screen.findByLabelText('이름')
const submitButton = (name: '추가' | '저장') => screen.getByRole('button', { name })

describe.each([
  ['project', { kind: 'project' } as EntityDialogTarget],
  ['label', { kind: 'label' } as EntityDialogTarget],
  ['filter', { kind: 'filter' } as EntityDialogTarget],
])('%s dialog focus', (_kind, target) => {
  test('starts with the keyboard in the name field instead of the close button', async () => {
    openDialog(target)

    expect(await nameField()).toHaveFocus()
  })
})

describe('project dialog', () => {
  test('cannot be submitted without a name', async () => {
    openDialog({ kind: 'project' })
    await nameField()

    expect(submitButton('추가')).toBeDisabled()
  })

  test('creates a project and goes to it', async () => {
    const user = userEvent.setup()
    openDialog({ kind: 'project' })

    await user.type(await nameField(), '  사이드 프로젝트 ')
    await user.click(screen.getByRole('radio', { name: '#2b4c7e' }))
    await user.selectOptions(screen.getByLabelText('기본 보기'), '칸반')
    await user.click(screen.getByRole('checkbox', { name: '즐겨찾기' }))
    await user.click(submitButton('추가'))

    const created = Object.values(entities().projects).find((p) => p.name === '사이드 프로젝트')
    expect(created).toMatchObject({ color: '#2b4c7e', defaultView: 'board', favorite: true, isFolder: false, parentId: null })
    expect(path()).toBe(`/project/${created?.id}`)
    await waitFor(() => expect(useUI.getState().entityDialog).toBeNull())
  })

  test('a folder is created without navigating, and can then hold other projects', async () => {
    const user = userEvent.setup()
    openDialog({ kind: 'project' })
    await user.type(await nameField(), '회사')
    await user.click(screen.getByRole('checkbox', { name: /폴더로 만들기/ }))
    await user.click(submitButton('추가'))

    const folder = Object.values(entities().projects).find((p) => p.name === '회사')
    expect(folder?.isFolder).toBe(true)
    expect(path()).toBe('/inbox')

    act(() => useUI.getState().openEntityDialog({ kind: 'project', parentId: folder?.id }))
    await waitFor(() => expect(screen.getByLabelText('상위 폴더')).toHaveValue(folder?.id))
  })

  test('submitting with Enter works and the cancel button leaves everything untouched', async () => {
    const user = userEvent.setup()
    openDialog({ kind: 'project' })
    await user.type(await nameField(), '엔터로 만들기{Enter}')
    await waitFor(() => expect(Object.values(entities().projects).some((p) => p.name === '엔터로 만들기')).toBe(true))

    const before = Object.keys(entities().projects).length
    act(() => useUI.getState().openEntityDialog({ kind: 'project' }))
    await user.type(await nameField(), '만들다 말 것')
    await user.click(screen.getByRole('button', { name: '취소' }))

    expect(Object.keys(entities().projects)).toHaveLength(before)
    await waitFor(() => expect(useUI.getState().entityDialog).toBeNull())
  })

  describe('editing', () => {
    beforeEach(() => {
      seed({
        projects: [
          makeProject({ id: 'f', name: '회사', isFolder: true }),
          makeProject({ id: 'g', name: '하위 폴더', isFolder: true, parentId: 'f' }),
          makeProject({ id: 'w', name: '업무', color: '#15803d' }),
        ],
        tasks: [makeTask({ id: 't1', projectId: 'w', title: '업무 할 일' })],
      })
    })

    test('starts from the saved values and saves the changes', async () => {
      const user = userEvent.setup()
      openDialog({ kind: 'project', id: 'w' })

      const name = await nameField()
      expect(name).toHaveValue('업무')
      expect(screen.getByRole('radio', { name: '#15803d' })).toHaveAttribute('aria-checked', 'true')

      await user.clear(name)
      await user.type(name, '프로젝트 A')
      await user.selectOptions(screen.getByLabelText('상위 폴더'), '회사')
      await user.click(screen.getByRole('checkbox', { name: '즐겨찾기' }))
      await user.click(submitButton('저장'))

      expect(entities().projects.w).toMatchObject({ name: '프로젝트 A', parentId: 'f', favorite: true })
      await waitFor(() => expect(useUI.getState().entityDialog).toBeNull())
    })

    test('a folder cannot be moved into itself or into its own sub-folder', async () => {
      openDialog({ kind: 'project', id: 'f' })
      const parent = await screen.findByLabelText('상위 폴더')

      expect(within(parent).getAllByRole('option').map((o) => o.textContent)).toEqual(['없음'])
    })

    test('deleting sends its tasks to the trash, offers undo and goes back to the inbox', async () => {
      const user = userEvent.setup()
      openDialog({ kind: 'project', id: 'w' })

      await user.click(await screen.findByRole('button', { name: /삭제/ }))

      expect(entities().projects.w.deletedAt).not.toBeNull()
      expect(entities().tasks.t1.deletedAt).not.toBeNull()
      expect(path()).toBe('/inbox')
      const toast = useToasts.getState().toasts.at(-1)
      expect(toast?.actionLabel).toBe('되돌리기')

      act(() => toast?.onAction?.())
      expect(entities().projects.w.deletedAt).toBeNull()
    })

    test('the inbox can be renamed but never deleted', async () => {
      openDialog({ kind: 'project', id: 'inbox' })

      await nameField()
      expect(screen.queryByRole('button', { name: /삭제/ })).not.toBeInTheDocument()
    })
  })

  test('the close button dismisses the dialog', async () => {
    const user = userEvent.setup()
    openDialog({ kind: 'project' })
    await nameField()

    await user.click(screen.getByRole('button', { name: '닫기' }))

    expect(useUI.getState().entityDialog).toBeNull()
  })
})

describe('label dialog', () => {
  test('creates a label and drops a leading @ or #', async () => {
    const user = userEvent.setup()
    openDialog({ kind: 'label' })

    await user.type(await nameField(), '#집중필요')
    await user.click(submitButton('추가'))

    expect(Object.values(entities().labels).map((l) => l.name)).toEqual(['집중필요'])
    await waitFor(() => expect(useUI.getState().entityDialog).toBeNull())
  })

  test('refuses a name that already exists, ignoring case and the prefix', async () => {
    const user = userEvent.setup()
    seed({ labels: [makeLabel({ id: 'l1', name: 'Focus' })] })
    openDialog({ kind: 'label' })

    await user.type(await nameField(), '@focus')

    expect(screen.getByText('같은 이름의 라벨이 있어요')).toBeInTheDocument()
    expect(submitButton('추가')).toBeDisabled()
    await user.keyboard('{Enter}')
    expect(Object.values(entities().labels)).toHaveLength(1)

    await user.clear(screen.getByLabelText('이름'))
    await user.type(screen.getByLabelText('이름'), '다른 이름')
    expect(screen.queryByText('같은 이름의 라벨이 있어요')).not.toBeInTheDocument()
    expect(submitButton('추가')).toBeEnabled()
  })

  test('editing keeps the own name valid and saves a new color', async () => {
    const user = userEvent.setup()
    seed({ labels: [makeLabel({ id: 'l1', name: '집중', color: '#15803d' }), makeLabel({ id: 'l2', name: '급함' })] })
    openDialog({ kind: 'label', id: 'l1' })

    expect(await nameField()).toHaveValue('집중')
    expect(screen.queryByText('같은 이름의 라벨이 있어요')).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: '#b45309' }))
    await user.click(submitButton('저장'))

    expect(entities().labels.l1).toMatchObject({ name: '집중', color: '#b45309' })
  })

  test('deleting a label also removes it from the tasks that had it', async () => {
    const user = userEvent.setup()
    seed({ labels: [makeLabel({ id: 'l1', name: '집중' })], tasks: [makeTask({ id: 't1', labelIds: ['l1'] })] })
    openDialog({ kind: 'label', id: 'l1' })

    await user.click(await screen.findByRole('button', { name: /삭제/ }))

    expect(entities().labels.l1).toBeUndefined()
    expect(entities().tasks.t1.labelIds).toEqual([])
    expect(path()).toBe('/inbox')
  })
})

describe('filter dialog', () => {
  beforeEach(() => {
    seed({
      tasks: [
        makeTask({ id: 't1', title: '급한 일', priority: 1 }),
        makeTask({ id: 't2', title: '또 급한 일', priority: 1 }),
        makeTask({ id: 't3', title: '여유 있는 일', priority: 3 }),
      ],
    })
  })

  const condition = () => screen.findByLabelText('조건')

  test('explains the syntax until something is typed', async () => {
    openDialog({ kind: 'filter' })
    await condition()

    expect(screen.getByText('조건 문법 보기')).toBeInTheDocument()
    expect(submitButton('추가')).toBeDisabled()
  })

  test('previews how many tasks the condition matches', async () => {
    const user = userEvent.setup()
    openDialog({ kind: 'filter' })

    await user.type(await condition(), 'p1')

    expect(await screen.findByText(/2개/)).toBeInTheDocument()
    expect(screen.queryByText('조건 문법 보기')).not.toBeInTheDocument()
  })

  test('shows where an invalid condition went wrong and blocks saving', async () => {
    const user = userEvent.setup()
    openDialog({ kind: 'filter' })
    await user.type(await screen.findByLabelText('이름'), '깨진 필터')

    await user.type(await condition(), '(p1 &')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/위치 \d+/)
    expect(submitButton('추가')).toBeDisabled()
    expect(screen.queryByText(/개가 해당돼요/)).not.toBeInTheDocument()
  })

  test('saves a filter and opens its page', async () => {
    const user = userEvent.setup()
    openDialog({ kind: 'filter' })

    await user.type(await nameField(), '  급한 것 ')
    await user.type(await condition(), ' p1 ')
    await user.click(submitButton('추가'))

    const [filter] = Object.values(entities().filters)
    expect(filter).toMatchObject({ name: '급한 것', query: 'p1' })
    expect(path()).toBe(`/filter/${filter.id}`)
  })

  test('opens with a condition that the caller filled in', async () => {
    openDialog({ kind: 'filter', query: 'p3' })

    expect(await condition()).toHaveValue('p3')
    expect(await screen.findByText(/1개/)).toBeInTheDocument()
  })

  test('edits an existing filter in place and deletes it', async () => {
    const user = userEvent.setup()
    seed({ filters: [{ id: 'f1', name: '급한 것', query: 'p1', color: '#c8360f', favorite: false, order: 1 }] })
    openDialog({ kind: 'filter', id: 'f1' })

    const name = await nameField()
    expect(name).toHaveValue('급한 것')
    await user.clear(name)
    await user.type(name, '아주 급한 것')
    await user.click(submitButton('저장'))
    expect(entities().filters.f1).toMatchObject({ name: '아주 급한 것', query: 'p1' })

    act(() => useUI.getState().openEntityDialog({ kind: 'filter', id: 'f1' }))
    await user.click(await screen.findByRole('button', { name: /삭제/ }))
    expect(entities().filters.f1).toBeUndefined()
    expect(path()).toBe('/inbox')
  })
})
