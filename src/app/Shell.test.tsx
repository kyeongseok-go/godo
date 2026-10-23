import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { useUI } from '../store/ui'
import { renderApp, resetApp } from '../test/render'
import { useToasts } from '../ui/toast'
import { Shell } from './Shell'

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
  useToasts.setState({ toasts: [] })
})

function Page() {
  const { pathname } = useLocation()
  return <h1>화면 {pathname}</h1>
}

function renderShell(route = '/inbox') {
  return renderApp(
    <Routes>
      <Route element={<Shell />}>
        <Route path="*" element={<Page />} />
      </Route>
    </Routes>,
    route,
  )
}

const sidebar = () => screen.getByRole('navigation', { name: '주 메뉴' })

describe('Shell', () => {
  test('renders the current page inside the main landmark', () => {
    renderShell('/inbox')

    expect(within(screen.getByRole('main')).getByRole('heading', { name: '화면 /inbox' })).toBeInTheDocument()
  })

  test('clears the selection when the user moves to another screen', async () => {
    const user = userEvent.setup()
    renderShell('/inbox')
    useUI.setState({ selectedIds: ['a', 'b'] })

    await user.click(within(sidebar()).getByRole('link', { name: /^휴지통/ }))

    await waitFor(() => expect(useUI.getState().selectedIds).toEqual([]))
    expect(screen.getByRole('heading', { name: '화면 /trash' })).toBeInTheDocument()
  })

  test('keeps the selection while staying on the same screen', async () => {
    const user = userEvent.setup()
    renderShell('/inbox')
    useUI.setState({ selectedIds: ['a'] })

    await user.click(within(sidebar()).getByRole('link', { name: /^받은편지함/ }))

    expect(useUI.getState().selectedIds).toEqual(['a'])
  })

  test('the tab bar opens quick add, navigates, and opens and closes the menu', async () => {
    const user = userEvent.setup()
    renderShell('/inbox')
    const tabbar = screen.getByRole('navigation', { name: '빠른 이동' })

    await user.click(within(tabbar).getByRole('button', { name: '작업 추가' }))
    expect(useUI.getState().quickAdd.open).toBe(true)

    await user.click(within(tabbar).getByRole('link', { name: '다음 7일' }))
    expect(screen.getByRole('heading', { name: '화면 /upcoming' })).toBeInTheDocument()

    await user.click(within(tabbar).getByRole('button', { name: '메뉴' }))
    expect(useUI.getState().sidebarOpen).toBe(true)
    await user.click(screen.getByRole('button', { name: '메뉴 닫기', hidden: true }))
    expect(useUI.getState().sidebarOpen).toBe(false)
  })

  test('the skip link moves focus to the main content', async () => {
    const user = userEvent.setup()
    renderShell('/inbox')

    await user.click(screen.getByRole('button', { name: '본문으로 건너뛰기' }))

    expect(screen.getByRole('main')).toHaveFocus()
  })

  test('keyboard shortcuts work anywhere inside the shell', async () => {
    const user = userEvent.setup()
    renderShell('/inbox')

    await user.keyboard('gt')

    expect(screen.getByRole('heading', { name: '화면 /today' })).toBeInTheDocument()
  })

  test('mounts the global dialogs so Ctrl+K opens the palette', async () => {
    const user = userEvent.setup()
    renderShell('/inbox')

    await user.keyboard('{Control>}k{/Control}')

    expect(await screen.findByRole('combobox', { name: '명령 또는 검색어 입력' })).toBeInTheDocument()
  })
})
