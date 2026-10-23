import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'
import { useApp } from '../../store/app'
import { useUI } from '../../store/ui'
import { makeLabel, makeProject, makeTask } from '../../test/factories'
import { renderApp, resetApp } from '../../test/render'
import { useTemplateActions } from '../templates'
import { CommandPalette } from './CommandPalette'

// jsdom은 <dialog>의 showModal을 구현하지 않는다.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open')
  }
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(async () => {
  await resetApp()
})

function Where() {
  const { pathname, search } = useLocation()
  return <p data-testid="where">{pathname + search}</p>
}

async function openPalette() {
  renderApp(
    <>
      <Where />
      <CommandPalette />
    </>,
    '/today',
  )
  useUI.getState().setPalette(true)
  return screen.findByRole('combobox', { name: '명령 또는 검색어 입력' })
}

const options = () => screen.getAllByRole('option').map((o) => o.textContent ?? '')

function seed(): void {
  useApp.getState().commit(
    {
      puts: {
        projects: [makeProject({ id: 'p1', name: '여행 계획' })],
        labels: [makeLabel({ id: 'l1', name: '여행준비' })],
        filters: [{ id: 'f1', name: '여행 급한 것', query: 'p1 & 여행', color: '#2f6f5e', favorite: false, order: 1 }],
        tasks: [
          makeTask({ id: 't1', title: '여행 가방 싸기', projectId: 'p1' }),
          makeTask({ id: 't2', title: '비행기 예약', description: '여행 일정 확인' }),
          makeTask({ id: 't3', title: '지운 여행 일', deletedAt: 1 }),
        ],
      },
      deletes: {},
    },
    'seed',
    { history: false },
  )
}

describe('CommandPalette', () => {
  test('shows the first commands when nothing is typed and no search groups', async () => {
    await openPalette()

    expect(screen.getAllByRole('option')).toHaveLength(12)
    expect(screen.queryByText('할 일', { selector: '.palette__group' })).not.toBeInTheDocument()
    expect(screen.queryByText(/작업으로 추가/)).not.toBeInTheDocument()
  })

  test('finds a command by typing and runs it with Enter', async () => {
    const user = userEvent.setup()
    const input = await openPalette()

    await user.type(input, '받은편지함')
    expect(options()[0]).toContain('받은편지함으로 이동')
    await user.keyboard('{Enter}')

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/inbox'))
    expect(useUI.getState().paletteOpen).toBe(false)
  })

  test('finds a command through its alias', async () => {
    const user = userEvent.setup()
    const input = await openPalette()

    await user.type(input, '도움말')

    expect(options()[0]).toContain('사용 가이드로 이동')
  })

  test('arrow keys move the highlighted entry before Enter runs it', async () => {
    const user = userEvent.setup()
    const input = await openPalette()
    await user.type(input, '가이드')

    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{ArrowDown}')
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{ArrowUp}{ArrowUp}')
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{ArrowDown}{Enter}')
    await waitFor(() => expect(useUI.getState().quickAdd).toMatchObject({ open: true, defaults: { text: '가이드' } }))
  })

  test('searches tasks, projects, labels and filters and opens the one that is clicked', async () => {
    seed()
    const user = userEvent.setup()
    const input = await openPalette()

    await user.type(input, '여행')

    const list = screen.getByRole('listbox')
    for (const group of ['할 일', '프로젝트', '라벨', '필터']) {
      expect(within(list).getByText(group, { selector: '.palette__group' })).toBeInTheDocument()
    }
    expect(screen.getByRole('option', { name: /^여행 가방 싸기/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /비행기 예약/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /지운 여행 일/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('option', { name: '여행 계획' }))
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/project/p1'))
  })

  test.each([
    ['^여행준비$', '/label/l1'],
    ['^여행 급한 것', '/filter/f1'],
    ['^여행 가방 싸기', '/search?q=%EC%97%AC%ED%96%89&task=t1'],
  ])('choosing %s navigates to %s', async (label, target) => {
    seed()
    const user = userEvent.setup()
    const input = await openPalette()
    await user.type(input, '여행')

    await user.click(screen.getByRole('option', { name: new RegExp(label) }))

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(target))
  })

  test('puts commands before the add-as-task entry and fills quick add with the typed text', async () => {
    const user = userEvent.setup()
    const input = await openPalette()

    await user.type(input, '작업')

    const labels = options()
    const addCommand = labels.findIndex((l) => l.includes('작업 추가'))
    const addAsTask = labels.findIndex((l) => l.includes('"작업" 작업으로 추가'))
    expect(addCommand).toBeGreaterThanOrEqual(0)
    expect(addAsTask).toBeGreaterThan(addCommand)

    await user.click(screen.getByRole('option', { name: /"작업" 작업으로 추가/ }))
    await waitFor(() => expect(useUI.getState().quickAdd).toMatchObject({ open: true, defaults: { text: '작업' } }))
  })

  test('offers a full search results page for the typed text', async () => {
    const user = userEvent.setup()
    const input = await openPalette()
    await user.type(input, '가방')

    await user.click(screen.getByRole('option', { name: /"가방" 전체 검색 결과 보기/ }))

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/search?q=%EA%B0%80%EB%B0%A9'))
  })

  test('creates tasks from a saved template picked in the palette', async () => {
    seed()
    useTemplateActions().saveTask('t1', '여행 점검표')
    const before = Object.keys(useApp.getState().entities.tasks).length
    const user = userEvent.setup()
    const input = await openPalette()

    await user.type(input, '점검표')
    await user.click(screen.getByRole('option', { name: /"여행 점검표" 템플릿으로 만들기/ }))

    await waitFor(() => expect(Object.keys(useApp.getState().entities.tasks)).toHaveLength(before + 1))
  })

  test('does not run anything on Enter while an IME composition is in progress', async () => {
    const input = await openPalette()
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, isComposing: true })
    input.dispatchEvent(event)

    expect(useUI.getState().paletteOpen).toBe(true)
    expect(screen.getByTestId('where')).toHaveTextContent('/today')
  })

  test('Escape closes the palette', async () => {
    await openPalette()
    const dialog = screen.getByRole('dialog', { name: '명령 팔레트' })

    fireEvent(dialog, new Event('cancel', { cancelable: true }))

    await waitFor(() => expect(useUI.getState().paletteOpen).toBe(false))
  })
})
