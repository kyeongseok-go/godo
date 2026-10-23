// 키 입력을 문자열로 정규화하고, 'g i' 같은 시퀀스 단축키를 해석한다. DOM에 의존하지 않는 순수 로직이다.

export interface KeyLike {
  key: string
  /** 물리 키 코드('KeyJ'). 한글 입력 상태에서는 key가 'ㅓ'처럼 나오므로 영문 키 판별에 쓴다. */
  code?: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
}

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'])

/** 한글 등 비영문 자판 상태에서도 물리 키(KeyJ → j, Digit1 → 1)로 영문 단축키를 인식한다. */
function latinKeyOf(e: KeyLike): string {
  const key = e.key.toLowerCase()
  if (e.key.length === 1 && !/^[\x00-\x7f]$/.test(e.key) && e.code) {
    const letter = /^Key([A-Z])$/.exec(e.code)
    if (letter) return letter[1].toLowerCase()
    const digit = /^Digit(\d)$/.exec(e.code)
    if (digit) return digit[1]
  }
  return key
}

/** `mod`는 맥에서는 ⌘, 그 외에는 Ctrl이다. 대문자 한 글자는 소문자로 접고 shift는 따로 표시한다. */
export function normalizeKey(e: KeyLike, isMac: boolean): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null
  const parts: string[] = []
  const mod = isMac ? e.metaKey : e.ctrlKey
  if (mod) parts.push('mod')
  if (!isMac && e.metaKey) parts.push('meta')
  if (isMac && e.ctrlKey) parts.push('ctrl')
  if (e.altKey) parts.push('alt')
  const key = latinKeyOf(e)
  // '?', '/' 같은 기호는 shift 표시가 의미 없으므로 글자 키일 때만 shift를 붙인다.
  const isLetter = /^[a-z]$/.test(key)
  if (e.shiftKey && (isLetter || key.length > 1)) parts.push('shift')
  parts.push(key === ' ' ? 'space' : key)
  return parts.join('+')
}

export type MatchResult<T> = { kind: 'match'; binding: T } | { kind: 'prefix' } | { kind: 'none' }

export interface Binding {
  /** 'q', 'mod+k', 'g i' (공백으로 이은 시퀀스) */
  keys: string
}

export function matchSequence<T extends Binding>(bindings: readonly T[], buffer: readonly string[]): MatchResult<T> {
  const typed = buffer.join(' ')
  let prefix = false
  for (const b of bindings) {
    if (b.keys === typed) return { kind: 'match', binding: b }
    if (b.keys.startsWith(`${typed} `)) prefix = true
  }
  return prefix ? { kind: 'prefix' } : { kind: 'none' }
}

/** 입력창·편집 영역에서는 글자 단축키를 막는다. 수식키 조합과 Esc는 예외다. */
export function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  const tag = el.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type
    return !['checkbox', 'radio', 'button', 'submit'].includes(type)
  }
  return false
}

/** 화면에 보일 키 이름. 'mod+k' → '⌘K' (맥) / 'Ctrl K' */
export function formatKeys(keys: string, isMac: boolean): string {
  return keys
    .split(' ')
    .map((chord) =>
      chord
        .split('+')
        .map((p) => {
          if (p === 'mod') return isMac ? '⌘' : 'Ctrl'
          if (p === 'shift') return isMac ? '⇧' : 'Shift'
          if (p === 'alt') return isMac ? '⌥' : 'Alt'
          if (p === 'ctrl') return isMac ? '⌃' : 'Ctrl'
          if (p === 'backspace') return '⌫'
          if (p === 'enter') return '↵'
          if (p === 'escape') return 'Esc'
          if (p === 'space') return 'Space'
          return p.length === 1 ? p.toUpperCase() : p
        })
        .join(isMac ? '' : '+'),
    )
    .join(' ')
}

/** 같은 키 시퀀스가 둘 이상의 명령에 걸려 있는지 찾는다(사용자 지정 때 충돌 경고용). */
export function findConflicts(entries: ReadonlyArray<{ id: string; keys: string }>): Map<string, string[]> {
  const byKeys = new Map<string, string[]>()
  for (const e of entries) byKeys.set(e.keys, [...(byKeys.get(e.keys) ?? []), e.id])
  return new Map([...byKeys].filter(([, ids]) => ids.length > 1))
}
