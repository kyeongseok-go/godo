// 세션 종료 알림: 합성 비프음(외부 파일 없음) + 탭이 가려졌을 때의 시스템 알림.
import { useToasts } from '../../ui/toast'
import { KIND_LABEL } from './timer'
import type { EndedSession, SessionKind } from './timer'

export interface SessionAlert {
  title: string
  body: string
}

const BEEP_OFFSETS_SEC = [0, 0.22, 0.44] as const
const BEEP_HZ = 880
const BEEP_PEAK_GAIN = 0.25
const BEEP_SILENT_GAIN = 0.0001
const BEEP_ATTACK_SEC = 0.02
const BEEP_LENGTH_SEC = 0.16
const NOTIFICATION_TAG = 'godo-focus'

export function alertTextFor(ended: EndedSession, next: SessionKind | null, taskTitle: string | null): SessionAlert {
  const upNext = next ? `다음: ${KIND_LABEL[next]}` : ''
  if (ended.kind === 'focus') {
    return { title: '집중 끝', body: [taskTitle ?? '이름 없는 세션', upNext].filter(Boolean).join(' · ') }
  }
  return { title: '휴식 끝', body: upNext }
}

/** 짧은 삑 소리를 세 번. 시작 시각은 오디오 컨텍스트의 시계를 기준으로 예약한다. */
export function playBeep(ctx: AudioContext): void {
  for (const offset of BEEP_OFFSETS_SEC) {
    const at = ctx.currentTime + offset
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = BEEP_HZ
    gain.gain.setValueAtTime(BEEP_SILENT_GAIN, at)
    gain.gain.exponentialRampToValueAtTime(BEEP_PEAK_GAIN, at + BEEP_ATTACK_SEC)
    gain.gain.exponentialRampToValueAtTime(BEEP_SILENT_GAIN, at + BEEP_LENGTH_SEC)
    osc.connect(gain).connect(ctx.destination)
    osc.start(at)
    osc.stop(at + BEEP_LENGTH_SEC + 0.02)
  }
}

let sharedContext: AudioContext | null = null

function audioContext(): AudioContext | null {
  if (sharedContext) return sharedContext
  if (typeof AudioContext === 'undefined') return null
  sharedContext = new AudioContext()
  return sharedContext
}

/**
 * 사용자가 시작 버튼을 누른 순간 오디오를 깨워 둔다.
 * 브라우저는 제스처 없이 만든 소리를 막으므로, 몇 분 뒤 울릴 알림을 위해 미리 허용받는 것이다.
 */
export function primeAudio(): void {
  try {
    const ctx = audioContext()
    if (ctx && ctx.state === 'suspended') void ctx.resume()
  } catch (error: unknown) {
    reportSoundFailure(error)
  }
}

function reportSoundFailure(error: unknown): void {
  const reason = error instanceof Error ? ` (${error.message})` : ''
  useToasts.getState().push(`알림음을 재생하지 못했어요${reason}`, { tone: 'error' })
}

function beep(): void {
  try {
    const ctx = audioContext()
    if (!ctx) return
    if (ctx.state === 'suspended') void ctx.resume()
    playBeep(ctx)
  } catch (error: unknown) {
    reportSoundFailure(error)
  }
}

/** 권한을 이미 받은 경우에만, 그리고 탭이 가려져 있을 때만 시스템 알림을 띄운다. 권한 요청은 하지 않는다. */
function notifyIfHidden(alert: SessionAlert): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  if (document.visibilityState !== 'hidden') return
  try {
    new Notification(alert.title, { body: alert.body, tag: NOTIFICATION_TAG, silent: true })
  } catch {
    // 일부 모바일 브라우저는 생성자 호출을 막는다. 비프음과 문서 제목이 같은 정보를 전하므로 여기서는 조용히 넘긴다.
  }
}

/** 소리를 꺼 두었거나 다른 화면을 보고 있어도 끝났다는 걸 알 수 있게, 보이는 탭에는 토스트를 함께 띄운다. */
function toastIfVisible(alert: SessionAlert): void {
  if (document.visibilityState !== 'visible') return
  useToasts.getState().push([alert.title, alert.body].filter(Boolean).join(' · '))
}

export function announceSessionEnd(alert: SessionAlert, soundOn: boolean): void {
  if (soundOn) beep()
  notifyIfHidden(alert)
  toastIfVisible(alert)
}
