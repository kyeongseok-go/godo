import type { RecurrenceRule } from '../types'
import { describeRule } from './describe'

const rule = (o: Partial<RecurrenceRule> = {}): RecurrenceRule => ({
  freq: 'daily',
  interval: 1,
  anchor: 'due',
  end: { type: 'never' },
  resetSubtasks: false,
  ...o,
})

describe('describeRule', () => {
  test('daily', () => {
    expect(describeRule(rule())).toBe('매일')
    expect(describeRule(rule({ interval: 3 }))).toBe('3일마다')
  })

  test('weekly with several weekdays', () => {
    expect(describeRule(rule({ freq: 'weekly', byWeekday: [1, 3, 5] }))).toBe('매주 월·수·금')
  })

  test('weekly sorts weekdays Monday first and puts Sunday last', () => {
    expect(describeRule(rule({ freq: 'weekly', byWeekday: [5, 3, 1] }))).toBe('매주 월·수·금')
    expect(describeRule(rule({ freq: 'weekly', byWeekday: [0, 6] }))).toBe('매주 토·일')
  })

  test('weekly with one weekday spells out 요일', () => {
    expect(describeRule(rule({ freq: 'weekly', byWeekday: [1] }))).toBe('매주 월요일')
    expect(describeRule(rule({ freq: 'weekly', interval: 2, byWeekday: [2] }))).toBe('2주마다 화요일')
  })

  test('weekly with interval and several weekdays', () => {
    expect(describeRule(rule({ freq: 'weekly', interval: 2, byWeekday: [1, 4] }))).toBe('2주마다 월·목')
  })

  test('Monday to Friday reads as 평일마다', () => {
    expect(describeRule(rule({ freq: 'weekly', byWeekday: [1, 2, 3, 4, 5] }))).toBe('평일마다')
    expect(describeRule(rule({ freq: 'weekly', interval: 2, byWeekday: [5, 4, 3, 2, 1] }))).toBe('2주마다 평일')
  })

  test('weekly without byWeekday uses the weekday of startDate when given', () => {
    expect(describeRule(rule({ freq: 'weekly' }), '2026-10-23')).toBe('매주 금요일')
    expect(describeRule(rule({ freq: 'weekly', byWeekday: [] }), '2026-10-23')).toBe('매주 금요일')
    expect(describeRule(rule({ freq: 'weekly' }))).toBe('매주')
    expect(describeRule(rule({ freq: 'weekly', interval: 2 }))).toBe('2주마다')
  })

  test('monthly by day number, last day and nth weekday', () => {
    expect(describeRule(rule({ freq: 'monthly', byMonthDay: 25 }))).toBe('매월 25일')
    expect(describeRule(rule({ freq: 'monthly', byMonthDay: 'last' }))).toBe('매월 마지막 날')
    expect(describeRule(rule({ freq: 'monthly', nth: { n: 1, weekday: 1 } }))).toBe('매월 첫째 월요일')
    expect(describeRule(rule({ freq: 'monthly', nth: { n: 2, weekday: 2 } }))).toBe('매월 둘째 화요일')
    expect(describeRule(rule({ freq: 'monthly', nth: { n: 3, weekday: 3 } }))).toBe('매월 셋째 수요일')
    expect(describeRule(rule({ freq: 'monthly', nth: { n: 4, weekday: 0 } }))).toBe('매월 넷째 일요일')
    expect(describeRule(rule({ freq: 'monthly', nth: { n: -1, weekday: 5 } }))).toBe('매월 마지막 금요일')
  })

  test('monthly with interval', () => {
    expect(describeRule(rule({ freq: 'monthly', interval: 2, byMonthDay: 25 }))).toBe('2개월마다 25일')
    expect(describeRule(rule({ freq: 'monthly', interval: 3, nth: { n: 1, weekday: 1 } }))).toBe('3개월마다 첫째 월요일')
  })

  test('monthly without byMonthDay uses the day of startDate when given', () => {
    expect(describeRule(rule({ freq: 'monthly' }), '2026-10-15')).toBe('매월 15일')
    expect(describeRule(rule({ freq: 'monthly' }))).toBe('매월')
    expect(describeRule(rule({ freq: 'monthly', interval: 2 }))).toBe('2개월마다')
  })

  test('yearly', () => {
    expect(describeRule(rule({ freq: 'yearly' }), '2026-03-02')).toBe('매년 3월 2일')
    expect(describeRule(rule({ freq: 'yearly', interval: 2 }), '2026-03-02')).toBe('2년마다 3월 2일')
    expect(describeRule(rule({ freq: 'yearly' }))).toBe('매년')
    expect(describeRule(rule({ freq: 'yearly', interval: 2 }))).toBe('2년마다')
  })

  test('completion anchor', () => {
    expect(describeRule(rule({ anchor: 'completion', interval: 3 }))).toBe('완료한 날부터 3일마다')
    expect(describeRule(rule({ anchor: 'completion' }))).toBe('완료한 날부터 매일')
    expect(describeRule(rule({ anchor: 'completion', freq: 'weekly' }))).toBe('완료한 날부터 매주')
    expect(describeRule(rule({ anchor: 'completion', freq: 'weekly', byWeekday: [1] }))).toBe('완료한 날부터 매주 월요일')
    expect(describeRule(rule({ anchor: 'completion', freq: 'monthly', interval: 2 }))).toBe('완료한 날부터 2개월마다')
    expect(describeRule(rule({ anchor: 'completion', freq: 'yearly' }))).toBe('완료한 날부터 매년')
  })

  test('end condition suffixes', () => {
    expect(describeRule(rule({ end: { type: 'until', date: '2027-01-31' } }))).toBe('매일 · 2027-01-31까지')
    expect(describeRule(rule({ freq: 'weekly', byWeekday: [1], end: { type: 'count', count: 10 } }))).toBe(
      '매주 월요일 · 10회',
    )
    expect(
      describeRule(rule({ anchor: 'completion', interval: 3, end: { type: 'count', count: 5 } })),
    ).toBe('완료한 날부터 3일마다 · 5회')
  })

  test('treats an invalid interval as 1', () => {
    expect(describeRule(rule({ interval: 0 }))).toBe('매일')
  })
})
