import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db, useApp } from '../store/app'
import { resetApp } from '../test/render'
import { DB_STALE_EVENT } from '../db/db'
import { App } from './App'

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

// 나눠 불러오는 화면은 처음 읽을 때 변환 시간이 걸려, 전체 테스트가 몰릴 때 기본 1초를 넘길 수 있다.
const LAZY_LOAD = { timeout: 8000 }
vi.setConfig({ testTimeout: 12000 })

beforeEach(async () => {
  await resetApp()
  window.location.hash = '#/inbox'
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('data-density')
  document.documentElement.style.removeProperty('--accent-custom')
})

describe('App', () => {
  test('opens on the page for the address once the data is loaded', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { name: /^받은편지함/ })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '주 메뉴' })).toBeInTheDocument()
  })

  test('shows a loading notice until the data is ready', () => {
    useApp.setState({ ready: false })
    render(<App />)

    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중')
  })

  test('shows the read failure screen and recovers with the retry button', async () => {
    const user = userEvent.setup()
    const failing = vi.spyOn(db.table('tasks'), 'toArray').mockRejectedValue(new Error('디스크 오류'))
    useApp.setState({ ready: false })
    await useApp.getState().reload().catch(() => undefined)

    render(<App />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('데이터를 불러오지 못했어요')
    expect(alert).toHaveTextContent('디스크 오류')
    expect(screen.getByRole('button', { name: '새로고침' })).toBeInTheDocument()

    failing.mockRestore()
    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByRole('heading', { name: /^받은편지함/ })).toBeInTheDocument()
    expect(useApp.getState().loadError).toBeNull()
  })

  test('keeps the failure screen when retrying fails again', async () => {
    const user = userEvent.setup()
    vi.spyOn(db.table('tasks'), 'toArray').mockRejectedValue(new Error('디스크 오류'))
    useApp.setState({ ready: false })
    await useApp.getState().reload().catch(() => undefined)
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '다시 시도' }))

    await waitFor(() => expect(useApp.getState().loadError).toContain('디스크 오류'))
    expect(screen.getByRole('alert')).toHaveTextContent('데이터를 불러오지 못했어요')
  })

  test('tells the user to refresh when another tab upgraded the database version', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: /^받은편지함/ })

    // 다른 탭이 더 높은 버전으로 DB 를 여는 상황
    await act(async () => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(db.name, Math.round(db.verno * 10) + 10)
        request.onsuccess = () => {
          request.result.close()
          resolve()
        }
        request.onerror = () => reject(request.error)
      })
    })

    const notice = await screen.findByRole('alertdialog')
    expect(notice).toHaveTextContent('다른 탭에서 앱을 업데이트했어요')
    expect(screen.getByRole('button', { name: '새로고침' })).toBeInTheDocument()
  })

  test('shows the stale notice when the stale event fires', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: /^받은편지함/ })

    act(() => {
      window.dispatchEvent(new Event(DB_STALE_EVENT))
    })

    expect(screen.getByRole('alertdialog', { name: /다른 탭에서/ })).toBeInTheDocument()
  })

  test('applies the theme, density and accent settings to the document', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: /^받은편지함/ })
    const root = document.documentElement

    act(() => useApp.getState().updateSettings({ theme: 'dark', density: 'compact', accent: '#2b4c7e' }))
    expect(root).toHaveAttribute('data-theme', 'dark')
    expect(root).toHaveAttribute('data-density', 'compact')
    expect(root.style.getPropertyValue('--accent-custom')).toBe('#2b4c7e')

    act(() => useApp.getState().updateSettings({ theme: 'auto', density: 'comfortable', accent: '#c8360f' }))
    expect(root).not.toHaveAttribute('data-theme')
    expect(root).not.toHaveAttribute('data-density')
    expect(root.style.getPropertyValue('--accent-custom')).toBe('')
  })

  test.each([
    ['#/help', /^사용 가이드/],
    ['#/plan', /^오늘 계획하기/],
    ['#/replan', /^밀린 일 정리/],
    ['#/review', /^주간 리뷰/],
    ['#/summary', /^요약 보고서/],
    ['#/productivity', /^생산성/],
    ['#/settings/general', /^설정/],
  ])('loads the lazily split screen at %s', async (hash, heading) => {
    window.location.hash = hash
    render(<App />)

    expect(await screen.findByRole('heading', { level: 1, name: heading }, LAZY_LOAD)).toBeInTheDocument()
  })

  test.each(['#/habits', '#/focus', '#/countdown'])('loads the lazily split screen at %s', async (hash) => {
    window.location.hash = hash
    render(<App />)

    await waitFor(() => expect(screen.queryByText('불러오는 중…')).not.toBeInTheDocument(), LAZY_LOAD)
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('main').textContent?.length).toBeGreaterThan(0)
  })

  test('redirects settings without a tab to the general tab', async () => {
    window.location.hash = '#/settings'
    render(<App />)

    expect(await screen.findByRole('heading', { level: 1, name: /^설정/ }, LAZY_LOAD)).toBeInTheDocument()
    expect(window.location.hash).toBe('#/settings/general')
  })

  test('opens the home screen chosen in settings when the address is empty', async () => {
    useApp.getState().updateSettings({ homeView: 'upcoming' })
    window.location.hash = ''
    render(<App />)

    expect(await screen.findByRole('heading', { level: 1, name: /^다음 7일/ })).toBeInTheDocument()
  })

  test('the refresh buttons reload the page', async () => {
    const user = userEvent.setup()
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    vi.spyOn(db.table('tasks'), 'toArray').mockRejectedValue(new Error('디스크 오류'))
    useApp.setState({ ready: false })
    await useApp.getState().reload().catch(() => undefined)
    const failure = render(<App />)

    await user.click(await screen.findByRole('button', { name: '새로고침' }))
    expect(reload).toHaveBeenCalledTimes(1)
    failure.unmount()

    useApp.setState({ ready: true })
    render(<App />)
    act(() => {
      window.dispatchEvent(new Event(DB_STALE_EVENT))
    })
    await user.click(screen.getByRole('button', { name: '새로고침' }))
    expect(reload).toHaveBeenCalledTimes(2)
  })

  test('sends an unknown address to Today', async () => {
    window.location.hash = '#/no-such-page'
    render(<App />)

    expect(await screen.findByRole('heading', { name: /^오늘/ })).toBeInTheDocument()
  })
})
