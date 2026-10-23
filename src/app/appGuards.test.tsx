import { act, renderHook, waitFor } from '@testing-library/react'
import { DB_STALE_EVENT } from '../db/db'
import { useApp } from '../store/app'
import { makeTask } from '../test/factories'
import { resetApp } from '../test/render'
import { useToasts } from '../ui/toast'
import { useBeforeUnloadGuard, useCrossTabSync, useStaleDb, useStorageGuard } from './appGuards'

// store/app 이 읽히는 순간 만드는 채널을 가짜로 바꿔 둔다(import 보다 먼저 실행돼야 한다).
const channel = vi.hoisted(() => {
  const listeners = new Set<() => void>()
  class FakeBroadcastChannel {
    addEventListener(_type: string, listener: () => void) {
      listeners.add(listener)
    }
    removeEventListener(_type: string, listener: () => void) {
      listeners.delete(listener)
    }
    postMessage() {}
  }
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
  return { listeners, emit: () => [...listeners].forEach((l) => l()) }
})

const originalReload = useApp.getState().reload

beforeEach(async () => {
  await resetApp()
  useToasts.setState({ toasts: [] })
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  useApp.setState({ reload: originalReload, pendingWrites: 0, persistError: null, ready: true })
})

const beforeUnload = () => {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event
}

describe('useBeforeUnloadGuard', () => {
  test('lets the tab close when nothing is being saved and nothing failed', () => {
    renderHook(() => useBeforeUnloadGuard())

    expect(beforeUnload().defaultPrevented).toBe(false)
  })

  test('asks before closing while a change is still being written, then lets go once saved', async () => {
    renderHook(() => useBeforeUnloadGuard())

    useApp.getState().commit({ puts: { tasks: [makeTask({ id: 'a' })] }, deletes: {} }, '추가')
    expect(useApp.getState().pendingWrites).toBeGreaterThan(0)
    expect(beforeUnload().defaultPrevented).toBe(true)

    await waitFor(() => expect(useApp.getState().pendingWrites).toBe(0))
    expect(beforeUnload().defaultPrevented).toBe(false)
  })

  test('asks before closing when a save failed and the error is still showing', () => {
    renderHook(() => useBeforeUnloadGuard())
    useApp.setState({ persistError: '저장하지 못했어요' })

    expect(beforeUnload().defaultPrevented).toBe(true)
  })

  test('stops guarding after the component unmounts', () => {
    const { unmount } = renderHook(() => useBeforeUnloadGuard())
    unmount()
    useApp.setState({ persistError: '저장하지 못했어요' })

    expect(beforeUnload().defaultPrevented).toBe(false)
  })
})

describe('useCrossTabSync', () => {
  function setup() {
    const reload = vi.fn().mockResolvedValue(undefined)
    useApp.setState({ reload })
    const view = renderHook(() => useCrossTabSync())
    vi.useFakeTimers()
    return { reload, ...view }
  }

  test('reloads once after another tab announces a change, however many messages arrive', () => {
    const { reload } = setup()

    channel.emit()
    channel.emit()
    channel.emit()
    expect(reload).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)

    expect(reload).toHaveBeenCalledTimes(1)
  })

  test('waits for this tab to finish saving before reloading', () => {
    const { reload } = setup()
    useApp.setState({ pendingWrites: 1 })

    channel.emit()
    vi.advanceTimersByTime(100 + 250 * 3)
    expect(reload).not.toHaveBeenCalled()

    useApp.setState({ pendingWrites: 0 })
    vi.advanceTimersByTime(250)

    expect(reload).toHaveBeenCalledTimes(1)
  })

  test('gives up waiting after the retry limit and reloads anyway', () => {
    const { reload } = setup()
    useApp.setState({ pendingWrites: 1 })

    channel.emit()
    vi.advanceTimersByTime(100 + 250 * 19)
    expect(reload).not.toHaveBeenCalled()
    vi.advanceTimersByTime(250)

    expect(reload).toHaveBeenCalledTimes(1)
  })

  test('does nothing before the first load has finished', () => {
    const { reload } = setup()
    useApp.setState({ ready: false })

    channel.emit()
    vi.advanceTimersByTime(1000)

    expect(reload).not.toHaveBeenCalled()
  })

  test('swallows a failed reload because the store reports it on screen', async () => {
    const { reload } = setup()
    reload.mockRejectedValue(new Error('읽기 실패'))

    channel.emit()
    vi.advanceTimersByTime(100)

    expect(reload).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(0)
  })

  test('stops listening and cancels a pending reload on unmount', () => {
    const { reload, unmount } = setup()

    channel.emit()
    unmount()
    vi.advanceTimersByTime(1000)

    expect(channel.listeners.size).toBe(0)
    expect(reload).not.toHaveBeenCalled()
  })
})

