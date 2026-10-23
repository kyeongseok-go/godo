import { describe, expect, it } from 'vitest'
import { makeTask } from '../../test/factories'
import { dayLoad, scheduledOn, suggestOffload, taskMinutes } from './capacity'

const TODAY = '2026-03-10'

describe('scheduledOn', () => {
  it('matches by start date, or by due date when there is no start date', () => {
    expect(scheduledOn(makeTask({ startDate: TODAY }), TODAY)).toBe(true)
    expect(scheduledOn(makeTask({ dueDate: TODAY }), TODAY)).toBe(true)
    expect(scheduledOn(makeTask({ startDate: '2026-03-09', dueDate: TODAY }), TODAY)).toBe(false)
    expect(scheduledOn(makeTask({ startDate: '2026-03-11' }), TODAY)).toBe(false)
    expect(scheduledOn(makeTask(), TODAY)).toBe(false)
  })

  it('rejects finished, deleted, on-hold and someday tasks', () => {
    expect(scheduledOn(makeTask({ startDate: TODAY, status: 'done' }), TODAY)).toBe(false)
    expect(scheduledOn(makeTask({ startDate: TODAY, status: 'canceled' }), TODAY)).toBe(false)
    expect(scheduledOn(makeTask({ startDate: TODAY, deletedAt: 3 }), TODAY)).toBe(false)
    expect(scheduledOn(makeTask({ startDate: TODAY, onHold: true }), TODAY)).toBe(false)
    expect(scheduledOn(makeTask({ startDate: TODAY, someday: true }), TODAY)).toBe(false)
  })
})

describe('taskMinutes', () => {
  it('prefers duration, then estimate, then the default', () => {
    expect(taskMinutes(makeTask({ durationMin: 45, estimateMin: 90 }), 30)).toBe(45)
    expect(taskMinutes(makeTask({ estimateMin: 90 }), 30)).toBe(90)
    expect(taskMinutes(makeTask(), 30)).toBe(30)
  })

  it('treats zero or negative values as missing', () => {
    expect(taskMinutes(makeTask({ durationMin: 0, estimateMin: 20 }), 30)).toBe(20)
    expect(taskMinutes(makeTask({ durationMin: -5, estimateMin: 0 }), 30)).toBe(30)
  })
})

describe('dayLoad', () => {
  it('sums only tasks scheduled on that date', () => {
    const tasks = [
      makeTask({ startDate: TODAY, durationMin: 60 }),
      makeTask({ dueDate: TODAY, estimateMin: 90 }),
      makeTask({ startDate: '2026-03-09', durationMin: 500 }),
      makeTask({ startDate: TODAY, status: 'done', durationMin: 500 }),
      makeTask({ startDate: TODAY, onHold: true, durationMin: 500 }),
      makeTask({ startDate: '2026-03-11', durationMin: 500 }),
      makeTask({ startDate: TODAY }),
    ]
    const load = dayLoad(TODAY, tasks, 480, 30)
    expect(load.plannedMin).toBe(180)
    expect(load.capacityMin).toBe(480)
    expect(load.overMin).toBe(0)
    expect(load.date).toBe(TODAY)
    expect(load.ratio).toBeCloseTo(180 / 480)
    expect(load.level).toBe('ok')
  })

  it.each([
    [169, 'ok'],
    [170, 'near'],
    [200, 'near'],
    [201, 'over'],
  ] as const)('classifies %i of 200 minutes as %s', (minutes, level) => {
    const load = dayLoad(TODAY, [makeTask({ startDate: TODAY, durationMin: minutes })], 200, 30)
    expect(load.level).toBe(level)
  })

  it('reports the overflow in minutes', () => {
    const load = dayLoad(TODAY, [makeTask({ startDate: TODAY, durationMin: 250 })], 200, 30)
    expect(load.overMin).toBe(50)
  })

  it('handles zero capacity without dividing by zero', () => {
    expect(dayLoad(TODAY, [], 0, 30)).toMatchObject({ ratio: 0, level: 'ok', overMin: 0 })
    const busy = dayLoad(TODAY, [makeTask({ startDate: TODAY, durationMin: 10 })], 0, 30)
    expect(busy.level).toBe('over')
    expect(busy.overMin).toBe(10)
  })
})

describe('suggestOffload', () => {
  const noDue30 = makeTask({ id: 'a', estimateMin: 30 })
  const noDueP2 = makeTask({ id: 'b', estimateMin: 30, priority: 2 })
  const dueFar = makeTask({ id: 'c', estimateMin: 30, dueDate: '2026-03-20' })
  const dueNear = makeTask({ id: 'd', estimateMin: 30, dueDate: '2026-03-12' })
  const pinned = makeTask({ id: 'e', estimateMin: 30, pinned: true })
  const noDue60 = makeTask({ id: 'f', estimateMin: 60 })
  const all = [dueNear, pinned, noDueP2, dueFar, noDue30, noDue60]
  const names = (tasks: readonly { id: string }[]): string[] => tasks.map((t) => t.id)

  it('orders least urgent first and skips pinned tasks', () => {
    expect(names(suggestOffload(all, 1000, TODAY, 30))).toEqual(['f', 'a', 'b', 'c', 'd'])
  })

  it('stops at the minimum number of tasks that covers the overflow', () => {
    expect(names(suggestOffload(all, 60, TODAY, 30))).toEqual(['f'])
    expect(names(suggestOffload(all, 61, TODAY, 30))).toEqual(['f', 'a'])
    expect(names(suggestOffload(all, 100, TODAY, 30))).toEqual(['f', 'a', 'b'])
  })

  it('returns nothing when there is nothing to offload', () => {
    expect(suggestOffload(all, 0, TODAY, 30)).toEqual([])
    expect(suggestOffload(all, -5, TODAY, 30)).toEqual([])
  })

  it('skips ids passed as highlights', () => {
    expect(names(suggestOffload(all, 60, TODAY, 30, ['f']))).toEqual(['a', 'b'])
  })

  it('does not mutate the input array', () => {
    const copy = [...all]
    suggestOffload(all, 100, TODAY, 30)
    expect(all).toEqual(copy)
  })
})
