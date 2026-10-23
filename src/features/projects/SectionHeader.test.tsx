import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useTable } from '../../hooks/data'
import { useApp } from '../../store/app'
import { makeSection } from '../../test/factories'
import { renderApp, resetApp } from '../../test/render'
import { SectionHeader } from './SectionHeader'

beforeEach(async () => {
  await resetApp()
})

const section = () => useApp.getState().entities.sections.s1

// 이름을 바꾸면 화면도 따라 바뀌어야 하므로, 스토어에서 섹션을 읽어 넘긴다.
function Harness({ count = 3 }: { count?: number }) {
  const current = useTable('sections').find((s) => s.id === 's1')
  return current ? <SectionHeader section={current} count={count} /> : <p>섹션이 지워졌어요</p>
}

function setup(overrides: Parameters<typeof makeSection>[0] = {}, count?: number) {
  useApp.getState().commit({ puts: { sections: [makeSection({ id: 's1', name: '이번 주', ...overrides })] }, deletes: {} }, 'seed', { history: false })
  renderApp(<Harness count={count} />)
}

const heading = () => screen.getByRole('heading', { level: 2 })
async function startRename(user: ReturnType<typeof userEvent.setup>) {
  await user.dblClick(heading())
  return screen.findByLabelText('섹션 이름')
}

describe('SectionHeader', () => {
  test('shows the name, how many tasks it holds and its status category', () => {
    setup({ category: 'active' }, 5)

    expect(heading()).toHaveTextContent('이번 주')
    expect(heading()).toHaveTextContent('5')
    expect(heading()).toHaveTextContent('진행 중')
  })

  describe('renaming', () => {
    test('double-clicking the title edits it and Enter saves the new name', async () => {
      const user = userEvent.setup()
      setup()

      const input = await startRename(user)
      expect(input).toHaveValue('이번 주')
      await user.clear(input)
      await user.type(input, '다음 주{Enter}')

      await waitFor(() => expect(section().name).toBe('다음 주'))
      expect(heading()).toHaveTextContent('다음 주')
      expect(screen.queryByLabelText('섹션 이름')).not.toBeInTheDocument()
    })

    test('leaving the field saves too', async () => {
      const user = userEvent.setup()
      setup()

      const input = await startRename(user)
      await user.clear(input)
      await user.type(input, '보류 중')
      await user.tab()

      await waitFor(() => expect(section().name).toBe('보류 중'))
    })

    test('Escape throws the edit away', async () => {
      const user = userEvent.setup()
      setup()

      const input = await startRename(user)
      await user.clear(input)
      await user.type(input, '버릴 이름')
      await user.keyboard('{Escape}')

      expect(section().name).toBe('이번 주')
      expect(heading()).toHaveTextContent('이번 주')
    })

    test('an emptied or unchanged name is not saved', async () => {
      const user = userEvent.setup()
      setup()

      const input = await startRename(user)
      await user.clear(input)
      await user.keyboard('{Enter}')
      expect(section().name).toBe('이번 주')
      expect(useApp.getState().undoStack).toHaveLength(0)

      await startRename(user)
      await user.keyboard('{Enter}')
      expect(useApp.getState().undoStack).toHaveLength(0)
    })

    test('ignores Enter while a Korean syllable is still composing', async () => {
      const user = userEvent.setup()
      setup()
      const input = await startRename(user)
      await user.clear(input)
      await user.type(input, '다음')

      fireEvent.keyDown(input, { key: 'Enter', isComposing: true })

      expect(screen.getByLabelText('섹션 이름')).toBeInTheDocument()
      expect(section().name).toBe('이번 주')
    })

    test('“이름 바꾸기” in the menu starts editing', async () => {
      const user = userEvent.setup()
      setup()

      await user.click(screen.getByRole('button', { name: '이번 주 섹션 메뉴' }))
      await user.click(await screen.findByRole('menuitem', { name: '이름 바꾸기' }))

      expect(await screen.findByLabelText('섹션 이름')).toHaveFocus()
    })
  })

  describe('menu', () => {
    const open = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(screen.getByRole('button', { name: '이번 주 섹션 메뉴' }))
      await screen.findByRole('menu')
    }

    test('sets the status category that tasks get when moved here', async () => {
      const user = userEvent.setup()
      setup()
      await open(user)

      await user.click(screen.getByRole('menuitem', { name: '이 섹션으로 옮기면 "진행 중"' }))

      expect(section().category).toBe('active')
      expect(heading()).toHaveTextContent('진행 중')
    })

    test('choosing the current category again clears it', async () => {
      const user = userEvent.setup()
      setup({ category: 'done' })
      await open(user)

      const current = screen.getByRole('menuitem', { name: '이 섹션으로 옮기면 "완료"' })
      expect(current).toHaveAttribute('data-selected', 'true')
      await user.click(current)

      expect(section().category).toBeNull()
    })

    test('deletes the section', async () => {
      const user = userEvent.setup()
      setup()
      await open(user)

      await user.click(screen.getByRole('menuitem', { name: '섹션 삭제 (할 일은 남겨요)' }))

      expect(section()).toBeUndefined()
      expect(screen.getByText('섹션이 지워졌어요')).toBeInTheDocument()
    })
  })
})
