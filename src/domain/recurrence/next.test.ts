import type { RecurrenceRule } from '../types'
import { isRecurrenceFinished, nextOccurrence } from './next'

const rule = (o: Partial<RecurrenceRule> = {}): RecurrenceRule => ({
  freq: 'daily',
  interval: 1,
  anchor: 'due',
  end: { type: 'never' },
  resetSubtasks: false,
  ...o,
})

// 기준 달력: 2026-10-19 월, 10-21 수, 10-23 금, 10-26 월, 11-02 월
describe('nextOccurrence - daily', () => {
  test('adds one day for a daily rule', () => {
    expect(nextOccurrence(rule(), '2026-10-23', '2026-10-23')).toBe('2026-10-24')
  })

  test('adds the interval for every-N-days rules', () => {
    expect(nextOccurrence(rule({ interval: 3 }), '2026-10-23', '2026-10-23')).toBe('2026-10-26')
  })

  test('crosses month and year boundaries', () => {
    expect(nextOccurrence(rule(), '2026-10-31', '2026-10-31')).toBe('2026-11-01')
    expect(nextOccurrence(rule(), '2026-12-31', '2026-12-31')).toBe('2027-01-01')
  })
})

describe('nextOccurrence - weekly', () => {
  test('without byWeekday repeats on the weekday of from', () => {
    expect(nextOccurrence(rule({ freq: 'weekly' }), '2026-10-23', '2026-10-23')).toBe('2026-10-30')
  })

  test('without byWeekday and interval 2 skips one week', () => {
    expect(nextOccurrence(rule({ freq: 'weekly', interval: 2 }), '2026-10-23', '2026-10-23')).toBe('2026-11-06')
  })

  test('treats an empty byWeekday like a missing one', () => {
    expect(nextOccurrence(rule({ freq: 'weekly', byWeekday: [] }), '2026-10-23', '2026-10-23')).toBe('2026-10-30')
  })

  test('picks the next listed weekday within the same week', () => {
    const r = rule({ freq: 'weekly', byWeekday: [1, 3, 5] })
    expect(nextOccurrence(r, '2026-10-19', '2026-10-19')).toBe('2026-10-21')
    expect(nextOccurrence(r, '2026-10-21', '2026-10-21')).toBe('2026-10-23')
  })

  test('wraps to the first listed weekday of the next week', () => {
    const r = rule({ freq: 'weekly', byWeekday: [1, 3, 5] })
    expect(nextOccurrence(r, '2026-10-23', '2026-10-23')).toBe('2026-10-26')
  })

  test('ignores duplicate and unsorted weekdays', () => {
    const r = rule({ freq: 'weekly', byWeekday: [5, 1, 3, 1] })
    expect(nextOccurrence(r, '2026-10-19', '2026-10-19')).toBe('2026-10-21')
  })

  test('with interval 2 uses up the remaining weekdays of the week before jumping two weeks', () => {
    const r = rule({ freq: 'weekly', interval: 2, byWeekday: [1, 3, 5] })
    expect(nextOccurrence(r, '2026-10-19', '2026-10-19')).toBe('2026-10-21')
    expect(nextOccurrence(r, '2026-10-23', '2026-10-23')).toBe('2026-11-02')
  })

  test('every two weeks on a single weekday', () => {
    const r = rule({ freq: 'weekly', interval: 2, byWeekday: [2] })
    expect(nextOccurrence(r, '2026-10-27', '2026-10-27')).toBe('2026-11-10')
  })

  test('the weekdays preset skips the weekend', () => {
    const r = rule({ freq: 'weekly', byWeekday: [1, 2, 3, 4, 5] })
    expect(nextOccurrence(r, '2026-10-23', '2026-10-23')).toBe('2026-10-26')
    expect(nextOccurrence(r, '2026-10-21', '2026-10-21')).toBe('2026-10-22')
  })

  test('treats Sunday as the end of the week so a weekend stays together', () => {
    const r = rule({ freq: 'weekly', interval: 2, byWeekday: [6, 0] })
    expect(nextOccurrence(r, '2026-10-24', '2026-10-24')).toBe('2026-10-25')
    expect(nextOccurrence(r, '2026-10-25', '2026-10-25')).toBe('2026-11-07')
  })

  test('from a date that is not in byWeekday still finds the nearest listed day', () => {
    expect(nextOccurrence(rule({ freq: 'weekly', interval: 2, byWeekday: [1, 3] }), '2026-10-20', '2026-10-20')).toBe(
      '2026-10-21',
    )
    expect(nextOccurrence(rule({ freq: 'weekly', interval: 2, byWeekday: [1] }), '2026-10-22', '2026-10-22')).toBe(
      '2026-11-02',
    )
  })
})

