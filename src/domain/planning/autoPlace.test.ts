import { describe, expect, it } from 'vitest'
import { makeTask } from '../../test/factories'
import type { Task } from '../types'
import { autoPlace } from './autoPlace'
import type { AutoPlaceOptions, BusyBlock } from './autoPlace'

const TODAY = '2026-03-10' // 화요일

const BASE: AutoPlaceOptions = {
  today: TODAY,
  nowTime: '09:00',
  horizonDays: 7,
  workStart: '09:00',
  workEnd: '18:00',
  bufferMin: 10,
  defaultMin: 30,
  slotMin: 15,
  capacityMin: 480,
  workDays: [1, 2, 3, 4, 5],
}

function run(tasks: Task[], busy: BusyBlock[] = [], opts: Partial<AutoPlaceOptions> = {}) {
  return autoPlace(tasks, busy, { ...BASE, ...opts })
}

const task = (id: string, overrides: Partial<Task> = {}): Task => makeTask({ id, ...overrides })

describe('autoPlace basics', () => {
  it('places a task at the first slot of the work day', () => {
    const { placements, failures } = run([task('a')])
    expect(placements).toEqual([{ taskId: 'a', date: TODAY, startTime: '09:00', durationMin: 30 }])
    expect(failures).toEqual([])
  })

  it('starts after the current time rounded up to the slot grid', () => {
    expect(run([task('a')], [], { nowTime: '09:07' }).placements[0].startTime).toBe('09:15')
    expect(run([task('a')], [], { nowTime: '07:00' }).placements[0].startTime).toBe('09:00')
  })

  it('uses duration, then estimate, then the default length', () => {
    const { placements } = run([
      task('a', { durationMin: 45, estimateMin: 90, order: 1 }),
      task('b', { estimateMin: 20, order: 2 }),
    ])
    expect(placements.map((p) => p.durationMin)).toEqual([45, 20])
  })

  it('leaves a buffer between consecutive tasks', () => {
    const { placements } = run([task('a', { order: 1 }), task('b', { order: 2 })])
    expect(placements.map((p) => p.startTime)).toEqual(['09:00', '09:45'])
  })

  it('treats a zero or negative slot size as one minute', () => {
    expect(run([task('a')], [], { slotMin: 0, nowTime: '09:07' }).placements[0].startTime).toBe('09:07')
  })
})

describe('autoPlace busy time', () => {
  it('keeps clear of busy blocks and their buffer', () => {
    const busy: BusyBlock[] = [{ date: TODAY, start: '09:00', end: '10:00' }]
    expect(run([task('a')], busy).placements[0].startTime).toBe('10:15')
  })

  it('fits before a busy block only when the buffer also fits', () => {
    const busy: BusyBlock[] = [{ date: TODAY, start: '10:00', end: '11:00' }]
    expect(run([task('a')], busy).placements[0].startTime).toBe('09:00')
    expect(run([task('a', { durationMin: 60 })], busy).placements[0].startTime).toBe('11:15')
  })

  it('ignores busy blocks on other days and malformed blocks', () => {
    const busy: BusyBlock[] = [
      { date: '2026-03-11', start: '09:00', end: '18:00' },
      { date: TODAY, start: '12:00', end: '11:00' },
    ]
    expect(run([task('a')], busy).placements[0].startTime).toBe('09:00')
  })

  it('treats tasks that already have a time as busy', () => {
    const fixed = task('fixed', { startDate: TODAY, startTime: '09:00', durationMin: 60 })
    const { placements } = run([fixed, task('a')])
    expect(placements).toEqual([{ taskId: 'a', date: TODAY, startTime: '10:15', durationMin: 30 }])
  })

  it('uses the due date for a timed task without a start date', () => {
    const fixed = task('fixed', { dueDate: TODAY, startTime: '09:00', durationMin: 60 })
    expect(run([fixed, task('a')]).placements[0].startTime).toBe('10:15')
  })

  it('does not treat finished or held timed tasks as busy', () => {
    const done = task('d', { startDate: TODAY, startTime: '09:00', status: 'done' })
    const held = task('h', { startDate: TODAY, startTime: '09:00', onHold: true })
    expect(run([done, held, task('a')]).placements[0].startTime).toBe('09:00')
  })
})

describe('autoPlace capacity and calendar', () => {
  it('moves to the next work day once the daily capacity is used', () => {
    const tasks = [task('a', { order: 1 }), task('b', { order: 2 }), task('c', { order: 3 })]
    const { placements } = run(tasks, [], { capacityMin: 60 })
    expect(placements.map((p) => [p.date, p.startTime])).toEqual([
      [TODAY, '09:00'],
      [TODAY, '09:45'],
      ['2026-03-11', '09:00'],
    ])
  })

  it('counts already scheduled timed tasks against the capacity', () => {
    const fixed = task('fixed', { startDate: TODAY, startTime: '16:00', durationMin: 60 })
    const { placements } = run([fixed, task('a', { order: 1 }), task('b', { order: 2 })], [], { capacityMin: 90 })
    expect(placements.map((p) => [p.date, p.startTime])).toEqual([
      [TODAY, '09:00'],
      ['2026-03-11', '09:00'],
    ])
  })

  it('skips days that are not work days', () => {
    const friday = '2026-03-13'
    const { placements } = run([task('a')], [], { today: friday, nowTime: '17:50' })
    expect(placements[0]).toMatchObject({ date: '2026-03-16', startTime: '09:00' })
  })

  it('starts on a future start date', () => {
    const { placements } = run([task('a', { startDate: '2026-03-12' })])
    expect(placements[0]).toMatchObject({ date: '2026-03-12', startTime: '09:00' })
  })

  it('crosses a year boundary', () => {
    const { placements } = run([task('a')], [], { today: '2025-12-31', nowTime: '17:50' })
    expect(placements[0]).toMatchObject({ date: '2026-01-01', startTime: '09:00' })
  })
})

