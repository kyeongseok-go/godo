import { makeTask } from '../../test/factories'
import type { RecurrenceRule, Task } from '../types'
import { occurrencesInRange } from './range'

const rule = (o: Partial<RecurrenceRule> = {}): RecurrenceRule => ({
  freq: 'daily',
  interval: 1,
  anchor: 'due',
  end: { type: 'never' },
  resetSubtasks: false,
  ...o,
})

const taskWith = (startDate: string | null, r: RecurrenceRule | null, o: Partial<Task> = {}): Task =>
  makeTask({ startDate, recurrence: r, ...o })

describe('occurrencesInRange', () => {
  test('lists every day of a daily rule, both ends inclusive', () => {
    const t = taskWith('2026-10-23', rule())
    expect(occurrencesInRange(t, '2026-10-23', '2026-10-27')).toEqual([
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
    ])
  })

  test('starts at the current occurrence even when from is earlier', () => {
    const t = taskWith('2026-10-25', rule())
    expect(occurrencesInRange(t, '2026-10-01', '2026-10-27')).toEqual(['2026-10-25', '2026-10-26', '2026-10-27'])
  })

  test('returns only the occurrences inside a later window', () => {
    const t = taskWith('2026-10-19', rule({ freq: 'weekly', byWeekday: [1, 3] }))
    expect(occurrencesInRange(t, '2026-10-26', '2026-11-05')).toEqual([
      '2026-10-26',
      '2026-10-28',
      '2026-11-02',
      '2026-11-04',
    ])
  })

  test('returns an empty list when the window ends before the start or is reversed', () => {
    const t = taskWith('2026-10-23', rule())
    expect(occurrencesInRange(t, '2026-10-01', '2026-10-22')).toEqual([])
    expect(occurrencesInRange(t, '2026-10-30', '2026-10-25')).toEqual([])
  })

  test('returns an empty list for a task without a recurrence or any date', () => {
    expect(occurrencesInRange(taskWith('2026-10-23', null), '2026-10-01', '2026-10-31')).toEqual([])
    expect(occurrencesInRange(taskWith(null, rule()), '2026-10-01', '2026-10-31')).toEqual([])
  })

  test('falls back to dueDate when startDate is missing', () => {
    const t = taskWith(null, rule(), { dueDate: '2026-10-29' })
    expect(occurrencesInRange(t, '2026-10-01', '2026-10-31')).toEqual(['2026-10-29', '2026-10-30', '2026-10-31'])
  })

  test('keeps the remembered month day across short months', () => {
    const t = taskWith('2026-01-31', rule({ freq: 'monthly', byMonthDay: 31 }))
    expect(occurrencesInRange(t, '2026-01-01', '2026-05-31')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ])
  })

  test('caps the result at 400 dates', () => {
    const t = taskWith('2026-01-01', rule())
    const dates = occurrencesInRange(t, '2026-01-01', '2030-01-01')
    expect(dates).toHaveLength(400)
    expect(dates[399]).toBe('2027-02-04')
  })

  test('skips dates listed in skipDates', () => {
    const t = taskWith('2026-10-23', rule({ skipDates: ['2026-10-24', '2026-10-26'] }))
    expect(occurrencesInRange(t, '2026-10-23', '2026-10-27')).toEqual(['2026-10-23', '2026-10-25', '2026-10-27'])
  })

  test('leaves out the current occurrence when it is itself in skipDates', () => {
    const t = taskWith('2026-10-23', rule({ skipDates: ['2026-10-23'] }))
    expect(occurrencesInRange(t, '2026-10-23', '2026-10-25')).toEqual(['2026-10-24', '2026-10-25'])
  })

  test('stops after the until date, which is included', () => {
    const t = taskWith('2026-10-23', rule({ end: { type: 'until', date: '2026-10-25' } }))
    expect(occurrencesInRange(t, '2026-10-23', '2026-10-31')).toEqual(['2026-10-23', '2026-10-24', '2026-10-25'])
  })

  test('stops once the remaining count is used up', () => {
    const t = taskWith('2026-10-23', rule({ end: { type: 'count', count: 3 }, doneCount: 1 }))
    expect(occurrencesInRange(t, '2026-10-23', '2026-10-31')).toEqual(['2026-10-23', '2026-10-24'])
  })

  test('does not spend count on skipped dates', () => {
    const t = taskWith('2026-10-23', rule({ end: { type: 'count', count: 2 }, skipDates: ['2026-10-24'] }))
    expect(occurrencesInRange(t, '2026-10-23', '2026-10-31')).toEqual(['2026-10-23', '2026-10-25'])
  })

  test('returns nothing when the count is already used up', () => {
    const t = taskWith('2026-10-23', rule({ end: { type: 'count', count: 2 }, doneCount: 2 }))
    expect(occurrencesInRange(t, '2026-10-23', '2026-10-31')).toEqual([])
  })

  test('counts occurrences before the window towards the count', () => {
    const t = taskWith('2026-10-19', rule({ end: { type: 'count', count: 3 } }))
    expect(occurrencesInRange(t, '2026-10-20', '2026-10-31')).toEqual(['2026-10-20', '2026-10-21'])
  })

  test('does not mutate the task', () => {
    const t = Object.freeze(taskWith('2026-10-23', Object.freeze(rule({ skipDates: Object.freeze(['2026-10-25']) as string[] }))))
    expect(() => occurrencesInRange(t, '2026-10-23', '2026-10-27')).not.toThrow()
  })
})
