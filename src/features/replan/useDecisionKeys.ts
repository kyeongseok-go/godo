import { useEffect, useRef } from 'react'
import { isTypingTarget } from '../shortcuts/keymap'

export type KeyHandlers = Readonly<Record<string, () => void>>

/** 한글 입력 상태에서도 같은 자리의 키로 동작하도록 글자·숫자는 물리 키(code)를 먼저 본다 */
export function keyNameOf(e: Pick<KeyboardEvent, 'code' | 'key'>): string {
  const letter = /^Key([A-Z])$/.exec(e.code)
  if (letter) return letter[1].toLowerCase()
  const digit = /^(?:Digit|Numpad)(\d)$/.exec(e.code)
  if (digit) return digit[1]
  return e.key.toLowerCase()
}

interface Options {
  enabled: boolean
  /** 이미 열린 대화상자 안에서 쓰는 화면(받은편지함 처리)이면 true */
  allowInDialog?: boolean
}

/**
 * 한 장씩 결정하는 화면의 단축키. 전역 단축키(`e` 완료, `s` 시퀀스 등)와 겹치므로
 * window 캡처 단계에서 먼저 받아 전파를 막는다. 입력창·수식키 조합·다른 대화상자 위에서는 건드리지 않는다.
 */
export function useDecisionKeys(handlers: KeyHandlers, { enabled, allowInDialog = false }: Options): void {
  const ref = useRef(handlers)
  useEffect(() => {
    ref.current = handlers
  }, [handlers])

  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return
      if (!allowInDialog && document.querySelector('dialog[open]') !== null) return
      const name = keyNameOf(e)
      // 버튼에 포커스가 있으면 Enter·Space 는 그 버튼의 클릭으로 처리되게 둔다
      if ((name === 'enter' || name === ' ') && e.target instanceof HTMLButtonElement) return
      const handler = ref.current[name]
      if (!handler) return
      e.preventDefault()
      e.stopPropagation()
      handler()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [enabled, allowInDialog])
}
