import { describe, expect, it } from 'vitest'
import { DEFAULT_ACCENT, PALETTE } from '../../store/defaults'
import { ACCENT_PRESET_COUNT, accentName, accentPresets, contrastRatio, isAccentReadable } from './accent'

describe('contrastRatio', () => {
  it('is 21 between black and white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
  })

  it('is 1 for the same color and symmetric', () => {
    expect(contrastRatio('#c8360f', '#c8360f')).toBeCloseTo(1, 5)
    expect(contrastRatio('#2b4c7e', '#ffffff')).toBeCloseTo(contrastRatio('#ffffff', '#2b4c7e'), 5)
  })

  it('understands three-digit hex', () => {
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 1)
  })

  it('returns NaN for invalid colors', () => {
    expect(contrastRatio('red', '#000')).toBeNaN()
  })
})

describe('isAccentReadable', () => {
  it('accepts the default signal color', () => {
    expect(isAccentReadable(DEFAULT_ACCENT)).toBe(true)
  })

  it('rejects the old, lighter signal color that fell just under AA on white', () => {
    expect(isAccentReadable('#d9421c')).toBe(false)
  })

  it('rejects a pale yellow that white text cannot sit on', () => {
    expect(isAccentReadable('#f2e394')).toBe(false)
  })

  it('rejects the mustard in the palette', () => {
    expect(isAccentReadable('#b8860b')).toBe(false)
  })

  it('rejects near-black colors that vanish on the dark paper', () => {
    expect(isAccentReadable('#111111')).toBe(false)
  })

  it('rejects invalid values', () => {
    expect(isAccentReadable('주홍')).toBe(false)
  })
})

describe('accentPresets', () => {
  it('picks six readable colors from the palette in palette order', () => {
    const presets = accentPresets(PALETTE)

    expect(presets).toHaveLength(ACCENT_PRESET_COUNT)
    expect(presets[0]).toBe(DEFAULT_ACCENT)
    expect(presets.every((c) => PALETTE.includes(c as (typeof PALETTE)[number]))).toBe(true)
    expect(presets.every(isAccentReadable)).toBe(true)
  })

  it('skips unreadable colors', () => {
    expect(accentPresets(['#f2e394', DEFAULT_ACCENT])).toEqual([DEFAULT_ACCENT])
  })
})

describe('accentName', () => {
  it('names known colors and falls back for others', () => {
    expect(accentName(DEFAULT_ACCENT)).toBe('청록')
    expect(accentName('#123456')).toBe('사용자 지정')
  })
})
