import type { Countdown } from '../types'
import { countdownInfo, nextCountdownDate } from './countdown'

let seq = 0
function makeCountdown(overrides: Partial<Countdown> = {}): Countdown {
  seq += 1
  return { id: `c${seq}`, name: '시험', date: '2026-10-26', color: '#d9421c', repeatYearly: false, order: 0, ...overrides }
}

describe('countdownInfo (one-off)', () => {
  test('counts down to a future date', () => {
    expect(countdownInfo(makeCountdown({ date: '2026-10-26' }), '2026-10-23')).toEqual({
      daysLeft: 3,
      label: 'D-3',
      passed: false,
    })
  })

  test('says D-DAY on the day itself', () => {
    expect(countdownInfo(makeCountdown({ date: '2026-10-23' }), '2026-10-23')).toEqual({
      daysLeft: 0,
      label: 'D-DAY',
      passed: false,
    })
  })

  test('counts up after the date has passed', () => {
    expect(countdownInfo(makeCountdown({ date: '2026-10-18' }), '2026-10-23')).toEqual({
      daysLeft: -5,
      label: 'D+5',
      passed: true,
    })
  })

  test('counts across month and year boundaries', () => {
    expect(countdownInfo(makeCountdown({ date: '2027-01-01' }), '2026-12-25').label).toBe('D-7')
    expect(countdownInfo(makeCountdown({ date: '2026-02-28' }), '2026-03-01').label).toBe('D+1')
  })
})

describe('nextCountdownDate', () => {
  test('returns the date itself for one-off countdowns', () => {
    expect(nextCountdownDate(makeCountdown({ date: '2020-05-05' }), '2026-10-23')).toBe('2020-05-05')
  })

  test('returns this year\'s anniversary when it has not passed', () => {
    const c = makeCountdown({ date: '2020-10-25', repeatYearly: true })
    expect(nextCountdownDate(c, '2026-10-23')).toBe('2026-10-25')
  })

  test('keeps today\'s anniversary as D-DAY', () => {
    const c = makeCountdown({ date: '2020-10-23', repeatYearly: true })
    expect(nextCountdownDate(c, '2026-10-23')).toBe('2026-10-23')
    expect(countdownInfo(c, '2026-10-23').label).toBe('D-DAY')
  })

  test('rolls to next year once the anniversary has passed', () => {
    const c = makeCountdown({ date: '2020-10-20', repeatYearly: true })
    expect(nextCountdownDate(c, '2026-10-23')).toBe('2027-10-20')
  })

  test('rolls across the new year', () => {
    const c = makeCountdown({ date: '2020-01-05', repeatYearly: true })
    expect(nextCountdownDate(c, '2026-12-31')).toBe('2027-01-05')
    expect(countdownInfo(c, '2026-12-31').label).toBe('D-5')
  })

  test('a repeating countdown set in the future waits for its first date', () => {
    const c = makeCountdown({ date: '2028-03-01', repeatYearly: true })
    expect(nextCountdownDate(c, '2026-10-23')).toBe('2028-03-01')
  })

  test('Feb 29 anniversaries fall back to Feb 28 in common years', () => {
    const c = makeCountdown({ date: '2024-02-29', repeatYearly: true })
    expect(nextCountdownDate(c, '2026-10-23')).toBe('2027-02-28')
    expect(nextCountdownDate(c, '2027-12-01')).toBe('2028-02-29')
  })

  test('a repeating countdown is never reported as passed', () => {
    const c = makeCountdown({ date: '2020-01-01', repeatYearly: true })
    const info = countdownInfo(c, '2026-10-23')
    expect(info.passed).toBe(false)
    expect(info.daysLeft).toBeGreaterThanOrEqual(0)
    expect(info.label).toBe(`D-${info.daysLeft}`)
  })
})
