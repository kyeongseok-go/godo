import { describe, expect, it } from 'vitest'
import type { RecurrenceRule } from '../types'
import { describeRecurrence, formatKoreanTime } from './recurrence-text'

const rule = (overrides: Partial<RecurrenceRule>): RecurrenceRule => ({
  freq: 'daily',
  interval: 1,
  anchor: 'due',
  end: { type: 'never' },
  resetSubtasks: false,
  ...overrides,
})

describe('describeRecurrence', () => {
  it.each([
    [rule({ freq: 'daily' }), null, '매일'],
    [rule({ freq: 'daily', interval: 3 }), null, '3일마다'],
    [rule({ freq: 'weekly', byWeekday: [1] }), null, '매주 월요일'],
    [rule({ freq: 'weekly', byWeekday: [5, 1, 3] }), null, '매주 월·수·금요일'],
    [rule({ freq: 'weekly', byWeekday: [1, 2, 3, 4, 5] }), null, '평일마다'],
    [rule({ freq: 'weekly', byWeekday: [0, 6] }), null, '매주 토·일요일'],
    [rule({ freq: 'weekly', interval: 2, byWeekday: [1] }), null, '2주마다 월요일'],
    [rule({ freq: 'weekly', interval: 2, byWeekday: [1, 2, 3, 4, 5] }), null, '2주마다 평일'],
    [rule({ freq: 'weekly' }), '2026-10-26', '매주 월요일'],
    [rule({ freq: 'weekly' }), null, '매주'],
    [rule({ freq: 'weekly', interval: 2 }), null, '2주마다'],
    [rule({ freq: 'monthly', byMonthDay: 25 }), null, '매월 25일'],
    [rule({ freq: 'monthly', byMonthDay: 'last' }), null, '매월 말일'],
    [rule({ freq: 'monthly', nth: { n: 1, weekday: 1 } }), null, '매월 첫째 월요일'],
    [rule({ freq: 'monthly', nth: { n: 2, weekday: 2 } }), null, '매월 둘째 화요일'],
    [rule({ freq: 'monthly', nth: { n: 3, weekday: 3 } }), null, '매월 셋째 수요일'],
    [rule({ freq: 'monthly', nth: { n: 4, weekday: 4 } }), null, '매월 넷째 목요일'],
    [rule({ freq: 'monthly', nth: { n: -1, weekday: 5 } }), null, '매월 마지막 금요일'],
    [rule({ freq: 'monthly' }), '2026-10-24', '매월 24일'],
    [rule({ freq: 'monthly' }), null, '매월'],
    [rule({ freq: 'monthly', interval: 3, byMonthDay: 25 }), null, '3개월마다 25일'],
    [rule({ freq: 'yearly' }), null, '매년'],
    [rule({ freq: 'yearly' }), '2026-10-24', '매년 10월 24일'],
    [rule({ freq: 'yearly', interval: 2 }), '2026-10-24', '2년마다 10월 24일'],
  ])('describes %j with start %s as "%s"', (r, startDate, expected) => {
    expect(describeRecurrence(r, startDate)).toBe(expected)
  })
})

describe('formatKoreanTime', () => {
  it.each([
    ['09:00', '오전 9시'],
    ['15:30', '오후 3시 30분'],
    ['12:00', '오후 12시'],
    ['00:00', '오전 12시'],
    ['00:05', '오전 12시 5분'],
    ['23:59', '오후 11시 59분'],
  ])('formats %s as %s', (time, expected) => {
    expect(formatKoreanTime(time)).toBe(expected)
  })
})
