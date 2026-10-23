import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useApp } from '../store/app'
import { defaultSettings } from '../store/defaults'
import { useNow, useToday } from './data'

const TICK_MS = 30_000
const at = (h: number, min = 0): number => new Date(2026, 9, 23, h, min).getTime()

describe('useToday', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(at(10))
    useApp.setState({ settings: { ...defaultSettings(), dayStartHour: 0 } })
  })

  afterEach(() => {
    vi.useRealTimers()
    useApp.setState({ settings: defaultSettings() })
  })

  test('returns today as an ISO date string', () => {
    const { result } = renderHook(() => useToday())

    expect(result.current).toBe('2026-10-23')
  })

  test('does not re-render while the day stays the same', () => {
    let renders = 0
    renderHook(() => {
      renders += 1
      return useToday()
    })
    const afterMount = renders

    act(() => {
      vi.setSystemTime(at(14))
      vi.advanceTimersByTime(TICK_MS * 20)
    })

    expect(renders).toBe(afterMount)
  })

  test('updates once when the day rolls over', () => {
    let renders = 0
    const { result } = renderHook(() => {
      renders += 1
      return useToday()
    })
    const afterMount = renders

    act(() => {
      vi.setSystemTime(new Date(2026, 9, 24, 0, 1).getTime())
      vi.advanceTimersByTime(TICK_MS)
    })

    expect(result.current).toBe('2026-10-24')
    expect(renders).toBe(afterMount + 1)
  })

  test('follows the configured day start hour, so 02:00 still belongs to the previous day', () => {
    useApp.setState({ settings: { ...defaultSettings(), dayStartHour: 4 } })
    vi.setSystemTime(new Date(2026, 9, 24, 2, 0).getTime())

    const { result } = renderHook(() => useToday())

    expect(result.current).toBe('2026-10-23')
  })

  test('recomputes immediately when the day start hour setting changes', () => {
    vi.setSystemTime(new Date(2026, 9, 24, 2, 0).getTime())
    const { result } = renderHook(() => useToday())
    expect(result.current).toBe('2026-10-24')

    act(() => {
      useApp.setState({ settings: { ...defaultSettings(), dayStartHour: 4 } })
    })

    expect(result.current).toBe('2026-10-23')
  })

  test('stops its timer after the last consumer unmounts', () => {
    const first = renderHook(() => useToday())
    const second = renderHook(() => useToday())

    first.unmount()
    second.unmount()

    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('useNow', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  test('still ticks a fresh Date at its own interval', () => {
    vi.setSystemTime(at(10))
    const { result } = renderHook(() => useNow(60_000))
    const first = result.current

    act(() => {
      vi.setSystemTime(at(10, 5))
      vi.advanceTimersByTime(60_000)
    })

    expect(result.current).not.toBe(first)
    expect(result.current.getTime()).toBeGreaterThan(first.getTime())
  })
})
