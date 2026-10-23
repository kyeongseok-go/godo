import { useEffect, useRef, useState } from 'react'
import { normalizeKey } from '../shortcuts/keymap'
import { pushCaptureKey } from './shortcutBindings'

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
/** 첫 키만 누르고 이 시간 안에 다음 키가 없으면 한 키짜리 단축키로 확정한다 */
const SEQUENCE_WAIT_MS = 1000

export interface KeyCaptureState {
  capturing: boolean
  /** 시퀀스의 첫 키를 받은 뒤 두 번째 키를 기다리는 동안의 값 */
  pending: string | null
  toggle: () => void
  cancel: () => void
}

/**
 * 켜져 있는 동안 문서의 keydown 을 캡처 단계에서 가로채 단축키로 받는다.
 * Esc 는 취소, Tab 은 포커스를 그대로 옮기며 취소(키보드 사용자가 갇히지 않게), 수식키 조합은 바로 확정한다.
 */
export function useKeyCapture(onCapture: (keys: string) => void): KeyCaptureState {
  const [capturing, setCapturing] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const onCaptureRef = useRef(onCapture)
  useEffect(() => {
    onCaptureRef.current = onCapture
  })

  useEffect(() => {
    if (!capturing) return
    let pendingKeys: string | null = null
    let timer: ReturnType<typeof setTimeout> | undefined

    const stop = (): void => {
      clearTimeout(timer)
      setPending(null)
      setCapturing(false)
    }
    const finish = (value: string): void => {
      stop()
      onCaptureRef.current(value)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.isComposing || event.repeat) return
      const token = event.key === 'Escape' ? 'escape' : normalizeKey(event, IS_MAC)
      if (token === null) return
      const isTab = token === 'tab' || token === 'shift+tab'
      if (!isTab) {
        event.preventDefault()
        event.stopPropagation()
      }
      if (isTab || token === 'escape') return stop()
      clearTimeout(timer)
      const step = pushCaptureKey(pendingKeys, token)
      if (step.done) return finish(step.keys)
      pendingKeys = step.keys
      setPending(step.keys)
      timer = setTimeout(() => finish(step.keys), SEQUENCE_WAIT_MS)
    }

    // 캡처 단계에서 가로채야 전역 단축키(g i 등)가 같이 실행되지 않는다.
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      clearTimeout(timer)
    }
  }, [capturing])

  return { capturing, pending, toggle: () => setCapturing((on) => !on), cancel: () => setCapturing(false) }
}
