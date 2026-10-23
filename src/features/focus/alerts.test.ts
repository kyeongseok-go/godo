import { useToasts } from '../../ui/toast'
import { alertTextFor, announceSessionEnd, playBeep } from './alerts'
import type { EndedSession } from './timer'

function fakeAudioContext() {
  const oscillators: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }> = []
  class FakeAudioContext {
    state = 'running'
    currentTime = 10
    destination = {}
    resume = vi.fn(() => Promise.resolve())
    createGain() {
      return {
        gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: (next: unknown) => next,
      }
    }
    createOscillator() {
      const osc = { type: '', frequency: { value: 0 }, connect: (next: unknown) => next, start: vi.fn(), stop: vi.fn() }
      oscillators.push(osc)
      return osc
    }
  }
  return { FakeAudioContext, oscillators }
}

const ended = (over: Partial<EndedSession> = {}): EndedSession => ({
  kind: 'focus',
  reason: 'elapsed',
  endedAt: 1,
  record: null,
  ...over,
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('alertTextFor', () => {
  test('names the task and the next session after a focus', () => {
    expect(alertTextFor(ended(), 'shortBreak', '보고서')).toEqual({
      title: '집중 끝',
      body: '보고서 · 다음: 짧은 휴식',
    })
  })

  test('falls back to an unnamed session and handles breaks', () => {
    expect(alertTextFor(ended(), 'longBreak', null).body).toBe('이름 없는 세션 · 다음: 긴 휴식')
    expect(alertTextFor(ended({ kind: 'shortBreak' }), 'focus', '보고서')).toEqual({
      title: '휴식 끝',
      body: '다음: 집중',
    })
  })
})

describe('playBeep', () => {
  test('schedules three short tones from the context clock', () => {
    const { FakeAudioContext, oscillators } = fakeAudioContext()
    playBeep(new FakeAudioContext() as unknown as AudioContext)
    expect(oscillators).toHaveLength(3)
    expect(oscillators[0].start).toHaveBeenCalledWith(10)
    expect(oscillators[2].stop).toHaveBeenCalled()
  })
})

describe('announceSessionEnd', () => {
  const alert = { title: '집중 끝', body: '본문' }

  test('plays the beep only when sound is on', () => {
    const { FakeAudioContext, oscillators } = fakeAudioContext()
    vi.stubGlobal('AudioContext', FakeAudioContext)
    announceSessionEnd(alert, false)
    expect(oscillators).toHaveLength(0)
    announceSessionEnd(alert, true)
    expect(oscillators).toHaveLength(3)
  })

  test('notifies only when the tab is hidden and permission is already granted', () => {
    const ctor = vi.fn()
    vi.stubGlobal('Notification', Object.assign(ctor, { permission: 'granted' }))
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    announceSessionEnd(alert, false)
    expect(ctor).not.toHaveBeenCalled()

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    announceSessionEnd(alert, false)
    expect(ctor).toHaveBeenCalledWith('집중 끝', expect.objectContaining({ body: '본문' }))
  })

  test('shows a toast while the tab is visible and none while hidden', () => {
    useToasts.setState({ toasts: [] })
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    announceSessionEnd(alert, false)
    expect(useToasts.getState().toasts.map((t) => t.message)).toEqual(['집중 끝 · 본문'])

    useToasts.setState({ toasts: [] })
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    announceSessionEnd(alert, false)
    expect(useToasts.getState().toasts).toEqual([])
  })

  test('never asks for permission and skips when it is not granted', () => {
    const ctor = vi.fn()
    const requestPermission = vi.fn()
    vi.stubGlobal('Notification', Object.assign(ctor, { permission: 'default', requestPermission }))
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    announceSessionEnd(alert, false)
    expect(ctor).not.toHaveBeenCalled()
    expect(requestPermission).not.toHaveBeenCalled()
  })

  test('does not throw when the browser lacks Notification and AudioContext', () => {
    vi.stubGlobal('Notification', undefined)
    vi.stubGlobal('AudioContext', undefined)
    expect(() => announceSessionEnd(alert, true)).not.toThrow()
  })
})