describe('nextOccurrence - monthly', () => {
  test('repeats on byMonthDay', () => {
    const r = rule({ freq: 'monthly', byMonthDay: 25 })
    expect(nextOccurrence(r, '2026-10-25', '2026-10-25')).toBe('2026-11-25')
  })

  test('uses the day of from when byMonthDay is missing', () => {
    expect(nextOccurrence(rule({ freq: 'monthly' }), '2026-10-15', '2026-10-15')).toBe('2026-11-15')
  })

  test('remembers day 31 across short months', () => {
    const r = rule({ freq: 'monthly', byMonthDay: 31 })
    expect(nextOccurrence(r, '2026-01-31', '2026-01-31')).toBe('2026-02-28')
    expect(nextOccurrence(r, '2026-02-28', '2026-02-28')).toBe('2026-03-31')
    expect(nextOccurrence(r, '2026-03-31', '2026-03-31')).toBe('2026-04-30')
  })

  test('uses Feb 29 in leap years', () => {
    const r = rule({ freq: 'monthly', byMonthDay: 31 })
    expect(nextOccurrence(r, '2028-01-31', '2028-01-31')).toBe('2028-02-29')
    expect(nextOccurrence(r, '2028-02-29', '2028-02-29')).toBe('2028-03-31')
  })

  test('falls back to the month end when from has no byMonthDay and the day is missing', () => {
    expect(nextOccurrence(rule({ freq: 'monthly' }), '2026-01-31', '2026-01-31')).toBe('2026-02-28')
  })

  test('last means the final day of every month', () => {
    const r = rule({ freq: 'monthly', byMonthDay: 'last' })
    expect(nextOccurrence(r, '2026-02-28', '2026-02-28')).toBe('2026-03-31')
    expect(nextOccurrence(r, '2026-03-31', '2026-03-31')).toBe('2026-04-30')
    expect(nextOccurrence(r, '2027-12-31', '2027-12-31')).toBe('2028-01-31')
  })

  test('interval jumps whole months and rolls over the year', () => {
    expect(nextOccurrence(rule({ freq: 'monthly', interval: 2, byMonthDay: 15 }), '2026-10-15', '2026-10-15')).toBe(
      '2026-12-15',
    )
    expect(nextOccurrence(rule({ freq: 'monthly', interval: 3, byMonthDay: 15 }), '2026-11-15', '2026-11-15')).toBe(
      '2027-02-15',
    )
  })

  test('uses the remaining day of the same month when from is before byMonthDay', () => {
    const r = rule({ freq: 'monthly', byMonthDay: 25 })
    expect(nextOccurrence(r, '2026-10-15', '2026-10-15')).toBe('2026-10-25')
  })

  test('nth weekday: first Monday', () => {
    const r = rule({ freq: 'monthly', nth: { n: 1, weekday: 1 } })
    expect(nextOccurrence(r, '2026-10-05', '2026-10-05')).toBe('2026-11-02')
  })

  test('nth weekday: second Tuesday and fourth Sunday', () => {
    expect(nextOccurrence(rule({ freq: 'monthly', nth: { n: 2, weekday: 2 } }), '2026-10-13', '2026-10-13')).toBe(
      '2026-11-10',
    )
    expect(nextOccurrence(rule({ freq: 'monthly', nth: { n: 4, weekday: 0 } }), '2027-01-24', '2027-01-24')).toBe(
      '2027-02-28',
    )
  })

  test('nth weekday: last Friday follows the month length', () => {
    const r = rule({ freq: 'monthly', nth: { n: -1, weekday: 5 } })
    expect(nextOccurrence(r, '2026-10-30', '2026-10-30')).toBe('2026-11-27')
  })

  test('nth weekday with interval 2', () => {
    const r = rule({ freq: 'monthly', interval: 2, nth: { n: 1, weekday: 1 } })
    expect(nextOccurrence(r, '2026-10-05', '2026-10-05')).toBe('2026-12-07')
  })
})

describe('nextOccurrence - yearly', () => {
  test('adds one year', () => {
    expect(nextOccurrence(rule({ freq: 'yearly' }), '2026-03-02', '2026-03-02')).toBe('2027-03-02')
  })

  test('supports an interval', () => {
    expect(nextOccurrence(rule({ freq: 'yearly', interval: 2 }), '2026-03-02', '2026-03-02')).toBe('2028-03-02')
  })

  test('Feb 29 becomes Feb 28 in a common year', () => {
    expect(nextOccurrence(rule({ freq: 'yearly' }), '2028-02-29', '2028-02-29')).toBe('2029-02-28')
  })

  test('Feb 29 stays Feb 29 when the target year is a leap year', () => {
    expect(nextOccurrence(rule({ freq: 'yearly', interval: 4 }), '2028-02-29', '2028-02-29')).toBe('2032-02-29')
  })
})

