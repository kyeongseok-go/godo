import type { RecurrenceRule } from '../types'
import { presetRule, validateRule } from './validate'

const rule = (o: Partial<RecurrenceRule> = {}): RecurrenceRule => ({
  freq: 'daily',
  interval: 1,
  anchor: 'due',
  end: { type: 'never' },
  resetSubtasks: false,
  ...o,
})

const asRule = (o: Record<string, unknown>): RecurrenceRule => ({ ...rule(), ...o }) as unknown as RecurrenceRule

function messageOf(r: RecurrenceRule): string {
  const result = validateRule(r)
  if (result.ok) throw new Error('expected an invalid rule')
  return result.message
}

describe('validateRule', () => {
  test('accepts a plain valid rule', () => {
    expect(validateRule(rule())).toEqual({ ok: true })
  })

  test('accepts a fully specified valid rule', () => {
    const r = rule({
      freq: 'monthly',
      interval: 2,
      byMonthDay: 'last',
      end: { type: 'until', date: '2027-01-31' },
      doneCount: 0,
      skipDates: ['2026-10-23'],
    })
    expect(validateRule(r)).toEqual({ ok: true })
  })

  test('rejects an unknown freq', () => {
    expect(messageOf(asRule({ freq: 'hourly' }))).toMatch(/주기/)
  })

  test.each([0, -1, 1.5, Number.NaN])('rejects interval %s', (interval) => {
    expect(messageOf(rule({ interval }))).toMatch(/간격/)
  })

  test.each([0, 32, 1.5, -1])('rejects byMonthDay %s', (byMonthDay) => {
    expect(messageOf(rule({ freq: 'monthly', byMonthDay }))).toMatch(/1~31/)
  })

  test('accepts byMonthDay 1, 31 and last', () => {
    expect(validateRule(rule({ freq: 'monthly', byMonthDay: 1 })).ok).toBe(true)
    expect(validateRule(rule({ freq: 'monthly', byMonthDay: 31 })).ok).toBe(true)
    expect(validateRule(rule({ freq: 'monthly', byMonthDay: 'last' })).ok).toBe(true)
  })

  test('rejects an unknown byMonthDay string', () => {
    expect(messageOf(asRule({ freq: 'monthly', byMonthDay: 'first' }))).toMatch(/1~31/)
  })

  test('rejects an invalid nth.n or nth.weekday', () => {
    expect(messageOf(asRule({ freq: 'monthly', nth: { n: 5, weekday: 1 } }))).toMatch(/번째/)
    expect(messageOf(asRule({ freq: 'monthly', nth: { n: 0, weekday: 1 } }))).toMatch(/번째/)
    expect(messageOf(asRule({ freq: 'monthly', nth: { n: 1, weekday: 7 } }))).toMatch(/요일/)
  })

  test('accepts nth.n of 1 to 4 and -1', () => {
    for (const n of [1, 2, 3, 4, -1]) {
      expect(validateRule(asRule({ freq: 'monthly', nth: { n, weekday: 1 } })).ok).toBe(true)
    }
  })

  test('rejects byMonthDay together with nth', () => {
    expect(messageOf(rule({ freq: 'monthly', byMonthDay: 5, nth: { n: 1, weekday: 1 } }))).toMatch(/하나만/)
  })

  test('rejects an out-of-range weekday in byWeekday', () => {
    expect(messageOf(asRule({ freq: 'weekly', byWeekday: [1, 7] }))).toMatch(/요일/)
    expect(messageOf(asRule({ freq: 'weekly', byWeekday: [-1] }))).toMatch(/요일/)
    expect(messageOf(asRule({ freq: 'weekly', byWeekday: [1.5] }))).toMatch(/요일/)
  })

  test('accepts an empty byWeekday', () => {
    expect(validateRule(rule({ freq: 'weekly', byWeekday: [] })).ok).toBe(true)
  })

  test('rejects a malformed until date', () => {
    expect(messageOf(rule({ end: { type: 'until', date: '2026-02-30' } }))).toMatch(/종료 날짜/)
    expect(messageOf(rule({ end: { type: 'until', date: '내일' } }))).toMatch(/종료 날짜/)
  })

  test.each([0, -2, 1.5])('rejects count %s', (count) => {
    expect(messageOf(rule({ end: { type: 'count', count } }))).toMatch(/횟수/)
  })

  test('accepts count 1', () => {
    expect(validateRule(rule({ end: { type: 'count', count: 1 } })).ok).toBe(true)
  })

  test('rejects a negative or fractional doneCount', () => {
    expect(messageOf(rule({ doneCount: -1 }))).toMatch(/완료 횟수/)
    expect(messageOf(rule({ doneCount: 0.5 }))).toMatch(/완료 횟수/)
  })

  test('rejects a malformed skipDates entry', () => {
    expect(messageOf(rule({ skipDates: ['2026-10-23', 'abc'] }))).toMatch(/건너뛴 날짜/)
  })

  test('reports every message in Korean', () => {
    const messages = [
      messageOf(rule({ interval: 0 })),
      messageOf(rule({ freq: 'monthly', byMonthDay: 40 })),
      messageOf(rule({ end: { type: 'count', count: 0 } })),
    ]
    messages.forEach((m) => expect(m).toMatch(/[가-힣]/))
  })
})

describe('presetRule', () => {
  test('daily', () => {
    expect(presetRule('daily', '2026-10-23')).toEqual({
      freq: 'daily',
      interval: 1,
      anchor: 'due',
      end: { type: 'never' },
      resetSubtasks: false,
    })
  })

  test('weekly uses the weekday of startDate', () => {
    const r = presetRule('weekly', '2026-10-23')
    expect(r.freq).toBe('weekly')
    expect(r.byWeekday).toEqual([5])
  })

  test('weekdays is weekly on Monday to Friday', () => {
    const r = presetRule('weekdays', '2026-10-23')
    expect(r.freq).toBe('weekly')
    expect(r.byWeekday).toEqual([1, 2, 3, 4, 5])
  })

  test('monthly uses the day of startDate, including 31', () => {
    expect(presetRule('monthly', '2026-10-15').byMonthDay).toBe(15)
    expect(presetRule('monthly', '2026-01-31').byMonthDay).toBe(31)
  })

  test('yearly', () => {
    const r = presetRule('yearly', '2026-03-02')
    expect(r.freq).toBe('yearly')
    expect(r.interval).toBe(1)
  })

  test('every preset is valid, due-anchored, endless and keeps subtasks', () => {
    for (const kind of ['daily', 'weekly', 'weekdays', 'monthly', 'yearly'] as const) {
      const r = presetRule(kind, '2026-10-23')
      expect(validateRule(r)).toEqual({ ok: true })
      expect(r.anchor).toBe('due')
      expect(r.end).toEqual({ type: 'never' })
      expect(r.resetSubtasks).toBe(false)
    }
  })
})
