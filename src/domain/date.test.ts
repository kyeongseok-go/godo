import { addDays, addMonths, daysBetween, startOfWeek, todayOf, toISODate } from './date'

describe('date helpers', () => {
  test('addMonths clamps to the last day of the target month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29')
  })

  test('addDays crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  test('daysBetween is signed', () => {
    expect(daysBetween('2026-10-01', '2026-10-08')).toBe(7)
    expect(daysBetween('2026-10-08', '2026-10-01')).toBe(-7)
  })

  test('startOfWeek honours weekStartsOn', () => {
    // 2026-10-23 is a Friday
    expect(startOfWeek('2026-10-23', 1)).toBe('2026-10-19')
    expect(startOfWeek('2026-10-23', 0)).toBe('2026-10-18')
  })

  test('todayOf treats early morning as the previous day when dayStartHour is set', () => {
    const threeAm = new Date(2026, 9, 23, 3, 0)
    expect(todayOf(threeAm, 4)).toBe('2026-10-22')
    expect(todayOf(threeAm, 0)).toBe(toISODate(threeAm))
  })
})
