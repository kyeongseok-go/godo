import { makeTask } from '../../test/factories'
import type { RecurrenceRule } from '../../domain/types'
import { blockMinutes, clampMinutes, dateRange, layoutSpans, occurrencesByDate, snapMinutes } from './layout'

describe('layoutSpans', () => {
  test('a single span uses the full width', () => {
    expect(layoutSpans([{ id: 'a', start: 60, end: 120 }])).toEqual([{ id: 'a', start: 60, end: 120, column: 0, columns: 1 }])
  })

  test('sequential spans do not share columns', () => {
    const r = layoutSpans([
      { id: 'a', start: 60, end: 120 },
      { id: 'b', start: 120, end: 180 },
    ])

    expect(r.map((p) => p.columns)).toEqual([1, 1])
  })

  test('overlapping spans split into columns', () => {
    const r = layoutSpans([
      { id: 'a', start: 60, end: 180 },
      { id: 'b', start: 90, end: 150 },
    ])
    const byId = Object.fromEntries(r.map((p) => [p.id, p]))

    expect(byId.a.columns).toBe(2)
    expect(byId.b.columns).toBe(2)
    expect(byId.a.column).not.toBe(byId.b.column)
  })

  test('a span that fits in a freed column reuses it within the cluster', () => {
    const r = layoutSpans([
      { id: 'a', start: 0, end: 60 },
      { id: 'b', start: 30, end: 120 },
      { id: 'c', start: 70, end: 100 },
    ])
    const byId = Object.fromEntries(r.map((p) => [p.id, p]))

    expect(byId.c.column).toBe(byId.a.column)
    expect(byId.a.columns).toBe(2)
  })

  test('separate clusters keep their own column counts', () => {
    const r = layoutSpans([
      { id: 'a', start: 0, end: 60 },
      { id: 'b', start: 30, end: 90 },
      { id: 'c', start: 300, end: 360 },
    ])
    const byId = Object.fromEntries(r.map((p) => [p.id, p]))

    expect(byId.c.columns).toBe(1)
    expect(byId.a.columns).toBe(2)
  })
})

describe('snap and clamp', () => {
  test('snaps to the nearest step', () => {
    expect(snapMinutes(61)).toBe(60)
    expect(snapMinutes(68)).toBe(75)
    expect(snapMinutes(40, 30)).toBe(30)
  })

  test('clamps to a day', () => {
    expect(clampMinutes(-5)).toBe(0)
    expect(clampMinutes(2000)).toBe(1440)
  })
})

describe('blockMinutes', () => {
  test('prefers duration, then estimate, then the default', () => {
    expect(blockMinutes(makeTask({ durationMin: 45, estimateMin: 90 }), 30)).toBe(45)
    expect(blockMinutes(makeTask({ estimateMin: 90 }), 30)).toBe(90)
    expect(blockMinutes(makeTask({}), 30)).toBe(30)
  })
})

describe('occurrencesByDate', () => {
  const weekly: RecurrenceRule = { freq: 'weekly', interval: 1, byWeekday: [5], anchor: 'due', end: { type: 'never' }, resetSubtasks: false }

  test('places tasks on their start date within the range only', () => {
    const inside = makeTask({ id: 'in', startDate: '2026-10-23' })
    const outside = makeTask({ id: 'out', startDate: '2026-12-01' })

    const map = occurrencesByDate([inside, outside], '2026-10-19', '2026-10-25')

    expect([...map.keys()]).toEqual(['2026-10-23'])
  })

  test('a deadline-only task appears on its deadline', () => {
    const t = makeTask({ id: 'd', dueDate: '2026-10-24' })

    expect(occurrencesByDate([t], '2026-10-19', '2026-10-25').get('2026-10-24')?.[0].virtual).toBe(false)
  })

  test('recurring tasks show virtual future occurrences', () => {
    const t = makeTask({ id: 'r', startDate: '2026-10-23', recurrence: weekly })

    const map = occurrencesByDate([t], '2026-10-19', '2026-11-08')

    expect(map.get('2026-10-23')?.[0].virtual).toBe(false)
    expect(map.get('2026-10-30')?.[0].virtual).toBe(true)
    expect(map.get('2026-11-06')?.[0].virtual).toBe(true)
  })

  test('skips deleted, canceled and someday tasks', () => {
    const tasks = [
      makeTask({ startDate: '2026-10-23', deletedAt: 1 }),
      makeTask({ startDate: '2026-10-23', status: 'canceled' }),
      makeTask({ startDate: '2026-10-23', someday: true }),
    ]

    expect(occurrencesByDate(tasks, '2026-10-19', '2026-10-25').size).toBe(0)
  })

  test('sorts untimed first, then by time', () => {
    const late = makeTask({ id: 'late', startDate: '2026-10-23', startTime: '15:00' })
    const early = makeTask({ id: 'early', startDate: '2026-10-23', startTime: '09:00' })
    const untimed = makeTask({ id: 'u', startDate: '2026-10-23' })

    const ids = occurrencesByDate([late, early, untimed], '2026-10-23', '2026-10-23').get('2026-10-23')?.map((o) => o.task.id)

    expect(ids).toEqual(['u', 'early', 'late'])
  })
})

describe('dateRange', () => {
  test('lists consecutive days', () => {
    expect(dateRange('2026-10-30', 3)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01'])
  })
})
