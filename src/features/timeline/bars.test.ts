import { barFor, resizeEnd, shiftSpan, taskSpan } from './bars'

describe('taskSpan', () => {
  test('no dates means no span', () => {
    expect(taskSpan({ startDate: null, dueDate: null })).toBeNull()
  })

  test('start and due give a multi-day span', () => {
    expect(taskSpan({ startDate: '2026-10-20', dueDate: '2026-10-24' })).toEqual({ start: '2026-10-20', end: '2026-10-24', singleDay: false })
  })

  test('a due date before the start collapses to a single day on the start', () => {
    expect(taskSpan({ startDate: '2026-10-20', dueDate: '2026-10-10' })).toEqual({ start: '2026-10-20', end: '2026-10-20', singleDay: true })
  })

  test('only one date yields a single-day span', () => {
    expect(taskSpan({ startDate: null, dueDate: '2026-10-24' })).toMatchObject({ start: '2026-10-24', singleDay: true })
    expect(taskSpan({ startDate: '2026-10-21', dueDate: null })).toMatchObject({ end: '2026-10-21', singleDay: true })
  })
})

describe('barFor', () => {
  test('maps dates to cell indexes', () => {
    expect(barFor({ startDate: '2026-10-22', dueDate: '2026-10-25' }, '2026-10-20', 14)).toMatchObject({ from: 2, to: 5, clippedStart: false, clippedEnd: false })
  })

  test('clips bars that run past either edge', () => {
    const left = barFor({ startDate: '2026-10-15', dueDate: '2026-10-22' }, '2026-10-20', 14)
    const right = barFor({ startDate: '2026-11-01', dueDate: '2026-11-20' }, '2026-10-20', 14)

    expect(left).toMatchObject({ from: 0, to: 2, clippedStart: true })
    expect(right).toMatchObject({ from: 12, to: 13, clippedEnd: true })
  })

  test('returns null when fully outside the range', () => {
    expect(barFor({ startDate: '2026-09-01', dueDate: '2026-09-05' }, '2026-10-20', 14)).toBeNull()
    expect(barFor({ startDate: '2026-12-01', dueDate: null }, '2026-10-20', 14)).toBeNull()
  })
})

describe('shiftSpan and resizeEnd', () => {
  test('shiftSpan moves both dates and skips missing ones', () => {
    expect(shiftSpan({ startDate: '2026-10-20', dueDate: '2026-10-24' }, 3)).toEqual({ startDate: '2026-10-23', dueDate: '2026-10-27' })
    expect(shiftSpan({ startDate: null, dueDate: '2026-10-24' }, -1)).toEqual({ dueDate: '2026-10-23' })
  })

  test('resizeEnd sets the due date but never before the start', () => {
    expect(resizeEnd({ startDate: '2026-10-20', dueDate: null }, '2026-10-25')).toEqual({ dueDate: '2026-10-25' })
    expect(resizeEnd({ startDate: '2026-10-20', dueDate: '2026-10-25' }, '2026-10-10')).toEqual({ dueDate: '2026-10-20' })
  })
})
