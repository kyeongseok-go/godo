// 단축키 지정 화면의 순수 로직: 키 캡처 단계, 사용자 지정 저장 값 계산, 충돌 찾기.
import { findConflicts } from '../shortcuts/keymap'

const CHORD_PREFIXES = ['mod+', 'alt+', 'ctrl+', 'meta+']
const MAX_SEQUENCE = 2

/** 수식키(⌘/Ctrl/Alt)가 붙은 조합이면 한 번에 끝난다. Shift 만 붙은 글자는 일반 키로 본다. */
export function isChord(token: string): boolean {
  return CHORD_PREFIXES.some((prefix) => token.includes(prefix))
}

export interface CaptureStep {
  keys: string
  /** true 면 더 기다리지 않고 확정한다. false 면 두 번째 키를 잠시 기다린다. */
  done: boolean
}

/** 눌린 키 토큰(normalizeKey 결과)을 지금까지 입력에 이어 붙인다. 시퀀스는 두 키까지다. */
export function pushCaptureKey(pending: string | null, token: string): CaptureStep {
  if (pending === null) return { keys: token, done: isChord(token) }
  if (pending.split(' ').length >= MAX_SEQUENCE) return { keys: pending, done: true }
  return { keys: `${pending} ${token}`, done: true }
}

/**
 * 사용자 지정 단축키 저장 값을 새로 계산한다(원본은 바꾸지 않는다).
 * keys: null 이면 기본값으로 되돌리기, '' 이면 단축키 끄기, 그 밖에는 그 키로 지정.
 */
export function setShortcut(
  current: Readonly<Record<string, string>>,
  command: { id: string; keys?: string },
  keys: string | null,
): Record<string, string> {
  const rest = Object.fromEntries(Object.entries(current).filter(([id]) => id !== command.id))
  if (keys === null) return rest
  if (keys === '') return command.keys === undefined ? rest : { ...rest, [command.id]: '' }
  return keys === command.keys ? rest : { ...rest, [command.id]: keys }
}

export interface KeyEntry {
  id: string
  title: string
  keys: string
}

export interface KeyConflict {
  /**
   * same: 같은 키 / hides: 이 키가 먼저 실행돼 상대의 시퀀스가 막힘 / hidden: 상대가 먼저 실행돼 이 시퀀스가 막힘
   */
  kind: 'same' | 'hides' | 'hidden'
  other: KeyEntry
}

function push(map: Map<string, KeyConflict[]>, id: string, conflict: KeyConflict): void {
  map.set(id, [...(map.get(id) ?? []), conflict])
}

/** 명령 id → 겹치는 명령 목록. 같은 키뿐 아니라 "g"와 "g i"처럼 앞 키가 뒤 시퀀스를 막는 경우도 찾는다. */
export function findKeyConflicts(entries: readonly KeyEntry[]): Map<string, KeyConflict[]> {
  const result = new Map<string, KeyConflict[]>()
  const byId = new Map(entries.map((e) => [e.id, e]))

  for (const ids of findConflicts(entries).values()) {
    for (const id of ids) {
      for (const otherId of ids) {
        const other = byId.get(otherId)
        if (otherId !== id && other) push(result, id, { kind: 'same', other })
      }
    }
  }

  for (const longer of entries) {
    const first = longer.keys.split(' ')[0]
    if (first === longer.keys) continue
    for (const shorter of entries.filter((e) => e.keys === first)) {
      push(result, shorter.id, { kind: 'hides', other: longer })
      push(result, longer.id, { kind: 'hidden', other: shorter })
    }
  }
  return result
}

const titles = (items: readonly KeyConflict[]): string => items.map((c) => `‘${c.other.title}’`).join(', ')

/** 충돌 목록을 사용자에게 보여 줄 한국어 문장으로 풀어 쓴다. 종류별로 한 문장씩. */
export function describeConflicts(conflicts: readonly KeyConflict[]): string[] {
  const of = (kind: KeyConflict['kind']): KeyConflict[] => conflicts.filter((c) => c.kind === kind)
  const same = of('same')
  const hides = of('hides')
  const hidden = of('hidden')
  return [
    ...(same.length > 0 ? [`같은 키를 쓰는 명령이 있어요: ${titles(same)}`] : []),
    ...(hides.length > 0 ? [`이 키가 먼저 실행돼서 ${titles(hides)}의 단축키가 동작하지 않아요`] : []),
    ...(hidden.length > 0 ? [`${titles(hidden)}의 단축키가 먼저 실행돼서 이 단축키는 동작하지 않아요`] : []),
  ]
}
