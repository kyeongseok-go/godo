import { describe, expect, it } from 'vitest'
import { keyNameOf } from './useDecisionKeys'

describe('keyNameOf', () => {
  it('uses the physical letter key so Korean input mode still works', () => {
    expect(keyNameOf({ code: 'KeyT', key: 'ㅅ' })).toBe('t')
    expect(keyNameOf({ code: 'KeyZ', key: 'Z' })).toBe('z')
  })

  it('reads digits from the top row and the numpad', () => {
    expect(keyNameOf({ code: 'Digit3', key: '3' })).toBe('3')
    expect(keyNameOf({ code: 'Numpad7', key: '7' })).toBe('7')
  })

  it('falls back to the lower-cased key for named keys and synthetic events', () => {
    expect(keyNameOf({ code: 'Backspace', key: 'Backspace' })).toBe('backspace')
    expect(keyNameOf({ code: 'ArrowRight', key: 'ArrowRight' })).toBe('arrowright')
    expect(keyNameOf({ code: '', key: 'T' })).toBe('t')
  })
})
