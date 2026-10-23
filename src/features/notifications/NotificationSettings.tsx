import { Bell, BellRing } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useSettings } from '../../hooks/data'
import { useApp } from '../../store/app'
import { useToasts } from '../../ui/toast'
import { notificationPermission, requestNotificationPermission, sendTestNotification } from './browserNotify'
import type { PermissionState } from './browserNotify'
import './notifications.css'

const OFFSET_CHOICES: ReadonlyArray<{ value: number | null; label: string }> = [
  { value: null, label: '없음' },
  { value: 0, label: '정각' },
  { value: 5, label: '5분 전' },
  { value: 15, label: '15분 전' },
  { value: 30, label: '30분 전' },
  { value: 60, label: '1시간 전' },
  { value: 1440, label: '하루 전' },
]

const PERMISSION_TEXT: Record<PermissionState, string> = {
  granted: '허용됨 · 이 브라우저로 알림이 와요',
  default: '아직 허용하지 않았어요',
  denied: '차단됨 · 브라우저가 알림을 막고 있어요',
  unsupported: '이 브라우저는 알림을 지원하지 않아요',
}

/** 브라우저 알림 권한. 사용자가 브라우저 설정에서 바꾸면 따라가도록 변경 이벤트와 창 포커스에서 다시 읽는다. */
function usePermission(): [PermissionState, () => Promise<void>] {
  const [permission, setPermission] = useState<PermissionState>(notificationPermission)

  useEffect(() => {
    const refresh = (): void => setPermission(notificationPermission())
    let status: PermissionStatus | null = null
    navigator.permissions
      ?.query({ name: 'notifications' })
      .then((result) => {
        status = result
        result.addEventListener('change', refresh)
      })
      .catch(() => undefined) // 권한 조회를 지원하지 않는 브라우저는 포커스 때 다시 읽는 것으로 충분하다.
    window.addEventListener('focus', refresh)
    return () => {
      status?.removeEventListener('change', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  const request = useCallback(async () => setPermission(await requestNotificationPermission()), [])
  return [permission, request]
}

function offsetLabel(value: number): string {
  return `${value}분 전`
}

export function NotificationSettings() {
  const settings = useSettings()
  const updateSettings = useApp((s) => s.updateSettings)
  const [permission, request] = usePermission()
  const current = settings.defaultReminderOffsetMin
  const known = OFFSET_CHOICES.some((choice) => choice.value === current)
  const choices = known || current === null ? OFFSET_CHOICES : [...OFFSET_CHOICES, { value: current, label: offsetLabel(current) }]

  const handleTest = (): void => {
    const sent = sendTestNotification()
    useToasts
      .getState()
      .push(sent ? '테스트 알림을 보냈어요' : '알림을 보내지 못했어요. 권한을 확인해 주세요', { tone: sent ? 'info' : 'error' })
  }

  return (
    <div className="notif-settings">
      <section className="notif-block" aria-labelledby="notif-permission-title">
        <h3 className="notif-block__title" id="notif-permission-title">
          브라우저 알림
        </h3>
        <p className="notif-status" data-state={permission} role="status">
          <span className="notif-status__dot" aria-hidden="true" />
          {PERMISSION_TEXT[permission]}
        </p>
        {permission === 'denied' ? (
          <p className="notif-callout">
            주소창 왼쪽의 사이트 설정(자물쇠 아이콘)에서 알림을 &lsquo;허용&rsquo;으로 바꾼 뒤, 이 페이지를 새로고침해 주세요.
            앱에서는 다시 물어볼 수 없어요.
          </p>
        ) : null}
        <div className="notif-actions">
          {permission === 'default' ? (
            <button type="button" className="notif-button" data-variant="solid" onClick={() => void request()}>
              <Bell size={16} aria-hidden="true" />
              알림 허용하기
            </button>
          ) : null}
          <button type="button" className="notif-button" disabled={permission !== 'granted'} onClick={handleTest}>
            <BellRing size={16} aria-hidden="true" />
            테스트 알림 보내기
          </button>
        </div>
      </section>

      <section className="notif-block" aria-labelledby="notif-offset-title">
        <h3 className="notif-block__title" id="notif-offset-title">
          기본 알림 시점
        </h3>
        <p className="notif-block__hint">시각을 정한 새 할 일에 이 알림이 자동으로 붙어요.</p>
        <div className="notif-choices" role="radiogroup" aria-labelledby="notif-offset-title">
          {choices.map((choice) => (
            <label key={String(choice.value)} className="notif-choice">
              <input
                type="radio"
                name="default-reminder"
                value={choice.value === null ? 'none' : String(choice.value)}
                checked={current === choice.value}
                onChange={() => updateSettings({ defaultReminderOffsetMin: choice.value })}
              />
              <span>{choice.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="notif-honest" aria-label="알림 동작 안내">
        <strong>앱이 닫혀 있으면 알림이 울리지 않아요</strong>
        <span>앱을 열 때 24시간 안에 놓친 알림을 알려 줘요. 지속 알림은 완료할 때까지 10분마다 다시 울려요.</span>
      </section>
    </div>
  )
}
