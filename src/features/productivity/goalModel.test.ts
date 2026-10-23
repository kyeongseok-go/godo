import { DAILY_GOAL_RANGE, orderedWeekdays, stepGoal, toggleDayOff, WEEKLY_GOAL_RANGE } from './goalModel'

describe('stepGoal', () => {
  test('moves by the delta', () => {
    expect(stepGoal(5, 1, DAILY_GOAL_RANGE)).toBe(6)
    expect(stepGoal(5, -1, DAILY_GOAL_RANGE)).toBe(4)
  })

  test('stops at the range limits', () => {
    expect(stepGoal(DAILY_GOAL_RANGE.min, -1, DAILY_GOAL_RANGE)).toBe(DAILY_GOAL_RANGE.min)
    expect(stepGoal(WEEKLY_GOAL_RANGE.max, 5, WEEKLY_GOAL_RANGE)).toBe(WEEKLY_GOAL_RANGE.max)
  })

  test('pulls a stored out-of-range or fractional value back in', () => {
    expect(stepGoal(0, 0, DAILY_GOAL_RANGE)).toBe(DAILY_GOAL_RANGE.min)
    expect(stepGoal(4.6, 0, DAILY_GOAL_RANGE)).toBe(5)
    expect(stepGoal(Number.NaN, 1, DAILY_GOAL_RANGE)).toBe(DAILY_GOAL_RANGE.min + 1)
  })
})

describe('toggleDayOff', () => {
  test('adds a missing weekday and keeps the list sorted', () => {
    expect(toggleDayOff([6, 0], 3)).toEqual([0, 3, 6])
  })

  test('removes a weekday that is already off', () => {
    expect(toggleDayOff([0, 6], 6)).toEqual([0])
  })

  test('does not mutate its input', () => {
    const input = [0] as const
    toggleDayOff(input, 1)

    expect(input).toEqual([0])
  })
})

describe('orderedWeekdays', () => {
  test('starts on Monday or Sunday following the setting', () => {
    expect(orderedWeekdays(1)).toEqual([1, 2, 3, 4, 5, 6, 0])
    expect(orderedWeekdays(0)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })
})
