import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useApp } from '../../store/app'
import { resetApp } from '../../test/render'
import { polyfillDialog, renderInRouter } from './testKit'
import { ShortcutsTab } from './ShortcutsTab'

beforeAll(polyfillDialog)

beforeEach(async () => {
  await resetApp()
})

const shortcuts = () => useApp.getState().settings.shortcuts
const keyButton = (title: string) => screen.getByRole('button', { name: new RegExp(`^${title} 단축키 바꾸기`) })

describe('ShortcutsTab', () => {
  test('lists every command grouped in tables with its current key', () => {
    renderInRouter(<ShortcutsTab />)

    expect(screen.getAllByRole('table').length).toBeGreaterThanOrEqual(5)
    expect(keyButton('작업 추가')).toHaveAccessibleName('작업 추가 단축키 바꾸기. 지금은 Q')
    expect(keyButton('받은편지함으로 이동')).toHaveAccessibleName(/지금은 G I/)
  })

  test('captures a two-key sequence by pressing the keys', async () => {
    const user = userEvent.setup()
    renderInRouter(<ShortcutsTab />)

    await user.click(keyButton('프로젝트 추가'))
    expect(screen.getByText('키를 누르세요')).toBeInTheDocument()
    await user.keyboard('zy')

    expect(shortcuts()).toEqual({ 'add.project': 'z y' })
    expect(keyButton('프로젝트 추가')).toHaveAccessibleName(/지금은 Z Y/)
  })

  test('captures a modifier chord immediately', async () => {
    const user = userEvent.setup()
    renderInRouter(<ShortcutsTab />)

    await user.click(keyButton('프로젝트 추가'))
    await user.keyboard('{Control>}j{/Control}')

    expect(shortcuts()['add.project']).toBe('mod+j')
  })

  test('commits a single plain key after the sequence wait', async () => {
    const user = userEvent.setup()
    renderInRouter(<ShortcutsTab />)

    await user.click(keyButton('프로젝트 추가'))
    await user.keyboard('w')

    await waitFor(() => expect(shortcuts()['add.project']).toBe('w'), { timeout: 2500 })
  })

  test('cancels with Escape and leaves the shortcut unchanged', async () => {
    const user = userEvent.setup()
    renderInRouter(<ShortcutsTab />)

    await user.click(keyButton('작업 추가'))
    await user.keyboard('{Escape}')

    expect(shortcuts()).toEqual({})
    expect(screen.queryByText('키를 누르세요')).not.toBeInTheDocument()
  })

  test('does not run global shortcuts while capturing', async () => {
    const user = userEvent.setup()
    renderInRouter(<ShortcutsTab />)

    await user.click(keyButton('프로젝트 추가'))
    await user.keyboard('gi')

    expect(shortcuts()).toEqual({ 'add.project': 'g i' })
    expect(screen.getByTestId('location')).toHaveTextContent('/settings/general')
  })

  test('warns about a duplicate key but still saves it', async () => {
    const user = userEvent.setup()
    renderInRouter(<ShortcutsTab />)

    await user.click(keyButton('라벨 추가'))
    await user.keyboard('q')

    // q 는 이미 "작업 추가"가 쓴다
    await waitFor(() => expect(shortcuts()['add.label']).toBe('q'), { timeout: 2500 })
    const row = screen.getByRole('row', { name: /^라벨 추가/ })
    expect(within(row).getByText(/같은 키를 쓰는 명령이 있어요.*작업 추가/)).toBeInTheDocument()
    const other = screen.getByRole('row', { name: /^작업 추가/ })
    expect(within(other).getByText(/같은 키를 쓰는 명령이 있어요.*라벨 추가/)).toBeInTheDocument()
  })

  test('warns when a single key hides a sequence that starts with it', async () => {
    const user = userEvent.setup()
    renderInRouter(<ShortcutsTab />)

    await user.click(keyButton('프로젝트 추가'))
    await user.keyboard('g')

    await waitFor(() => expect(shortcuts()['add.project']).toBe('g'), { timeout: 2500 })
    expect(within(screen.getByRole('row', { name: /^프로젝트 추가/ })).getByText(/먼저 실행돼서/)).toBeInTheDocument()
  })

  test('turns a default shortcut off with an empty string and offers a reset', async () => {
    const user = userEvent.setup()
    renderInRouter(<ShortcutsTab />)

    await user.click(screen.getByRole('button', { name: '오늘로 이동 단축키 비우기' }))

    expect(shortcuts()).toEqual({ 'go.today': '' })
    expect(keyButton('오늘로 이동')).toHaveAccessibleName(/지금은 없음/)

    await user.click(screen.getByRole('button', { name: '오늘로 이동 단축키를 기본값으로' }))
    expect(shortcuts()).toEqual({})
  })

  test('resets everything after confirmation', async () => {
    const user = userEvent.setup()
    useApp.getState().updateSettings({ shortcuts: { 'go.today': 'x', 'add.project': 'p' } })
    renderInRouter(<ShortcutsTab />)

    await user.click(screen.getByRole('button', { name: /모두 기본값으로/ }))
    expect(await screen.findByText(/2개가 처음 상태로 돌아가요/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '모두 되돌리기' }))

    expect(shortcuts()).toEqual({})
  })

  test('keeps the shortcuts when the reset is cancelled', async () => {
    const user = userEvent.setup()
    useApp.getState().updateSettings({ shortcuts: { 'go.today': 'x' } })
    renderInRouter(<ShortcutsTab />)

    await user.click(screen.getByRole('button', { name: /모두 기본값으로/ }))
    await user.click(await screen.findByRole('button', { name: '취소' }))

    expect(shortcuts()).toEqual({ 'go.today': 'x' })
  })

  test('filters commands by what the user types', async () => {
    const user = userEvent.setup()
    renderInRouter(<ShortcutsTab />)

    await user.type(screen.getByRole('searchbox', { name: '명령 찾기' }), '캘린더')

    expect(screen.getByRole('row', { name: /캘린더로 이동/ })).toBeInTheDocument()
    expect(screen.queryByRole('row', { name: /작업 추가/ })).not.toBeInTheDocument()
  })

  test('says so when nothing matches the filter', async () => {
    const user = userEvent.setup()
    renderInRouter(<ShortcutsTab />)

    await user.type(screen.getByRole('searchbox', { name: '명령 찾기' }), 'zzzz')

    expect(screen.getByText(/맞는 명령이 없어요/)).toBeInTheDocument()
  })
})