describe('nextOccurrence - completion anchor', () => {
  const c = (o: Partial<RecurrenceRule>): RecurrenceRule => rule({ anchor: 'completion', ...o })

  test('daily counts from the completion day', () => {
    expect(nextOccurrence(c({ interval: 3 }), '2026-10-20', '2026-10-25')).toBe('2026-10-28')
  })

  test('weekly without byWeekday adds 7 * interval days', () => {
    expect(nextOccurrence(c({ freq: 'weekly', interval: 2 }), '2026-10-19', '2026-10-21')).toBe('2026-11-04')
  })

  test('weekly with byWeekday picks the first listed day after completion', () => {
    expect(nextOccurrence(c({ freq: 'weekly', byWeekday: [1] }), '2026-10-19', '2026-10-23')).toBe('2026-10-26')
    expect(nextOccurrence(c({ freq: 'weekly', byWeekday: [5] }), '2026-10-19', '2026-10-23')).toBe('2026-10-30')
  })

  test('weekly with byWeekday and interval 2 leaves out the following week first', () => {
    expect(nextOccurrence(c({ freq: 'weekly', interval: 2, byWeekday: [1] }), '2026-10-19', '2026-10-23')).toBe(
      '2026-11-02',
    )
  })

  test('monthly and yearly add the interval with month-end clamping', () => {
    expect(nextOccurrence(c({ freq: 'monthly' }), '2026-01-31', '2026-01-31')).toBe('2026-02-28')
    expect(nextOccurrence(c({ freq: 'yearly' }), '2028-02-29', '2028-02-29')).toBe('2029-02-28')
  })

  test('skips a date listed in skipDates', () => {
    expect(nextOccurrence(c({ skipDates: ['2026-10-26'] }), '2026-10-20', '2026-10-25')).toBe('2026-10-27')
  })
})

describe('nextOccurrence - overdue series', () => {
  test('fast-forwards a daily series to the first day after completion', () => {
    expect(nextOccurrence(rule(), '2026-10-01', '2026-10-23')).toBe('2026-10-24')
  })

  test('fast-forwards a weekly series to the next listed weekday after completion', () => {
    expect(nextOccurrence(rule({ freq: 'weekly', byWeekday: [1] }), '2026-10-05', '2026-10-23')).toBe('2026-10-26')
  })

  test('fast-forwards a monthly series', () => {
    expect(nextOccurrence(rule({ freq: 'monthly', byMonthDay: 15 }), '2026-01-15', '2026-10-23')).toBe('2026-11-15')
  })

  test('never returns the completion day itself', () => {
    expect(nextOccurrence(rule(), '2026-10-22', '2026-10-23')).toBe('2026-10-24')
    expect(nextOccurrence(rule({ freq: 'weekly', byWeekday: [5] }), '2026-10-16', '2026-10-23')).toBe('2026-10-30')
  })

  test('jumps past the 1000-step guard instead of ending the series', () => {
    expect(nextOccurrence(rule(), '2020-01-01', '2026-10-23')).toBe('2026-10-24')
  })

  test('completing early still moves forward from the scheduled date', () => {
    expect(nextOccurrence(rule(), '2026-10-30', '2026-10-23')).toBe('2026-10-31')
  })
})

describe('nextOccurrence - end conditions', () => {
  test('until includes the same day', () => {
    const r = rule({ end: { type: 'until', date: '2026-10-24' } })
    expect(nextOccurrence(r, '2026-10-23', '2026-10-23')).toBe('2026-10-24')
  })

  test('returns null when the next occurrence passes until', () => {
    const r = rule({ end: { type: 'until', date: '2026-10-23' } })
    expect(nextOccurrence(r, '2026-10-23', '2026-10-23')).toBeNull()
  })

  test('returns null when an overdue series is already past until', () => {
    const r = rule({ end: { type: 'until', date: '2026-10-10' } })
    expect(nextOccurrence(r, '2026-10-01', '2026-10-23')).toBeNull()
  })

  test('count ends the series when this completion reaches it', () => {
    expect(nextOccurrence(rule({ end: { type: 'count', count: 3 }, doneCount: 2 }), '2026-10-23', '2026-10-23')).toBeNull()
  })

  test('count continues while completions remain', () => {
    expect(nextOccurrence(rule({ end: { type: 'count', count: 3 }, doneCount: 1 }), '2026-10-23', '2026-10-23')).toBe(
      '2026-10-24',
    )
  })

  test('a missing doneCount counts as zero', () => {
    expect(nextOccurrence(rule({ end: { type: 'count', count: 1 } }), '2026-10-23', '2026-10-23')).toBeNull()
    expect(nextOccurrence(rule({ end: { type: 'count', count: 2 } }), '2026-10-23', '2026-10-23')).toBe('2026-10-24')
  })
})

