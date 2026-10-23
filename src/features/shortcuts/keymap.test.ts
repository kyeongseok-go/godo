import { findConflicts, formatKeys, isTypingTarget, matchSequence, normalizeKey } from './keymap'
import type { KeyLike } from './keymap'

const key = (k: string, over: Partial<KeyLike> = {}): KeyLike => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...over,
})

describe('normalizeKey', () => {
  test('lowercases letters and ignores bare modifier presses', () => {
    expect(normalizeKey(key('Q'), true)).toBe('q')
    expect(normalizeKey(key('Shift', { shiftKey: true }), true)).toBeNull()
  })

  test('maps the platform modifier to mod', () => {
    expect(normalizeKey(key('k', { metaKey: true }), true)).toBe('mod+k')
    expect(normalizeKey(key('k', { ctrlKey: true }), false)).toBe('mod+k')
  })

  test('keeps shift for letters and named keys but not for symbols', () => {
    expect(normalizeKey(key('z', { metaKey: true, shiftKey: true }), true)).toBe('mod+shift+z')
    expect(normalizeKey(key('?', { shiftKey: true }), true)).toBe('?')
    expect(normalizeKey(key('Enter', { shiftKey: true }), true)).toBe('shift+enter')
  })

  test('names space and escape', () => {
    expect(normalizeKey(key(' '), true)).toBe('space')
    expect(normalizeKey(key('Escape'), true)).toBe('escape')
  })
})

describe('normalizeKey with a Korean keyboard layout', () => {
  test('uses the physical key when key is a Hangul jamo', () => {
    expect(normalizeKey(key('ㅓ', { code: 'KeyJ' }), true)).toBe('j')
    expect(normalizeKey(key('ㅂ', { code: 'KeyQ' }), true)).toBe('q')
    expect(normalizeKey(key('ㅔ', { code: 'KeyP', shiftKey: true }), true)).toBe('shift+p')
  })

  test('ignores code for ordinary ASCII keys', () => {
    expect(normalizeKey(key('j', { code: 'KeyK' }), true)).toBe('j')
  })

  test('maps a non-ASCII digit row key by Digit code', () => {
    expect(normalizeKey(key('１', { code: 'Digit1' }), true)).toBe('1')
  })
})

describe('matchSequence', () => {
  const bindings = [{ keys: 'g i' }, { keys: 'g t' }, { keys: 'q' }, { keys: 'mod+k' }]

  test('matches a single key', () => {
    expect(matchSequence(bindings, ['q'])).toEqual({ kind: 'match', binding: bindings[2] })
  })

  test('reports a prefix while a sequence is incomplete', () => {
    expect(matchSequence(bindings, ['g'])).toEqual({ kind: 'prefix' })
  })

  test('matches a full sequence', () => {
    expect(matchSequence(bindings, ['g', 'i'])).toEqual({ kind: 'match', binding: bindings[0] })
  })

  test('returns none for unknown input', () => {
    expect(matchSequence(bindings, ['g', 'z'])).toEqual({ kind: 'none' })
    expect(matchSequence(bindings, ['x'])).toEqual({ kind: 'none' })
  })
})

describe('isTypingTarget', () => {
  test('is true for text inputs, textareas and contenteditable', () => {
    const input = document.createElement('input')
    const area = document.createElement('textarea')
    const box = document.createElement('input')
    box.type = 'checkbox'
    const editable = document.createElement('div')
    Object.defineProperty(editable, 'isContentEditable', { value: true })

    expect(isTypingTarget(input)).toBe(true)
    expect(isTypingTarget(area)).toBe(true)
    expect(isTypingTarget(editable)).toBe(true)
    expect(isTypingTarget(box)).toBe(false)
    expect(isTypingTarget(document.createElement('button'))).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})

describe('formatKeys', () => {
  test('uses mac symbols or plain names', () => {
    expect(formatKeys('mod+shift+z', true)).toBe('⌘⇧Z')
    expect(formatKeys('mod+shift+z', false)).toBe('Ctrl+Shift+Z')
    expect(formatKeys('g i', true)).toBe('G I')
  })
})

describe('findConflicts', () => {
  test('reports keys shared by more than one command', () => {
    const conflicts = findConflicts([
      { id: 'a', keys: 'q' },
      { id: 'b', keys: 'q' },
      { id: 'c', keys: 'w' },
    ])

    expect([...conflicts.keys()]).toEqual(['q'])
    expect(conflicts.get('q')).toEqual(['a', 'b'])
  })
})
