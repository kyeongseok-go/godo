// 습관 조작 명령 (순수 함수, ChangeSet 반환). 연속·달성 판정은 domain/stats 를 그대로 쓴다.
import { isTimeOfDay } from '../../domain/date'
import { habitValue, setHabitValue } from '../../domain/stats'
import type { Habit, HabitFrequency, ISODate, TimeOfDay } from '../../domain/types'
import { EMPTY_CHANGES } from '../../store/changes'
import type { ChangeSet, EntityState } from '../../store/changes'
import { newId } from '../../store/id'

export interface HabitInput {
  name: string
  color: string
  frequency: HabitFrequency
  goal: Habit['goal']
  startDate: ISODate
  group: string | null
  reminderTime: TimeOfDay | null
}

const ORDER_STEP = 1000
const DECIMALS = 100

const nextOrderOf = (items: readonly { order: number }[]): number =>
  items.reduce((max, i) => Math.max(max, i.order), 0) + ORDER_STEP

function normalizeName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('습관 이름을 입력해 주세요')
  return trimmed
}

function normalizeGoal(goal: Habit['goal']): Habit['goal'] {
  if (goal.kind === 'check') return { kind: 'check', target: 1, unit: null }
  if (!Number.isFinite(goal.target) || goal.target <= 0) throw new Error('목표 횟수는 0보다 커야 해요')
  return { kind: 'count', target: goal.target, unit: goal.unit?.trim() || null }
}

const normalizeGroup = (group: string | null): string | null => group?.trim() || null

const normalizeReminder = (time: TimeOfDay | null): TimeOfDay | null =>
  time !== null && isTimeOfDay(time) ? time : null

export function createHabit(
  state: EntityState,
  input: HabitInput,
): { changes: ChangeSet; habit: Habit } {
  const habit: Habit = {
    id: newId(),
    name: normalizeName(input.name),
    icon: null,
    color: input.color,
    frequency: input.frequency,
    goal: normalizeGoal(input.goal),
    startDate: input.startDate,
    group: normalizeGroup(input.group),
    reminderTime: normalizeReminder(input.reminderTime),
    archived: false,
    logs: {},
    order: nextOrderOf(Object.values(state.habits)),
  }
  return { habit, changes: { puts: { habits: [habit] }, deletes: {} } }
}

/** 이름·목표·그룹·알림은 저장 전에 같은 규칙으로 다듬는다. id 와 기록(logs)은 patch 로 바꾸지 못한다. */
export function patchHabit(state: EntityState, id: string, patch: Partial<Habit>): ChangeSet {
  const habit = state.habits[id]
  if (!habit) return EMPTY_CHANGES
  const merged: Habit = { ...habit, ...patch, id, logs: habit.logs }
  const next: Habit = {
    ...merged,
    name: normalizeName(merged.name),
    goal: normalizeGoal(merged.goal),
    group: normalizeGroup(merged.group),
    reminderTime: normalizeReminder(merged.reminderTime),
  }
  return { puts: { habits: [next] }, deletes: {} }
}

export const setHabitArchived = (state: EntityState, id: string, archived: boolean): ChangeSet =>
  patchHabit(state, id, { archived })

export function deleteHabit(state: EntityState, id: string): ChangeSet {
  return state.habits[id] ? { puts: {}, deletes: { habits: [id] } } : EMPTY_CHANGES
}

function normalizeValue(habit: Habit, value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  if (habit.goal.kind === 'check') return 1
  return Math.round(value * DECIMALS) / DECIMALS
}

/**
 * 한 날짜의 기록을 value 로 바꾼다. 미래 날짜는 무시한다.
 * 시작일보다 앞선 날을 기록하면 시작일을 그날로 당긴다(그래야 연속 기록에 잡힌다).
 */
export function writeHabitDay(
  state: EntityState,
  id: string,
  date: ISODate,
  value: number,
  today: ISODate,
): ChangeSet {
  const habit = state.habits[id]
  if (!habit || date > today) return EMPTY_CHANGES
  const clean = normalizeValue(habit, value)
  if (clean === 0 && habitValue(habit, date) === 0) return EMPTY_CHANGES
  const logged = setHabitValue(habit, date, clean)
  const next = clean > 0 && date < habit.startDate ? { ...logged, startDate: date } : logged
  return { puts: { habits: [next] }, deletes: {} }
}

/** 칸을 눌렀을 때: check 는 켬/끔, count 는 +1 하다가 목표에 닿은 뒤 한 번 더 누르면 비운다. */
export function toggleHabitDay(
  state: EntityState,
  id: string,
  date: ISODate,
  today: ISODate,
): ChangeSet {
  const habit = state.habits[id]
  if (!habit) return EMPTY_CHANGES
  const current = habitValue(habit, date)
  const next = current >= habit.goal.target ? 0 : current + 1
  return writeHabitDay(state, id, date, next, today)
}

/** 오늘 줄의 +/- 버튼용. 목표를 넘겨 기록할 수 있고 0 아래로는 내려가지 않는다. */
export function stepHabitDay(
  state: EntityState,
  id: string,
  date: ISODate,
  delta: number,
  today: ISODate,
): ChangeSet {
  const habit = state.habits[id]
  if (!habit) return EMPTY_CHANGES
  return writeHabitDay(state, id, date, habitValue(habit, date) + delta, today)
}