describe('useStaleDb', () => {
  test('turns true when another tab upgrades the database', () => {
    const { result } = renderHook(() => useStaleDb())
    expect(result.current).toBe(false)

    act(() => {
      window.dispatchEvent(new Event(DB_STALE_EVENT))
    })

    expect(result.current).toBe(true)
  })
})

describe('useStorageGuard', () => {
  function stubStorage(persist: (() => Promise<boolean>) | undefined) {
    const fake = persist ? { persist } : undefined
    vi.stubGlobal(
      'navigator',
      new Proxy(navigator, {
        get(target, prop) {
          if (prop === 'storage') return fake
          const value = Reflect.get(target, prop, target) as unknown
          return typeof value === 'function' ? value.bind(target) : value
        },
      }),
    )
  }
  const warning = () => useToasts.getState().toasts.find((t) => t.message.includes('저장 공간'))

  test('warns once when the browser refuses to protect the storage', async () => {
    const persist = vi.fn().mockResolvedValue(false)
    stubStorage(persist)

    const first = renderHook(() => useStorageGuard())
    await waitFor(() => expect(warning()).toBeDefined())
    first.unmount()

    useToasts.setState({ toasts: [] })
    renderHook(() => useStorageGuard())
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(2))
    expect(warning()).toBeUndefined()
  })

  test('stays quiet when the browser grants persistent storage', async () => {
    const persist = vi.fn().mockResolvedValue(true)
    stubStorage(persist)

    renderHook(() => useStorageGuard())

    await waitFor(() => expect(persist).toHaveBeenCalled())
    expect(warning()).toBeUndefined()
  })

  test('still warns when localStorage is unavailable to remember the warning', async () => {
    stubStorage(vi.fn().mockResolvedValue(false))
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    renderHook(() => useStorageGuard())

    await waitFor(() => expect(warning()).toBeDefined())
    vi.restoreAllMocks()
  })

  test('does not ask before the data is ready, nor when the API does not exist', async () => {
    const persist = vi.fn().mockResolvedValue(false)
    stubStorage(persist)
    useApp.setState({ ready: false })
    const notReady = renderHook(() => useStorageGuard())
    notReady.unmount()
    expect(persist).not.toHaveBeenCalled()

    useApp.setState({ ready: true })
    stubStorage(undefined)
    renderHook(() => useStorageGuard())
    expect(warning()).toBeUndefined()
  })

  test('ignores a rejected persist request', async () => {
    const persist = vi.fn().mockRejectedValue(new Error('거부'))
    stubStorage(persist)

    renderHook(() => useStorageGuard())

    await waitFor(() => expect(persist).toHaveBeenCalled())
    expect(warning()).toBeUndefined()
  })

  test('does not warn if unmounted before the answer arrives', async () => {
    let answer: (granted: boolean) => void = () => undefined
    stubStorage(() => new Promise<boolean>((resolve) => (answer = resolve)))

    const view = renderHook(() => useStorageGuard())
    view.unmount()
    answer(false)
    await Promise.resolve()

    expect(warning()).toBeUndefined()
  })
})
