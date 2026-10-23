import { describe, expect, it } from 'vitest'
import { parseTabId, SETTINGS_TABS } from './tabs'

describe('settings tabs', () => {
  it('has the eight fixed lowercase ids in order', () => {
    expect(SETTINGS_TABS.map((t) => t.id)).toEqual([
      'general',
      'appearance',
      'modules',
      'notifications',
      'shortcuts',
      'data',
      'templates',
      'about',
    ])
  })

  it('gives every tab a label and a short label', () => {
    expect(SETTINGS_TABS.every((t) => t.label.length > 0 && t.short.length > 0)).toBe(true)
  })

  it('parses a known id', () => {
    expect(parseTabId('data')).toBe('data')
  })

  it('returns null for unknown or missing ids', () => {
    expect(parseTabId('DATA')).toBeNull()
    expect(parseTabId('nope')).toBeNull()
    expect(parseTabId(undefined)).toBeNull()
  })
})
