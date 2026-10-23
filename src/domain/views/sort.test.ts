import { makeTask } from '../../test/factories'
import { sortTasks } from './sort'

const ids = (tasks: readonly { id: string }[]): string[] => tasks.map((t) => t.id)

describe('sortTasks', () => {
  test('returns an empty array for empty input', () => {
    expect(sortTasks([], 'name', 'asc')).toEqual([])
  })

  test('does not mutate the input array', () => {
    const a = makeTask({ id: 'a', order: 2 })
    const b = makeTask({ id: 'b', order: 1 })
    const input = [a, b]
    const result = sortTasks(input, 'manual', 'asc')
    expect(ids(input)).toEqual(['a', 'b'])
    expect(ids(result)).toEqual(['b', 'a'])
    expect(result).not.toBe(input)
  })

  test('sorts manually by order in both directions', () => {
    const a = makeTask({ id: 'a', order: 1500.5 })
    const b = makeTask({ id: 'b', order: -3 })
    const c = makeTask({ id: 'c', order: 2000 })
    expect(ids(sortTasks([a, b, c], 'manual', 'asc'))).toEqual(['b', 'a', 'c'])
    expect(ids(sortTasks([a, b, c], 'manual', 'desc'))).toEqual(['c', 'a', 'b'])
  })

  test('sorts names with the Korean collator (가나다 order, numbers naturally)', () => {
    const t1 = makeTask({ id: 'ha', title: '하늘' })
    const t2 = makeTask({ id: 'ga', title: '가방' })
    const t3 = makeTask({ id: 'na', title: '나무' })
    expect(ids(sortTasks([t1, t2, t3], 'name', 'asc'))).toEqual(['ga', 'na', 'ha'])
    expect(ids(sortTasks([t1, t2, t3], 'name', 'desc'))).toEqual(['ha', 'na', 'ga'])

    const n2 = makeTask({ id: 'n2', title: '할 일 2' })
    const n10 = makeTask({ id: 'n10', title: '할 일 10' })
    expect(ids(sortTasks([n10, n2], 'name', 'asc'))).toEqual(['n2', 'n10'])
  })

  test('is stable: ties keep input order in both directions', () => {
    const a = makeTask({ id: 'a', priority: 2 })
    const b = makeTask({ id: 'b', priority: 2 })
    const c = makeTask({ id: 'c', priority: 2 })
    expect(ids(sortTasks([a, b, c], 'priority', 'asc'))).toEqual(['a', 'b', 'c'])
    expect(ids(sortTasks([a, b, c], 'priority', 'desc'))).toEqual(['a', 'b', 'c'])
  })

  test('sorts priority with P1 first when ascending', () => {
    const p4 = makeTask({ id: 'p4', priority: 4 })
    const p1 = makeTask({ id: 'p1', priority: 1 })
    const p3 = makeTask({ id: 'p3', priority: 3 })
    expect(ids(sortTasks([p4, p1, p3], 'priority', 'asc'))).toEqual(['p1', 'p3', 'p4'])
    expect(ids(sortTasks([p4, p1, p3], 'priority', 'desc'))).toEqual(['p4', 'p3', 'p1'])
  })

  test('sorts createdAt and updatedAt numerically', () => {
    const a = makeTask({ id: 'a', createdAt: 30, updatedAt: 10 })
    const b = makeTask({ id: 'b', createdAt: 5, updatedAt: 20 })
    const c = makeTask({ id: 'c', createdAt: 100, updatedAt: 3 })
    expect(ids(sortTasks([a, b, c], 'createdAt', 'asc'))).toEqual(['b', 'a', 'c'])
    expect(ids(sortTasks([a, b, c], 'createdAt', 'desc'))).toEqual(['c', 'a', 'b'])
    expect(ids(sortTasks([a, b, c], 'updatedAt', 'asc'))).toEqual(['c', 'a', 'b'])
    expect(ids(sortTasks([a, b, c], 'updatedAt', 'desc'))).toEqual(['b', 'a', 'c'])
  })

  test('puts tasks without a date last regardless of direction', () => {
    const none = makeTask({ id: 'none' })
    const early = makeTask({ id: 'early', startDate: '2026-10-20' })
    const late = makeTask({ id: 'late', startDate: '2026-10-25' })
    expect(ids(sortTasks([none, late, early], 'date', 'asc'))).toEqual(['early', 'late', 'none'])
    expect(ids(sortTasks([none, early, late], 'date', 'desc'))).toEqual(['late', 'early', 'none'])
  })

  test('date sort uses startDate and falls back to dueDate', () => {
    const onlyDue = makeTask({ id: 'onlyDue', dueDate: '2026-10-21' })
    const start = makeTask({ id: 'start', startDate: '2026-10-22', dueDate: '2026-10-01' })
    const earlyStart = makeTask({ id: 'earlyStart', startDate: '2026-10-20' })
    expect(ids(sortTasks([start, onlyDue, earlyStart], 'date', 'asc'))).toEqual([
      'earlyStart',
      'onlyDue',
      'start',
    ])
  })

  test('date sort breaks same-day ties by start time, untimed first', () => {
    const untimed = makeTask({ id: 'untimed', startDate: '2026-10-23' })
    const morning = makeTask({ id: 'morning', startDate: '2026-10-23', startTime: '09:00' })
    const evening = makeTask({ id: 'evening', startDate: '2026-10-23', startTime: '19:30' })
    expect(ids(sortTasks([evening, untimed, morning], 'date', 'asc'))).toEqual([
      'untimed',
      'morning',
      'evening',
    ])
  })

  test('dueDate sort ignores startDate and keeps missing due dates last', () => {
    const noDue = makeTask({ id: 'noDue', startDate: '2026-01-01' })
    const due1 = makeTask({ id: 'due1', dueDate: '2026-10-30' })
    const due2 = makeTask({ id: 'due2', dueDate: '2026-10-24' })
    expect(ids(sortTasks([noDue, due1, due2], 'dueDate', 'asc'))).toEqual(['due2', 'due1', 'noDue'])
    expect(ids(sortTasks([noDue, due2, due1], 'dueDate', 'desc'))).toEqual(['due1', 'due2', 'noDue'])
  })

  test('keeps several dateless tasks in input order at the end', () => {
    const n1 = makeTask({ id: 'n1' })
    const n2 = makeTask({ id: 'n2' })
    const d = makeTask({ id: 'd', dueDate: '2026-10-24' })
    expect(ids(sortTasks([n1, n2, d], 'dueDate', 'desc'))).toEqual(['d', 'n1', 'n2'])
  })
})
