import { useEffect, useRef } from 'react'
import { useApp } from '../../store/app'
import { useUI } from '../../store/ui'
import { isTypingTarget, matchSequence, normalizeKey } from './keymap'
import { effectiveKeys, useCommands } from './useCommands'

const SEQUENCE_TIMEOUT_MS = 1000
const PASS_THROUGH_WHEN_BUSY = 'mod+k'
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/** 문서 전체 keydown을 듣고 명령을 실행한다. 입력 중이거나 대화상자가 열려 있으면 글자 단축키는 막는다. */
export function useGlobalShortcuts(): void {
  const commands = useCommands()
  const overrides = useApp((s) => s.settings.shortcuts)
  const ref = useRef({ commands, overrides })
  ref.current = { commands, overrides }

  useEffect(() => {
    let buffer: string[] = []
    let timer: ReturnType<typeof setTimeout> | undefined
    const reset = () => {
      buffer = []
      clearTimeout(timer)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const token = normalizeKey(e, IS_MAC)
      if (!token) return

      // 포커스 이동용 복귀: 포커스가 행에 들어오면 선택 기준으로 기억해 둔다.
      const typing = isTypingTarget(e.target)
      const dialogOpen = document.querySelector('dialog[open]') !== null
      // 입력 중이거나 대화상자가 열려 있으면 명령 팔레트 열기(mod+k)만 허용한다.
      // 그 밖의 mod 조합(⌘Z, ⌘⌫, ⌘D, ⌘] 등)은 입력창의 기본 동작(글자 실행 취소 등)이어야지 앱 데이터를 바꾸면 안 된다.
      if ((typing || dialogOpen) && token !== PASS_THROUGH_WHEN_BUSY) return
      if (e.isComposing) return

      const bindings = ref.current.commands.flatMap((c) => {
        const keys = effectiveKeys(c, ref.current.overrides)
        return keys ? [{ keys, command: c }] : []
      })

      buffer = [...buffer, token]
      const result = matchSequence(bindings, buffer)
      clearTimeout(timer)

      if (result.kind === 'match') {
        e.preventDefault()
        reset()
        result.binding.command.run()
      } else if (result.kind === 'prefix') {
        e.preventDefault()
        timer = setTimeout(reset, SEQUENCE_TIMEOUT_MS)
      } else {
        // 시퀀스가 틀렸어도 방금 키가 단독 단축키일 수 있으니 한 번 더 시도한다.
        const retry = matchSequence(bindings, [token])
        buffer = []
        if (retry.kind === 'match') {
          e.preventDefault()
          retry.binding.command.run()
        } else if (retry.kind === 'prefix') {
          buffer = [token]
          e.preventDefault()
          timer = setTimeout(reset, SEQUENCE_TIMEOUT_MS)
        }
      }
    }

    const onFocusIn = (e: FocusEvent) => {
      const row = (e.target as HTMLElement | null)?.closest?.('[data-task-id]') as HTMLElement | null
      useUI.getState().setFocused(row?.dataset.taskId ?? null)
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('focusin', onFocusIn)
      clearTimeout(timer)
    }
  }, [])
}
