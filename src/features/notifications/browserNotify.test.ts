import { vi } from 'vitest'
import {
  notificationPermission,
  notifyDue,
  requestNotificationPermission,
  sendTestNotification,
  taskHash,
} from './browserNotify'
import type { DueReminder } from './schedule'

interface Recorded {
  title: string
  options: NotificationOptions | undefined
  closed: boolean
  onclick: (() => void) | null
}

function stubNotification(permission: NotificationPermission, requested: NotificationPermission = permission) {
  const created: Recorded[] = []
  class FakeNotification {
    static permission = permission
    static requestPermission = vi.fn(async () => {
      FakeNotification.permission = requested
      return requested
    })
    onclick: (() => void) | null = null
    closed = false
    title: string
    options: NotificationOptions | undefined
    constructor(title: string, options?: NotificationOptions) {
      this.title = title
      this.options = options
      created.push(this as unknown as Recorded)
    }
    close(): void {
      this.closed = true
    }
  }
  vi.stubGlobal('Notification', FakeNotification)
  return { created, FakeNotification }
}

const due = (n: number): DueReminder => ({ key: `t${n}|r1|2026-10-24`, taskId: `t${n}`, title: `할 일 ${n}`, at: n, body: '15:00 시작' })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('notificationPermission', () => {
  test('reports unsupported when the API is missing', () => {
    vi.stubGlobal('Notification', undefined)

    expect(notificationPermission()).toBe('unsupported')
  })

  test('reports the current permission', () => {
    stubNotification('denied')

    expect(notificationPermission()).toBe('denied')
  })
})

describe('requestNotificationPermission', () => {
  test('returns the permission the user chose', async () => {
    stubNotification('default', 'granted')

    await expect(requestNotificationPermission()).resolves.toBe('granted')
  })

  test('returns unsupported without the API', async () => {
    vi.stubGlobal('Notification', undefined)

    await expect(requestNotificationPermission()).resolves.toBe('unsupported')
  })

  test('falls back to the current permission when the request throws', async () => {
    const { FakeNotification } = stubNotification('default')
    FakeNotification.requestPermission.mockRejectedValueOnce(new Error('blocked'))

    await expect(requestNotificationPermission()).resolves.toBe('default')
  })
})

describe('notifyDue', () => {
  test('does nothing unless permission is granted', () => {
    const { created } = stubNotification('default')

    expect(notifyDue([due(1)])).toBe(0)
    expect(created).toHaveLength(0)
  })

  test('shows one notification per reminder with the key as the tag', () => {
    const { created } = stubNotification('granted')

    expect(notifyDue([due(1), due(2)])).toBe(2)

    expect(created.map((n) => n.title)).toEqual(['할 일 1', '할 일 2'])
    expect(created[0].options).toMatchObject({ body: '15:00 시작', tag: 't1|r1|2026-10-24' })
  })

  test('collapses a burst into three notifications plus a summary', () => {
    const { created } = stubNotification('granted')

    notifyDue([due(1), due(2), due(3), due(4), due(5)])

    expect(created.map((n) => n.title)).toEqual(['할 일 1', '할 일 2', '할 일 3', '알림 2건 더 있어요'])
  })

  test('clicking a notification focuses the window and opens the task', () => {
    const { created } = stubNotification('granted')
    const focus = vi.spyOn(window, 'focus').mockImplementation(() => undefined)
    window.location.hash = '#/today'

    notifyDue([due(7)])
    created[0].onclick?.()

    expect(focus).toHaveBeenCalled()
    expect(window.location.hash).toBe('#/inbox?task=t7')
    expect(created[0].closed).toBe(true)
  })

  test('survives a constructor that throws', () => {
    vi.stubGlobal(
      'Notification',
      class {
        static permission = 'granted'
        constructor() {
          throw new Error('illegal constructor')
        }
      },
    )

    expect(notifyDue([due(1)])).toBe(0)
  })
})

describe('sendTestNotification', () => {
  test('shows a notification when granted', () => {
    const { created } = stubNotification('granted')

    expect(sendTestNotification()).toBe(true)

    expect(created[0].title).toBe('Pace 테스트 알림')
  })

  test('returns false when permission is missing', () => {
    stubNotification('denied')

    expect(sendTestNotification()).toBe(false)
  })
})

describe('taskHash', () => {
  test('encodes the task id', () => {
    expect(taskHash('a b')).toBe('#/inbox?task=a%20b')
  })
})
