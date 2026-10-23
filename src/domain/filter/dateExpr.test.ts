import { describe, expect, it } from 'vitest'
import { parseDateExpr, resolveDateExpr } from './dateExpr'
import type { DateExpr } from './ast'
import { parseDurationMin } from './values'

function expr(text: string): DateExpr {
  const result = parseDateExpr(text)
  if (!result.ok) throw new Error(`날짜 파싱 실패: ${result.message}`)
  return result.expr
}

describe('parseDateExpr', () => {
  it('parses relative day words', () => {
    expect(expr('today')).toEqual({ kind: 'offset', days: 0 })
    expect(expr('  TODAY ')).toEqual({ kind: 'offset', days: 0 })
    expect(expr('tomorrow')).toEqual({ kind: 'offset', days: 1 })
    expect(expr('yesterday')).toEqual({ kind: 'offset', days: -1 })
    expect(expr('오늘')).toEqual({ kind: 'offset', days: 0 })
    expect(expr('내일')).toEqual({ kind: 'offset', days: 1 })
    expect(expr('모레')).toEqual({ kind: 'offset', days: 2 })
    expect(expr('어제')).toEqual({ kind: 'offset', days: -1 })
    expect(expr('그저께')).toEqual({ kind: 'offset', days: -2 })
  })

  it('parses day and week offsets in both languages', () => {
    expect(expr('in 3 days')).toEqual({ kind: 'offset', days: 3 })
    expect(expr('3 days ago')).toEqual({ kind: 'offset', days: -3 })
    expect(expr('3일 후')).toEqual({ kind: 'offset', days: 3 })
    expect(expr('3일뒤')).toEqual({ kind: 'offset', days: 3 })
    expect(expr('3일 전')).toEqual({ kind: 'offset', days: -3 })
    expect(expr('in 2 weeks')).toEqual({ kind: 'offset', days: 14 })
    expect(expr('1 week ago')).toEqual({ kind: 'offset', days: -7 })
    expect(expr('2주 후')).toEqual({ kind: 'offset', days: 14 })
    expect(expr('2주 전')).toEqual({ kind: 'offset', days: -14 })
  })

  it('parses next week and weekday names', () => {
    expect(expr('next week')).toEqual({ kind: 'nextWeek' })
    expect(expr('다음주')).toEqual({ kind: 'nextWeek' })
    expect(expr('다음 주')).toEqual({ kind: 'nextWeek' })
    expect(expr('Monday')).toEqual({ kind: 'weekday', weekday: 1 })
    expect(expr('sat')).toEqual({ kind: 'weekday', weekday: 6 })
    expect(expr('sunday')).toEqual({ kind: 'weekday', weekday: 0 })
    expect(expr('수요일')).toEqual({ kind: 'weekday', weekday: 3 })
  })

  it('parses numeric calendar dates', () => {
    expect(expr('2026-10-30')).toEqual({ kind: 'iso', date: '2026-10-30' })
    expect(expr('2026/1/5')).toEqual({ kind: 'iso', date: '2026-01-05' })
    expect(expr('2026.10.30')).toEqual({ kind: 'iso', date: '2026-10-30' })
    expect(expr('10/30')).toEqual({ kind: 'monthDay', month: 10, day: 30 })
    expect(expr('10.30')).toEqual({ kind: 'monthDay', month: 10, day: 30 })
    expect(expr('10/30/2027')).toEqual({ kind: 'iso', date: '2027-10-30' })
  })

  it('parses korean calendar dates', () => {
    expect(expr('10월 30일')).toEqual({ kind: 'monthDay', month: 10, day: 30 })
    expect(expr('10월30일')).toEqual({ kind: 'monthDay', month: 10, day: 30 })
    expect(expr('2027년 1월 5일')).toEqual({ kind: 'iso', date: '2027-01-05' })
    expect(expr('1월 5')).toEqual({ kind: 'monthDay', month: 1, day: 5 })
  })

  it('parses english month names', () => {
    expect(expr('Oct 30')).toEqual({ kind: 'monthDay', month: 10, day: 30 })
    expect(expr('October 30th')).toEqual({ kind: 'monthDay', month: 10, day: 30 })
    expect(expr('oct. 1st')).toEqual({ kind: 'monthDay', month: 10, day: 1 })
    expect(expr('Oct 30 2027')).toEqual({ kind: 'iso', date: '2027-10-30' })
    expect(expr('30 Oct')).toEqual({ kind: 'monthDay', month: 10, day: 30 })
    expect(expr('30 oct 2027')).toEqual({ kind: 'iso', date: '2027-10-30' })
    expect(expr('Sept 3')).toEqual({ kind: 'monthDay', month: 9, day: 3 })
  })

  it('accepts feb 29 only when it can exist', () => {
    expect(expr('2028-02-29')).toEqual({ kind: 'iso', date: '2028-02-29' })
    expect(expr('Feb 29')).toEqual({ kind: 'monthDay', month: 2, day: 29 })
    const impossible = parseDateExpr('2026-02-29')
    expect(impossible.ok).toBe(false)
  })

  it('reports impossible dates differently from unreadable text', () => {
    const impossible = parseDateExpr('4월 31일')
    expect(!impossible.ok && impossible.message).toContain('존재하지 않는')
    expect(parseDateExpr('2026-13-01').ok).toBe(false)
    expect(parseDateExpr('Oct 0').ok).toBe(false)
    const unreadable = parseDateExpr('someday maybe')
    expect(!unreadable.ok && unreadable.message).toContain('someday maybe')
    expect(parseDateExpr('Foo 3').ok).toBe(false)
    expect(parseDateExpr('').ok).toBe(false)
  })
})

