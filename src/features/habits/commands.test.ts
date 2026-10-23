import type { Habit } from '../../domain/types'
import { applyChangeSet, emptyEntityState } from '../../store/changes'
import type { ChangeSet, EntityState } from '../../store/changes'
import {
  createHabit,
  deleteHabit,
  patchHabit,
  setHabitArchived,
  stepHabitDay,
  toggleHabitDay,
  writeHabitDay,
} from './commands'
import type { HabitInput } from './commands'

const TODAY = '2026-10-23'

const apply = (state: EntityState, cs: ChangeSet): EntityState => applyChangeSet(state, cs).next

const makeHabit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1',
  name: '물 마시기',
  icon: null,
  color: '#2b4c7e',
  frequency: { type: 'daily' },
  goal: { kind: 'check', target: 1, unit: null },
  startDate: '2026-10-01',
  group: null,
  reminderTime: null,
  archived: false,
  logs: {},
  order: 1000,
  ...over,
})

const seed = (...habits: Habit[]): EntityState =>
  apply(emptyEntityState(), { puts: { habits }, deletes: {} })

const baseInput: HabitInput = {
  name: '  스트레칭  ',
  color: '#2f6f5e',
  frequency: { type: 'daily' },
  goal: { kind: 'check', target: 1, unit: null },
  startDate: TODAY,
  group: '  아침  ',
  reminderTime: '07:30',
}

describe('createHabit', () => {
  test('trims text fields and appends order after existing habits', () => {
    const state = seed(makeHabit({ id: 'a', order: 5000 }))

    const { habit, changes } = createHabit(state, baseInput)

    expect(habit.name).toBe('스트레칭')
    expect(habit.group).toBe('아침')
    expect(habit.order).toBe(6000)
    expect(habit.archived).toBe(false)
    expect(habit.logs).toEqual({})
    expect(changes.puts.habits).toEqual([habit])
  })

  test('turns a blank group into null', () => {
    const { habit } = createHabit(emptyEntityState(), { ...baseInput, group: '   ' })

    expect(habit.group).toBeNull()
  })

  test('forces target 1 and no unit for check goals', () => {
    const { habit } = createHabit(emptyEntityState(), {
      ...baseInput,
      goal: { kind: 'check', target: 7, unit: '잔' },
    })

    expect(habit.goal).toEqual({ kind: 'check', target: 1, unit: null })
  })

  test('keeps count target and trims the unit, blank unit becomes null', () => {
    const withUnit = createHabit(emptyEntityState(), {
      ...baseInput,
      goal: { kind: 'count', target: 8, unit: ' 잔 ' },
    }).habit
    const withoutUnit = createHabit(emptyEntityState(), {
      ...baseInput,
      goal: { kind: 'count', target: 8, unit: '  ' },
    }).habit

    expect(withUnit.goal).toEqual({ kind: 'count', target: 8, unit: '잔' })
    expect(withoutUnit.goal.unit).toBeNull()
  })

  test('throws a Korean message when the name is blank', () => {
    expect(() => createHabit(emptyEntityState(), { ...baseInput, name: '   ' })).toThrow('이름')
  })

  test('throws when a count target is not a positive number', () => {
    expect(() =>
      createHabit(emptyEntityState(), { ...baseInput, goal: { kind: 'count', target: 0, unit: null } }),
    ).toThrow('목표')
  })

  test('drops an invalid reminder time', () => {
    const { habit } = createHabit(emptyEntityState(), { ...baseInput, reminderTime: '25:99' })

    expect(habit.reminderTime).toBeNull()
  })
})

describe('patchHabit', () => {
  test('merges the patch without touching the logs or the id', () => {
    const state = seed(makeHabit({ logs: { '2026-10-22': 1 } }))

    const next = apply(state, patchHabit(state, 'h1', { name: '  물 2리터  ', id: 'zzz' } as Partial<Habit>))

    expect(next.habits.h1.name).toBe('물 2리터')
    expect(next.habits.h1.logs).toEqual({ '2026-10-22': 1 })
    expect(next.habits.zzz).toBeUndefined()
  })

  test('re-normalizes the goal when the kind changes to check', () => {
    const state = seed(makeHabit({ goal: { kind: 'count', target: 8, unit: '잔' } }))

    const next = apply(state, patchHabit(state, 'h1', { goal: { kind: 'check', target: 8, unit: '잔' } }))

    expect(next.habits.h1.goal).toEqual({ kind: 'check', target: 1, unit: null })
  })

  test('returns an empty change set for an unknown habit', () => {
    expect(patchHabit(emptyEntityState(), 'nope', { name: 'x' }).puts.habits).toBeUndefined()
  })

  test('rejects a blank name', () => {
    const state = seed(makeHabit())

    expect(() => patchHabit(state, 'h1', { name: ' ' })).toThrow('이름')
  })

  test('does not mutate the original habit', () => {
    const habit = makeHabit()
    const state = seed(habit)

    patchHabit(state, 'h1', { name: '다른 이름' })

    expect(state.habits.h1.name).toBe('물 마시기')
  })
})

describe('setHabitArchived', () => {
  test('archives and restores', () => {
    const state = seed(makeHabit())

    const archived = apply(state, setHabitArchived(state, 'h1', true))
    const restored = apply(archived, setHabitArchived(archived, 'h1', false))

    expect(archived.habits.h1.archived).toBe(true)
    expect(restored.habits.h1.archived).toBe(false)
  })
})

