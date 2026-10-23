import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { useApp } from '../../store/app'
import { emptyEntityState } from '../../store/changes'
import { defaultSettings } from '../../store/defaults'
import { NotificationSettings } from './NotificationSettings'

interface FakeNotificationClass {
  new (title: string, options?: NotificationOptions): unknown
  permission: NotificationPermission
  requestPermission: () => Promise<NotificationPermission>
}

function stubNotification(permission: NotificationPermission, requested: NotificationPermission = permission) {
  const shown: string[] = []
  const fake = function (title: string) {
    shown.push(title)
  } as unknown as FakeNotificationClass
  fake.permission = permission
  fake.requestPermission = vi.fn(async () => {
    fake.permission = requested
    return requested
  })
  vi.stubGlobal('Notification', fake)
  return { shown, fake }
}

beforeEach(() => {
  useApp.setState({ ready: true, entities: emptyEntityState(), settings: defaultSettings() })
})

afterEach(() => {
  vi.unstubAllGlobals()
  useApp.setState({ ready: false, entities: emptyEntityState(), settings: defaultSettings() })
})

describe('NotificationSettings', () => {
  test('always tells honestly that closed apps cannot notify', () => {
    stubNotification('granted')

    render(<NotificationSettings />)

    expect(screen.getByText('앱이 닫혀 있으면 알림이 울리지 않아요')).toBeInTheDocument()
  })

  test('asks for permission and then enables the test button', async () => {
    const { fake } = stubNotification('default', 'granted')
    render(<NotificationSettings />)
    expect(screen.getByRole('button', { name: /테스트 알림 보내기/ })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: /알림 허용하기/ }))

    expect(fake.requestPermission).toHaveBeenCalled()
    expect(await screen.findByText(/허용됨/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /테스트 알림 보내기/ })).toBeEnabled()
  })

  test('explains how to unblock when permission was denied', () => {
    stubNotification('denied')

    render(<NotificationSettings />)

    expect(screen.getByText(/브라우저가 알림을 막고 있어요/)).toBeInTheDocument()
    expect(screen.getByText(/사이트 설정/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /알림 허용하기/ })).not.toBeInTheDocument()
  })

  test('says so when the browser has no notification support', () => {
    vi.stubGlobal('Notification', undefined)

    render(<NotificationSettings />)

    expect(screen.getByText('이 브라우저는 알림을 지원하지 않아요')).toBeInTheDocument()
  })

  test('sends a test notification', async () => {
    const { shown } = stubNotification('granted')
    render(<NotificationSettings />)

    await userEvent.click(screen.getByRole('button', { name: /테스트 알림 보내기/ }))

    expect(shown).toEqual(['Pace 테스트 알림'])
  })

  test('saves the default reminder offset through updateSettings', async () => {
    stubNotification('granted')
    render(<NotificationSettings />)
    expect(screen.getByRole('radio', { name: '없음' })).toBeChecked()

    await userEvent.click(screen.getByRole('radio', { name: '30분 전' }))

    expect(useApp.getState().settings.defaultReminderOffsetMin).toBe(30)
    expect(screen.getByRole('radio', { name: '30분 전' })).toBeChecked()
  })

  test('can switch back to no default reminder', async () => {
    stubNotification('granted')
    useApp.setState({ settings: { ...defaultSettings(), defaultReminderOffsetMin: 0 } })
    render(<NotificationSettings />)

    await userEvent.click(screen.getByRole('radio', { name: '없음' }))

    expect(useApp.getState().settings.defaultReminderOffsetMin).toBeNull()
  })

  test('shows a custom stored offset as its own choice', () => {
    stubNotification('granted')
    useApp.setState({ settings: { ...defaultSettings(), defaultReminderOffsetMin: 10 } })

    render(<NotificationSettings />)

    expect(screen.getByRole('radio', { name: '10분 전' })).toBeChecked()
  })
})
