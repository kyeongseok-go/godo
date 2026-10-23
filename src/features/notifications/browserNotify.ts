// 브라우저 Notification API 를 얇게 감싼다. 지원하지 않거나 막힌 환경에서도 예외 없이 "안 울림"으로 처리한다.
import type { DueReminder } from './schedule'

export type PermissionState = NotificationPermission | 'unsupported'

/** 한꺼번에 여러 건이 쌓였을 때 개별로 보여 줄 최대 개수. 나머지는 요약 한 건으로 묶는다. */
const MAX_INDIVIDUAL = 3

export function notificationPermission(): PermissionState {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (typeof Notification === 'undefined') return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return notificationPermission()
  }
}

/** 알림을 눌렀을 때 이동할 주소. HashRouter 라서 해시로 간다. */
export function taskHash(taskId: string): string {
  return `#/inbox?task=${encodeURIComponent(taskId)}`
}

function show(title: string, options: NotificationOptions, taskId: string | null): boolean {
  try {
    const notification = new Notification(title, options)
    notification.onclick = () => {
      window.focus()
      if (taskId) window.location.hash = taskHash(taskId)
      notification.close()
    }
    return true
  } catch {
    return false
  }
}

/** 권한이 있을 때만 알림을 띄우고, 실제로 띄운 건수를 돌려준다. tag 가 같으면 브라우저가 알아서 하나로 합친다. */
export function notifyDue(due: readonly DueReminder[]): number {
  if (notificationPermission() !== 'granted') return 0
  let shown = 0
  for (const item of due.slice(0, MAX_INDIVIDUAL)) {
    if (show(item.title, { body: item.body, tag: item.key }, item.taskId)) shown += 1
  }
  const rest = due.length - MAX_INDIVIDUAL
  if (rest > 0 && show(`알림 ${rest}건 더 있어요`, { body: 'godo를 열어 확인해 주세요', tag: 'pace-summary' }, null)) shown += 1
  return shown
}

export function sendTestNotification(): boolean {
  if (notificationPermission() !== 'granted') return false
  return show('godo 테스트 알림', { body: '이렇게 알려 드려요', tag: 'pace-test' }, null)
}
