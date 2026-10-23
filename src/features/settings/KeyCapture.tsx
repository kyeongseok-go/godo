import { formatKeys } from '../shortcuts/keymap'
import { useKeyCapture } from './useKeyCapture'

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

interface KeyCaptureProps {
  /** 접근 가능한 이름에 쓰는 명령 이름 */
  title: string
  keys: string | undefined
  onCapture: (keys: string) => void
}

/** 눌러서 켜는 키 입력 칸. 켜진 동안 누른 키를 단축키로 받는다(Esc 취소, 두 키까지 이어 입력). */
export function KeyCapture({ title, keys, onCapture }: KeyCaptureProps) {
  const { capturing, pending, toggle, cancel } = useKeyCapture(onCapture)
  const current = keys ? formatKeys(keys, IS_MAC) : '없음'
  return (
    <button
      type="button"
      className="st-keycap"
      data-capturing={capturing}
      aria-label={`${title} 단축키 바꾸기. 지금은 ${current}`}
      onClick={toggle}
      onBlur={cancel}
    >
      {capturing ? (
        <span className="st-keycap__wait">
          {pending ? <kbd>{formatKeys(pending, IS_MAC)}</kbd> : null}
          {pending ? '다음 키…' : '키를 누르세요'}
          <span className="sr-only" role="status">
            키 입력을 기다리는 중이에요. Esc를 누르면 취소해요.
          </span>
        </span>
      ) : keys ? (
        <kbd>{current}</kbd>
      ) : (
        <span className="st-keycap__none">없음</span>
      )}
    </button>
  )
}
