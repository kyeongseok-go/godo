import { formatClock, spokenTime } from './clock'

describe('formatClock', () => {
  test('counts down with ceiling so 00:00 only appears at completion', () => {
    expect(formatClock(25 * 60_000, 'down')).toBe('25:00')
    expect(formatClock(24 * 60_000 + 59_001, 'down')).toBe('25:00')
    expect(formatClock(59_001, 'down')).toBe('01:00')
    expect(formatClock(1, 'down')).toBe('00:01')
    expect(formatClock(0, 'down')).toBe('00:00')
  })

  test('counts up with floor', () => {
    expect(formatClock(999, 'up')).toBe('00:00')
    expect(formatClock(61_999, 'up')).toBe('01:01')
  })

  test('adds an hour part from one hour on', () => {
    expect(formatClock(3_600_000, 'up')).toBe('1:00:00')
    expect(formatClock(3_600_000 + 5 * 60_000 + 9_000, 'up')).toBe('1:05:09')
  })

  test('treats negative and invalid input as zero', () => {
    expect(formatClock(-5_000, 'down')).toBe('00:00')
    expect(formatClock(Number.NaN, 'up')).toBe('00:00')
  })
})

describe('spokenTime', () => {
  test('reads minutes and seconds in Korean for screen readers', () => {
    expect(spokenTime(24 * 60_000 + 59_000)).toBe('24분 59초')
    expect(spokenTime(45_000)).toBe('45초')
    expect(spokenTime(2 * 3_600_000 + 60_000)).toBe('2시간 1분')
    expect(spokenTime(0)).toBe('0초')
  })
})
