import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useApp } from '../../store/app'
import { useUI } from '../../store/ui'
import { renderApp, resetApp } from '../../test/render'
import { ShortcutsHelp } from './ShortcutsHelp'

// jsdom은 <dialog>의 showModal을 구현하지 않는다.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open')
  }
})

beforeEach(async () => {
  await resetApp()
})

describe('ShortcutsHelp', () => {
  test('lists the shortcuts under their group headings once opened', async () => {
    renderApp(<ShortcutsHelp />)
    expect(screen.queryByRole('heading', { name: '단축키' })).not.toBeInTheDocument()

    useUI.getState().setHelp(true)

    expect(await screen.findByRole('heading', { name: '단축키' })).toBeInTheDocument()
    for (const group of ['이동', '만들기', '할 일', '보기', '앱']) {
      expect(screen.getByRole('heading', { name: group })).toBeInTheDocument()
    }
    const goInbox = screen.getByText('받은편지함으로 이동').closest('div') as HTMLElement
    expect(within(goInbox).getByText('G I')).toBeInTheDocument()
  })

  test('shows a user-defined shortcut and hides a command whose shortcut was cleared', async () => {
    useApp.getState().updateSettings({ shortcuts: { 'go.inbox': 'z', 'go.today': '' } })
    renderApp(<ShortcutsHelp />)
    useUI.getState().setHelp(true)

    const goInbox = (await screen.findByText('받은편지함으로 이동')).closest('div') as HTMLElement
    expect(within(goInbox).getByText('Z')).toBeInTheDocument()
    expect(screen.queryByText('오늘로 이동')).not.toBeInTheDocument()
  })

  test('does not list commands that have no shortcut', async () => {
    renderApp(<ShortcutsHelp />)
    useUI.getState().setHelp(true)

    await screen.findByRole('heading', { name: '단축키' })
    expect(screen.queryByText('타임라인으로 이동')).not.toBeInTheDocument()
  })

  test('the close button closes the help', async () => {
    const user = userEvent.setup()
    renderApp(<ShortcutsHelp />)
    useUI.getState().setHelp(true)

    await user.click(await screen.findByRole('button', { name: '닫기' }))

    await waitFor(() => expect(useUI.getState().helpOpen).toBe(false))
  })

  test('Escape closes the help', async () => {
    renderApp(<ShortcutsHelp />)
    useUI.getState().setHelp(true)
    const dialog = await screen.findByRole('dialog', { name: '단축키 도움말' })

    fireEvent(dialog, new Event('cancel', { cancelable: true }))

    await waitFor(() => expect(useUI.getState().helpOpen).toBe(false))
  })
})
