// 습관 만들기/편집 폼의 입력값(draft)과 검증·변환. 화면 상태가 아니라 순수 데이터만 다룬다.
import { isISODate, isTimeOfDay } from '../../domain/date'
import type { Habit, ISODate, Weekday } from '../../domain/types'
import type { HabitInput } from './commands'

export type FrequencyType = 'daily' | 'weekdays' | 'timesPerWeek'

export interface HabitDraft {
  name: string
  color: string
  frequencyType: FrequencyType
  days: Weekday[]
  timesPerWeek: number
  goalKind: 'check' | 'count'
  target: number
  unit: string
  startDate: string
  group: string
  reminderTime: string
}

const DEFAULT_WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5]
const MIN_TIMES = 1
const MAX_TIMES = 7
const DEFAULT_TIMES = 3
const DEFAULT_TARGET = 1

export function emptyDraft(today: ISODate, color: string): HabitDraft {
  return {
    name: '',
    color,
    frequencyType: 'daily',
    days: DEFAULT_WEEKDAYS,
    timesPerWeek: DEFAULT_TIMES,
    goalKind: 'check',
    target: DEFAULT_TARGET,
    unit: '',
    startDate: today,
    group: '',
    reminderTime: '',
  }
}

export function draftFromHabit(habit: Habit): HabitDraft {
  const { frequency, goal } = habit
  return {
    name: habit.name,
    color: habit.color,
    frequencyType: frequency.type,
    days: frequency.type === 'weekdays' ? [...frequency.days] : DEFAULT_WEEKDAYS,
    timesPerWeek: frequency.type === 'timesPerWeek' ? frequency.times : DEFAULT_TIMES,
    goalKind: goal.kind,
    target: goal.target,
    unit: goal.unit ?? '',
    startDate: habit.startDate,
    group: habit.group ?? '',
    reminderTime: habit.reminderTime ?? '',
  }
}

/** 첫 번째로 걸리는 문제를 한국어로 돌려준다. 문제가 없으면 null. */
export function validateDraft(draft: HabitDraft): string | null {
  if (draft.name.trim() === '') return '이름을 입력해 주세요'
  if (draft.frequencyType === 'weekdays' && draft.days.length === 0) return '요일을 하나 이상 골라 주세요'
  if (draft.frequencyType === 'timesPerWeek') {
    const { timesPerWeek } = draft
    if (!Number.isInteger(timesPerWeek) || timesPerWeek < MIN_TIMES || timesPerWeek > MAX_TIMES) {
      return '주 1~7회 사이로 정해 주세요'
    }
  }
  if (draft.goalKind === 'count' && !(Number.isFinite(draft.target) && draft.target > 0)) {
    return '목표 횟수는 0보다 커야 해요'
  }
  if (!isISODate(draft.startDate)) return '시작일을 정해 주세요'
  if (draft.reminderTime !== '' && !isTimeOfDay(draft.reminderTime)) return '알림 시각 형식이 맞지 않아요'
  return null
}

export function toggleDraftDay(days: readonly Weekday[], day: Weekday): Weekday[] {
  return days.includes(day) ? days.filter((d) => d !== day) : [...days, day]
}

export function draftToInput(draft: HabitDraft): HabitInput {
  const frequency: HabitInput['frequency'] =
    draft.frequencyType === 'weekdays'
      ? { type: 'weekdays', days: [...draft.days].sort((a, b) => a - b) }
      : draft.frequencyType === 'timesPerWeek'
        ? { type: 'timesPerWeek', times: draft.timesPerWeek }
        : { type: 'daily' }
  return {
    name: draft.name,
    color: draft.color,
    frequency,
    goal:
      draft.goalKind === 'count'
        ? { kind: 'count', target: draft.target, unit: draft.unit.trim() || null }
        : { kind: 'check', target: 1, unit: null },
    startDate: draft.startDate,
    group: draft.group.trim() || null,
    reminderTime: draft.reminderTime || null,
  }
}

export interface HabitExample {
  name: string
  color: string
  goal: Habit['goal']
}

/** 빈 상태에서 한 번에 만들 수 있는 예시. 색은 팔레트 값을 쓴다. */
export const HABIT_EXAMPLES: readonly HabitExample[] = [
  { name: '물 마시기', color: '#2b4c7e', goal: { kind: 'count', target: 8, unit: '잔' } },
  { name: '스트레칭', color: '#2f6f5e', goal: { kind: 'check', target: 1, unit: null } },
  { name: '책 읽기', color: '#7a3e8e', goal: { kind: 'count', target: 20, unit: '쪽' } },
  { name: '걷기', color: '#b8860b', goal: { kind: 'count', target: 6000, unit: '걸음' } },
]