describe('deleteHabit', () => {
  test('removes the habit and returns an inverse that restores its logs', () => {
    const state = seed(makeHabit({ logs: { '2026-10-22': 1 } }))

    const { next, inverse } = applyChangeSet(state, deleteHabit(state, 'h1'))
    const back = apply(next, inverse)

    expect(next.habits.h1).toBeUndefined()
    expect(back.habits.h1.logs).toEqual({ '2026-10-22': 1 })
  })

  test('returns an empty change set for an unknown habit', () => {
    expect(deleteHabit(emptyEntityState(), 'nope').deletes.habits).toBeUndefined()
  })
})

describe('writeHabitDay', () => {
  test('stores the value for a past day', () => {
    const state = seed(makeHabit({ goal: { kind: 'count', target: 8, unit: '잔' } }))

    const next = apply(state, writeHabitDay(state, 'h1', '2026-10-20', 5, TODAY))

    expect(next.habits.h1.logs['2026-10-20']).toBe(5)
  })

  test('ignores future dates', () => {
    const state = seed(makeHabit())

    const cs = writeHabitDay(state, 'h1', '2026-10-24', 1, TODAY)

    expect(cs.puts.habits).toBeUndefined()
  })

  test('removes the log when the value is zero, negative or not finite', () => {
    const state = seed(makeHabit({ logs: { '2026-10-20': 3 } }))

    expect(apply(state, writeHabitDay(state, 'h1', '2026-10-20', 0, TODAY)).habits.h1.logs).toEqual({})
    expect(apply(state, writeHabitDay(state, 'h1', '2026-10-20', -2, TODAY)).habits.h1.logs).toEqual({})
    expect(apply(state, writeHabitDay(state, 'h1', '2026-10-20', Number.NaN, TODAY)).habits.h1.logs).toEqual({})
  })

  test('caps check habits at 1', () => {
    const state = seed(makeHabit())

    const next = apply(state, writeHabitDay(state, 'h1', '2026-10-20', 5, TODAY))

    expect(next.habits.h1.logs['2026-10-20']).toBe(1)
  })

  test('rounds to two decimals', () => {
    const state = seed(makeHabit({ goal: { kind: 'count', target: 5, unit: 'km' } }))

    const next = apply(state, writeHabitDay(state, 'h1', '2026-10-20', 2.456, TODAY))

    expect(next.habits.h1.logs['2026-10-20']).toBe(2.46)
  })

  test('moves the start date earlier when logging before it so the log counts', () => {
    const state = seed(makeHabit({ startDate: '2026-10-21' }))

    const next = apply(state, writeHabitDay(state, 'h1', '2026-10-19', 1, TODAY))

    expect(next.habits.h1.startDate).toBe('2026-10-19')
  })

  test('does not move the start date when only clearing a log before it', () => {
    const state = seed(makeHabit({ startDate: '2026-10-21' }))

    const cs = writeHabitDay(state, 'h1', '2026-10-19', 0, TODAY)

    expect(cs.puts.habits).toBeUndefined()
  })

  test('returns an empty change set for an unknown habit', () => {
    expect(writeHabitDay(emptyEntityState(), 'x', TODAY, 1, TODAY).puts.habits).toBeUndefined()
  })

  test('does not mutate the stored habit', () => {
    const state = seed(makeHabit())

    writeHabitDay(state, 'h1', TODAY, 1, TODAY)

    expect(state.habits.h1.logs).toEqual({})
  })
})

describe('toggleHabitDay', () => {
  test('flips a check habit on and off', () => {
    const state = seed(makeHabit())

    const on = apply(state, toggleHabitDay(state, 'h1', TODAY, TODAY))
    const off = apply(on, toggleHabitDay(on, 'h1', TODAY, TODAY))

    expect(on.habits.h1.logs[TODAY]).toBe(1)
    expect(off.habits.h1.logs[TODAY]).toBeUndefined()
  })

  test('increments a count habit by one until it reaches the target, then clears', () => {
    let state = seed(makeHabit({ goal: { kind: 'count', target: 2, unit: '잔' } }))

    state = apply(state, toggleHabitDay(state, 'h1', TODAY, TODAY))
    expect(state.habits.h1.logs[TODAY]).toBe(1)
    state = apply(state, toggleHabitDay(state, 'h1', TODAY, TODAY))
    expect(state.habits.h1.logs[TODAY]).toBe(2)
    state = apply(state, toggleHabitDay(state, 'h1', TODAY, TODAY))
    expect(state.habits.h1.logs[TODAY]).toBeUndefined()
  })

  test('ignores future dates', () => {
    const state = seed(makeHabit())

    expect(toggleHabitDay(state, 'h1', '2026-10-25', TODAY).puts.habits).toBeUndefined()
  })
})

describe('stepHabitDay', () => {
  test('adds and subtracts one without going below zero', () => {
    let state = seed(makeHabit({ goal: { kind: 'count', target: 8, unit: '잔' } }))

    state = apply(state, stepHabitDay(state, 'h1', TODAY, 1, TODAY))
    state = apply(state, stepHabitDay(state, 'h1', TODAY, 1, TODAY))
    expect(state.habits.h1.logs[TODAY]).toBe(2)
    state = apply(state, stepHabitDay(state, 'h1', TODAY, -1, TODAY))
    expect(state.habits.h1.logs[TODAY]).toBe(1)
    state = apply(state, stepHabitDay(state, 'h1', TODAY, -5, TODAY))
    expect(state.habits.h1.logs[TODAY]).toBeUndefined()
  })

  test('can go past the target', () => {
    const state = seed(makeHabit({ goal: { kind: 'count', target: 2, unit: null }, logs: { [TODAY]: 2 } }))

    const next = apply(state, stepHabitDay(state, 'h1', TODAY, 1, TODAY))

    expect(next.habits.h1.logs[TODAY]).toBe(3)
  })
})
