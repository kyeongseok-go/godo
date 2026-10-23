import { describe, expect, it } from 'vitest'
import { describeConflicts, findKeyConflicts, isChord, pushCaptureKey, setShortcut } from './shortcutBindings'

describe('isChord', () => {
  it('is true for tokens with mod, alt, ctrl or meta', () => {
    expect(isChord('mod+k')).toBe(true)
    expect(isChord('alt+x')).toBe(true)
    expect(isChord('ctrl+a')).toBe(true)
    expect(isChord('meta+a')).toBe(true)
  })

  it('is false for plain and shifted keys', () => {
    expect(isChord('g')).toBe(false)
    expect(isChord('shift+a')).toBe(false)
    expect(isChord('?')).toBe(false)
    expect(isChord('escape')).toBe(false)
  })
})

describe('pushCaptureKey', () => {
  it('finishes immediately on a modifier chord', () => {
    expect(pushCaptureKey(null, 'mod+k')).toEqual({ keys: 'mod+k', done: true })
  })

  it('waits for a second key after a plain first key', () => {
    expect(pushCaptureKey(null, 'g')).toEqual({ keys: 'g', done: false })
  })

  it('finishes a two-key sequence on the second key', () => {
    expect(pushCaptureKey('g', 'i')).toEqual({ keys: 'g i', done: true })
  })

  it('never builds a sequence longer than two keys', () => {
    expect(pushCaptureKey('g i', 'x')).toEqual({ keys: 'g i', done: true })
  })
})

describe('setShortcut', () => {
  const withDefault = { id: 'go.today', keys: 'g t' }
  const withoutDefault = { id: 'go.timeline', keys: undefined }

  it('stores a custom key without touching the original object', () => {
    const before = { 'app.help': '?' }

    const after = setShortcut(before, withDefault, 'g y')

    expect(after).toEqual({ 'app.help': '?', 'go.today': 'g y' })
    expect(before).toEqual({ 'app.help': '?' })
  })

  it('drops the override when the new key equals the default', () => {
    expect(setShortcut({ 'go.today': 'g y' }, withDefault, 'g t')).toEqual({})
  })

  it('stores an empty string to turn a default shortcut off', () => {
    expect(setShortcut({}, withDefault, '')).toEqual({ 'go.today': '' })
  })

  it('does not store an empty override for a command that has no default', () => {
    expect(setShortcut({ 'go.timeline': 'g l' }, withoutDefault, '')).toEqual({})
  })

  it('resets to the default when keys is null', () => {
    expect(setShortcut({ 'go.today': '' }, withDefault, null)).toEqual({})
  })
})

describe('findKeyConflicts', () => {
  const entry = (id: string, keys: string) => ({ id, title: id.toUpperCase(), keys })

  it('returns nothing when all keys are distinct', () => {
    expect(findKeyConflicts([entry('a', 'g i'), entry('b', 'g t')]).size).toBe(0)
  })

  it('reports commands that share the same keys, each pointing at the other', () => {
    const conflicts = findKeyConflicts([entry('a', 'q'), entry('b', 'q'), entry('c', 'x')])

    expect(conflicts.get('a')).toEqual([{ kind: 'same', other: entry('b', 'q') }])
    expect(conflicts.get('b')).toEqual([{ kind: 'same', other: entry('a', 'q') }])
    expect(conflicts.has('c')).toBe(false)
  })

  it('reports a single key that hides a sequence starting with it', () => {
    const conflicts = findKeyConflicts([entry('short', 'g'), entry('long', 'g i')])

    expect(conflicts.get('short')).toEqual([{ kind: 'hides', other: entry('long', 'g i') }])
    expect(conflicts.get('long')).toEqual([{ kind: 'hidden', other: entry('short', 'g') }])
  })

  it('handles three-way duplicates', () => {
    const conflicts = findKeyConflicts([entry('a', 'q'), entry('b', 'q'), entry('c', 'q')])

    expect(conflicts.get('a')?.map((c) => c.other.id)).toEqual(['b', 'c'])
  })
})

describe('describeConflicts', () => {
  const entry = (id: string, keys: string) => ({ id, title: `명령 ${id}`, keys })

  it('returns no sentences without conflicts', () => {
    expect(describeConflicts([])).toEqual([])
  })

  it('writes one sentence per kind', () => {
    const sentences = describeConflicts([
      { kind: 'same', other: entry('a', 'q') },
      { kind: 'same', other: entry('b', 'q') },
      { kind: 'hides', other: entry('c', 'g i') },
      { kind: 'hidden', other: entry('d', 'g') },
    ])

    expect(sentences).toEqual([
      '같은 키를 쓰는 명령이 있어요: ‘명령 a’, ‘명령 b’',
      '이 키가 먼저 실행돼서 ‘명령 c’의 단축키가 동작하지 않아요',
      '‘명령 d’의 단축키가 먼저 실행돼서 이 단축키는 동작하지 않아요',
    ])
  })
})
