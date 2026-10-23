import { snoozeUntil, SNOOZE_CHOICES } from './snooze'

const local = (y: number, m: number, d: number, h: number, min = 0): number => new Date(y, m - 1, d, h, min).getTime()

describe('snoozeUntil', () => {
  const now = local(2026, 10, 24, 15, 20)

  test('adds ten minutes', () => {
    expect(snoozeUntil('10m', now, '09:00')).toBe(now + 10 * 60_000)
  })

  test('adds one hour', () => {
    expect(snoozeUntil('1h', now, '09:00')).toBe(now + 60 * 60_000)
  })

  test('moves to the next morning at the work start time', () => {
    expect(snoozeUntil('tomorrow', now, '08:30')).toBe(local(2026, 10, 25, 8, 30))
  })

  test('rolls over the end of the month', () => {
    expect(snoozeUntil('tomorrow', local(2026, 10, 31, 23, 59), '09:00')).toBe(local(2026, 11, 1, 9, 0))
  })

  test('falls back to 09:00 when the work start is malformed', () => {
    expect(snoozeUntil('tomorrow', now, 'abc')).toBe(local(2026, 10, 25, 9, 0))
  })

  test('lists the three choices with Korean labels', () => {
    expect(SNOOZE_CHOICES.map((c) => c.label)).toEqual(['10분 뒤', '1시간 뒤', '내일 아침'])
  })
})