describe('nextOccurrence - skipDates', () => {
  test('steps over a skipped date', () => {
    expect(nextOccurrence(rule({ skipDates: ['2026-10-24'] }), '2026-10-23', '2026-10-23')).toBe('2026-10-25')
  })

  test('steps over several consecutive skipped dates', () => {
    const r = rule({ skipDates: ['2026-10-24', '2026-10-25'] })
    expect(nextOccurrence(r, '2026-10-23', '2026-10-23')).toBe('2026-10-26')
  })

  test('steps over a skipped weekly occurrence', () => {
    const r = rule({ freq: 'weekly', byWeekday: [1, 3], skipDates: ['2026-10-21'] })
    expect(nextOccurrence(r, '2026-10-19', '2026-10-19')).toBe('2026-10-26')
  })

  test('returns null when skipping runs past until', () => {
    const r = rule({ end: { type: 'until', date: '2026-10-25' }, skipDates: ['2026-10-24', '2026-10-25'] })
    expect(nextOccurrence(r, '2026-10-23', '2026-10-23')).toBeNull()
  })

  test('survives a very long run of skipped dates', () => {
    const skipDates: string[] = []
    let d = new Date(2026, 9, 24)
    for (let i = 0; i < 1100; i++) {
      skipDates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
    }
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    expect(nextOccurrence(rule({ skipDates }), '2026-10-23', '2026-10-23')).toBe(expected)
  })
})

describe('nextOccurrence - safety', () => {
  test('does not mutate the rule', () => {
    const r = rule({ freq: 'weekly', byWeekday: [5, 1], skipDates: ['2026-10-26'], doneCount: 1 })
    const snapshot = JSON.stringify(r)
    nextOccurrence(r, '2026-10-23', '2026-10-23')
    expect(JSON.stringify(r)).toBe(snapshot)
  })

  test('treats an invalid interval as 1 instead of looping forever', () => {
    expect(nextOccurrence(rule({ interval: 0 }), '2026-10-23', '2026-10-23')).toBe('2026-10-24')
    expect(nextOccurrence(rule({ interval: Number.NaN }), '2026-10-23', '2026-10-23')).toBe('2026-10-24')
  })
})

describe('isRecurrenceFinished', () => {
  test('never is never finished', () => {
    expect(isRecurrenceFinished(rule(), '2099-01-01')).toBe(false)
  })

  test('until is finished only after the end date', () => {
    const r = rule({ end: { type: 'until', date: '2026-10-24' } })
    expect(isRecurrenceFinished(r, '2026-10-24')).toBe(false)
    expect(isRecurrenceFinished(r, '2026-10-25')).toBe(true)
  })

  test('count is finished once doneCount reaches it', () => {
    const r = rule({ end: { type: 'count', count: 3 } })
    expect(isRecurrenceFinished({ ...r, doneCount: 2 }, '2026-10-24')).toBe(false)
    expect(isRecurrenceFinished({ ...r, doneCount: 3 }, '2026-10-24')).toBe(true)
    expect(isRecurrenceFinished(r, '2026-10-24')).toBe(false)
  })
})

// 짧은 달에 밀린 날짜가 다시 원래 일로 돌아오는지(기준 일 고정)
describe('nextOccurrence - 말일·2월 29일 밀림 방지', () => {
  test('날짜를 안 정한 매월 반복도 1월 31일 기준을 기억한다', () => {
    const monthly = rule({ freq: 'monthly' })
    const feb = nextOccurrence(monthly, '2026-01-31', '2026-01-31')
    expect(feb).toBe('2026-02-28')
    // 2월 28일에서 이어서 계산해도 3월에는 31일로 돌아온다(기준 일이 규칙에 박혀 있어야 가능)
    const anchored = { ...monthly, byMonthDay: 31 as const }
    expect(nextOccurrence(anchored, '2026-02-28', '2026-02-28')).toBe('2026-03-31')
  })

  test('매년 반복은 2월 29일을 잊지 않는다', () => {
    const yearly = rule({ freq: 'yearly' })
    expect(nextOccurrence(yearly, '2024-02-29', '2024-02-29')).toBe('2025-02-28')
    const anchored = { ...yearly, byMonthDay: 29 as const }
    expect(nextOccurrence(anchored, '2025-02-28', '2025-02-28')).toBe('2026-02-28')
    expect(nextOccurrence(anchored, '2027-02-28', '2027-02-28')).toBe('2028-02-29')
  })

  test('n번째 요일 규칙은 기준 일을 끼워 넣지 않는다', () => {
    const nth = rule({ freq: 'monthly', nth: { n: 2, weekday: 1 } })
    expect(nextOccurrence(nth, '2026-10-12', '2026-10-12')).toBe('2026-11-09')
  })
})