describe('autoPlace deadlines and failures', () => {
  it('places before or on the due date', () => {
    const { placements } = run([task('a', { dueDate: '2026-03-11' })], [], { nowTime: '17:50' })
    expect(placements[0]).toMatchObject({ date: '2026-03-11', startTime: '09:00' })
  })

  it('fails with a deadline message when nothing fits before the due date', () => {
    const { placements, failures } = run([task('a', { dueDate: TODAY })], [], { nowTime: '17:50' })
    expect(placements).toEqual([])
    expect(failures).toEqual([{ taskId: 'a', reason: '마감 전에 들어갈 빈 시간이 없어요' }])
  })

  it('fails when the due date is already past', () => {
    const { failures } = run([task('a', { dueDate: '2026-03-01' })])
    expect(failures[0].reason).toBe('마감 전에 들어갈 빈 시간이 없어요')
  })

  it('fails with a horizon message when the planning window is full', () => {
    const { failures } = run([task('a')], [], { horizonDays: 1, nowTime: '17:50' })
    expect(failures).toHaveLength(1)
    expect(failures[0].reason).toContain('1일')
  })

  it('fails when the start date is beyond the planning window', () => {
    const { failures } = run([task('a', { startDate: '2026-04-30' })])
    expect(failures[0].reason).toContain('시작일')
  })

  it('fails when the task is longer than the daily capacity or the work day', () => {
    const tooLong = run([task('a', { estimateMin: 500 })], [], { capacityMin: 480 })
    expect(tooLong.failures[0].reason).toContain('용량')
    const longerThanDay = run([task('b', { estimateMin: 560 })], [], { capacityMin: 600 })
    expect(longerThanDay.failures[0].reason).toContain('근무 시간')
  })

  it('fails every task when the work day is empty', () => {
    const { placements, failures } = run([task('a')], [], { workStart: '18:00', workEnd: '09:00' })
    expect(placements).toEqual([])
    expect(failures).toHaveLength(1)
  })
})

describe('autoPlace eligibility and order', () => {
  it('orders by due date, then priority, then longer tasks', () => {
    const tasks = [
      task('plain', { priority: 4 }),
      task('urgent', { priority: 4, dueDate: '2026-03-12' }),
      task('p1', { priority: 1 }),
      task('long', { priority: 4, estimateMin: 60 }),
    ]
    expect(run(tasks).placements.map((p) => p.taskId)).toEqual(['urgent', 'p1', 'long', 'plain'])
  })

  it('skips tasks that are timed, finished, parked, deleted or blocked', () => {
    const blocker = task('blocker')
    const tasks = [
      task('timed', { startTime: '13:00' }),
      task('done', { status: 'done' }),
      task('canceled', { status: 'canceled' }),
      task('held', { onHold: true }),
      task('someday', { someday: true }),
      task('deleted', { deletedAt: 1 }),
      task('blocked', { blockedBy: [blocker.id] }),
      blocker,
    ]
    const { placements, failures } = run(tasks)
    expect(placements.map((p) => p.taskId)).toEqual(['blocker'])
    expect(failures).toEqual([])
  })

  it('places a task whose blocker is gone or already done', () => {
    const done = task('done', { status: 'done' })
    const tasks = [task('x', { blockedBy: [done.id, 'ghost'] }), done]
    expect(run(tasks).placements.map((p) => p.taskId)).toEqual(['x'])
  })

  it('places leaf tasks instead of a parent that still has open subtasks', () => {
    const parent = task('parent')
    const child = task('child', { parentId: parent.id })
    const finished = task('finished', { parentId: parent.id, status: 'done' })
    expect(run([parent, child, finished]).placements.map((p) => p.taskId)).toEqual(['child'])
  })

  it('skips children of a held parent', () => {
    const parent = task('parent', { onHold: true })
    const child = task('child', { parentId: parent.id })
    expect(run([parent, child]).placements).toEqual([])
  })
})

describe('autoPlace determinism', () => {
  it('returns the same plan regardless of input order and never mutates input', () => {
    const tasks = Object.freeze([
      Object.freeze(task('a', { priority: 2 })),
      Object.freeze(task('b', { priority: 2 })),
      Object.freeze(task('c', { dueDate: '2026-03-11' })),
    ])
    const busy = Object.freeze([Object.freeze({ date: TODAY, start: '10:00', end: '11:00' })])
    const forward = autoPlace(tasks, busy, BASE)
    const backward = autoPlace([...tasks].reverse(), busy, BASE)
    expect(backward).toEqual(forward)
    expect(autoPlace(tasks, busy, BASE)).toEqual(forward)
  })
})
