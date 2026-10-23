import { dayOfMonthClamped, formatYMD, mondayIndex, nthWeekdayOfMonth, parseYMD, shiftMonth } from './calendar'

describe('calendar helpers', () => {
  test('parseYMD and formatYMD round-trip', () => {
    expect(parseYMD('2026-10-05')).toEqual({ year: 2026, month: 10, day: 5 })
    expect(formatYMD(2026, 3, 9)).toBe('2026-03-09')
  })

  test('mondayIndex puts Monday first and Sunday last', () => {
    expect(mondayIndex(1)).toBe(0)
    expect(mondayIndex(6)).toBe(5)
    expect(mondayIndex(0)).toBe(6)
  })

  test('shiftMonth rolls over year boundaries in both directions', () => {
    expect(shiftMonth(2026, 11, 3)).toEqual({ year: 2027, month: 2 })
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 })
    expect(shiftMonth(2026, 12, 12)).toEqual({ year: 2027, month: 12 })
  })

  test('dayOfMonthClamped clamps to the last day, honouring leap years', () => {
    expect(dayOfMonthClamped(2026, 2, 31)).toBe('2026-02-28')
    expect(dayOfMonthClamped(2028, 2, 31)).toBe('2028-02-29')
    expect(dayOfMonthClamped(2026, 4, 'last')).toBe('2026-04-30')
    expect(dayOfMonthClamped(2026, 4, 15)).toBe('2026-04-15')
  })

  test('nthWeekdayOfMonth finds the first to fourth weekday', () => {
    // 2026-10-01 is a Thursday
    expect(nthWeekdayOfMonth(2026, 10, 1, 4)).toBe('2026-10-01')
    expect(nthWeekdayOfMonth(2026, 10, 1, 1)).toBe('2026-10-05')
    expect(nthWeekdayOfMonth(2026, 10, 4, 1)).toBe('2026-10-26')
    expect(nthWeekdayOfMonth(2027, 2, 4, 0)).toBe('2027-02-28')
  })

  test('nthWeekdayOfMonth with -1 finds the last weekday of the month', () => {
    expect(nthWeekdayOfMonth(2026, 10, -1, 5)).toBe('2026-10-30')
    expect(nthWeekdayOfMonth(2026, 10, -1, 6)).toBe('2026-10-31')
    expect(nthWeekdayOfMonth(2026, 11, -1, 5)).toBe('2026-11-27')
    expect(nthWeekdayOfMonth(2028, 2, -1, 2)).toBe('2028-02-29')
  })
})
