import { daysInMonth, firstOfMonth, monthGrid, nextWeekStart, shiftMonth, upcomingSaturday, weekDays, weekdayOrder } from './calendarGrid'

describe('monthGrid', () => {
  test('always yields 6 weeks of 7 days', () => {
    const grid = monthGrid('2026-02-15', 1)

    expect(grid).toHaveLength(6)
    expect(grid.every((w) => w.length === 7)).toBe(true)
  })

  test('starts on the configured weekday and marks out-of-month days', () => {
    // 2026-10-01 is a Thursday
    const monday = monthGrid('2026-10-10', 1)
    expect(monday[0][0].date).toBe('2026-09-28')
    expect(monday[0][0].inMonth).toBe(false)
    expect(monday[0][3].date).toBe('2026-10-01')
    expect(monday[0][3].inMonth).toBe(true)

    const sunday = monthGrid('2026-10-10', 0)
    expect(sunday[0][0].date).toBe('2026-09-27')
  })

  test('covers a leap-year February fully', () => {
    const days = monthGrid('2028-02-10', 0).flat().filter((c) => c.inMonth)

    expect(days).toHaveLength(29)
  })
})

describe('month helpers', () => {
  test('firstOfMonth and shiftMonth', () => {
    expect(firstOfMonth('2026-10-23')).toBe('2026-10-01')
    expect(shiftMonth('2026-10-23', 3)).toBe('2027-01-01')
    expect(shiftMonth('2026-01-31', -1)).toBe('2025-12-01')
  })

  test('daysInMonth handles leap years', () => {
    expect(daysInMonth('2028-02-01')).toBe(29)
    expect(daysInMonth('2026-02-01')).toBe(28)
  })
})

describe('weekdays', () => {
  test('weekDays returns seven consecutive days from the week start', () => {
    expect(weekDays('2026-10-23', 1)).toEqual([
      '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25',
    ])
  })

  test('weekdayOrder rotates for Monday start', () => {
    expect(weekdayOrder(0)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(weekdayOrder(1)).toEqual([1, 2, 3, 4, 5, 6, 0])
  })

  test('upcomingSaturday and nextWeekStart', () => {
    expect(upcomingSaturday('2026-10-23')).toBe('2026-10-24') // 금 → 토
    expect(upcomingSaturday('2026-10-24')).toBe('2026-10-24')
    expect(upcomingSaturday('2026-10-25')).toBe('2026-10-31') // 일 → 다음 토
    expect(nextWeekStart('2026-10-23', 1)).toBe('2026-10-26')
  })
})
