import { defaultSettings, mergeSettings } from './defaults'

describe('mergeSettings', () => {
  test('returns the defaults when nothing is stored', () => {
    expect(mergeSettings(null)).toEqual(defaultSettings())
  })

  test('keeps stored values and fills new nested fields', () => {
    const merged = mergeSettings({ density: 'compact', productivity: { karmaEnabled: false } } as never)

    expect(merged.density).toBe('compact')
    expect(merged.productivity.karmaEnabled).toBe(false)
    expect(merged.productivity.dailyGoal).toBe(defaultSettings().productivity.dailyGoal)
  })

  test('replaces arrays instead of merging them and ignores undefined', () => {
    const merged = mergeSettings({ productivity: { daysOff: [1], vacationMode: undefined } } as never)

    expect(merged.productivity.daysOff).toEqual([1])
    expect(merged.productivity.vacationMode).toBe(false)
  })
})