describe('resolveDateExpr', () => {
  const FRIDAY = '2026-10-23'

  it('resolves offsets across month and year ends', () => {
    expect(resolveDateExpr({ kind: 'offset', days: 0 }, FRIDAY, 1)).toBe('2026-10-23')
    expect(resolveDateExpr({ kind: 'offset', days: 9 }, FRIDAY, 1)).toBe('2026-11-01')
    expect(resolveDateExpr({ kind: 'offset', days: 10 }, '2026-12-25', 1)).toBe('2027-01-04')
    expect(resolveDateExpr({ kind: 'offset', days: -1 }, '2026-03-01', 1)).toBe('2026-02-28')
    expect(resolveDateExpr({ kind: 'offset', days: -1 }, '2028-03-01', 1)).toBe('2028-02-29')
  })

  it('resolves the nearest weekday on or after today', () => {
    expect(resolveDateExpr({ kind: 'weekday', weekday: 5 }, FRIDAY, 1)).toBe('2026-10-23')
    expect(resolveDateExpr({ kind: 'weekday', weekday: 6 }, FRIDAY, 1)).toBe('2026-10-24')
    expect(resolveDateExpr({ kind: 'weekday', weekday: 4 }, FRIDAY, 1)).toBe('2026-10-29')
  })

  it('resolves next week from the configured week start', () => {
    expect(resolveDateExpr({ kind: 'nextWeek' }, FRIDAY, 1)).toBe('2026-10-26')
    expect(resolveDateExpr({ kind: 'nextWeek' }, FRIDAY, 0)).toBe('2026-10-25')
    expect(resolveDateExpr({ kind: 'nextWeek' }, '2026-10-26', 1)).toBe('2026-11-02')
  })

  it('uses the current year for month-day and clamps impossible days', () => {
    expect(resolveDateExpr({ kind: 'monthDay', month: 10, day: 30 }, FRIDAY, 1)).toBe('2026-10-30')
    expect(resolveDateExpr({ kind: 'monthDay', month: 2, day: 29 }, FRIDAY, 1)).toBe('2026-02-28')
    expect(resolveDateExpr({ kind: 'monthDay', month: 2, day: 29 }, '2028-06-01', 1)).toBe('2028-02-29')
    expect(resolveDateExpr({ kind: 'monthDay', month: 1, day: 5 }, '2027-12-31', 1)).toBe('2027-01-05')
  })

  it('returns iso dates unchanged', () => {
    expect(resolveDateExpr({ kind: 'iso', date: '2030-01-01' }, FRIDAY, 1)).toBe('2030-01-01')
  })
})

describe('parseDurationMin', () => {
  it('reads minutes, hours and combinations', () => {
    expect(parseDurationMin('30m')).toBe(30)
    expect(parseDurationMin('30분')).toBe(30)
    expect(parseDurationMin('45')).toBe(45)
    expect(parseDurationMin('2h')).toBe(120)
    expect(parseDurationMin('2시간')).toBe(120)
    expect(parseDurationMin('1h30m')).toBe(90)
    expect(parseDurationMin('1h 30m')).toBe(90)
    expect(parseDurationMin('1시간 30분')).toBe(90)
    expect(parseDurationMin('1.5h')).toBe(90)
    expect(parseDurationMin('90 mins')).toBe(90)
    expect(parseDurationMin('2 hours')).toBe(120)
  })

  it('rejects text it cannot read', () => {
    expect(parseDurationMin('')).toBeNull()
    expect(parseDurationMin('abc')).toBeNull()
    expect(parseDurationMin('30m x')).toBeNull()
    expect(parseDurationMin('m30')).toBeNull()
    expect(parseDurationMin('1h30')).toBeNull()
  })
})
