import type { Habit } from '../../domain/types'
import { draftFromHabit, draftToInput, emptyDraft, HABIT_EXAMPLES, toggleDraftDay, validateDraft } from './habitDraft'

const TODAY = '2026-10-23'

describe('emptyDraft', () => {
  test('starts as a daily check habit starting today', () => {
    const draft = emptyDraft(TODAY, '#d9421c')

    expect(draft).toMatchObject({
      name: '',
      color: '#d9421c',
      frequencyType: 'daily',
      goalKind: 'check',
      startDate: TODAY,
      group: '',
      reminderTime: '',
    })
  })
})

describe('validateDraft', () => {
  const ok = { ...emptyDraft(TODAY, '#d9421c'), name: '스트레칭' }

  test('accepts a complete draft', () => {
    expect(validateDraft(ok)).toBeNull()
  })

  test('requires a name', () => {
    expect(validateDraft({ ...ok, name: '   ' })).toBe('이름을 입력해 주세요')
  })

  test('requires at least one weekday for weekday frequency', () => {
    expect(validateDraft({ ...ok, frequencyType: 'weekdays', days: [] })).toBe('요일을 하나 이상 골라 주세요')
  })

  test('requires times per week between 1 and 7', () => {
    expect(validateDraft({ ...ok, frequencyType: 'timesPerWeek', timesPerWeek: 0 })).toBe('주 1~7회 사이로 정해 주세요')
    expect(validateDraft({ ...ok, frequencyType: 'timesPerWeek', timesPerWeek: 8 })).toBe('주 1~7회 사이로 정해 주세요')
    expect(validateDraft({ ...ok, frequencyType: 'timesPerWeek', timesPerWeek: 3 })).toBeNull()
  })

  test('requires a positive count target', () => {
    expect(validateDraft({ ...ok, goalKind: 'count', target: 0 })).toBe('목표 횟수는 0보다 커야 해요')
    expect(validateDraft({ ...ok, goalKind: 'count', target: Number.NaN })).toBe('목표 횟수는 0보다 커야 해요')
  })

  test('ignores the count target for check goals', () => {
    expect(validateDraft({ ...ok, goalKind: 'check', target: 0 })).toBeNull()
  })

  test('requires a valid start date', () => {
    expect(validateDraft({ ...ok, startDate: '' })).toBe('시작일을 정해 주세요')
    expect(validateDraft({ ...ok, startDate: '2026-02-30' })).toBe('시작일을 정해 주세요')
  })

  test('rejects a malformed reminder time but allows blank', () => {
    expect(validateDraft({ ...ok, reminderTime: '' })).toBeNull()
    expect(validateDraft({ ...ok, reminderTime: '7시' })).toBe('알림 시각 형식이 맞지 않아요')
  })
})

describe('toggleDraftDay', () => {
  test('adds and removes a weekday without mutating the input', () => {
    const days = [1, 3] as const

    const added = toggleDraftDay(days, 5)
    const removed = toggleDraftDay(added, 1)

    expect(added).toEqual([1, 3, 5])
    expect(removed).toEqual([3, 5])
    expect(days).toEqual([1, 3])
  })
})

describe('draftToInput', () => {
  test('builds the matching frequency for each type', () => {
    const base = { ...emptyDraft(TODAY, '#d9421c'), name: '걷기' }

    expect(draftToInput(base).frequency).toEqual({ type: 'daily' })
    expect(draftToInput({ ...base, frequencyType: 'weekdays', days: [2, 4] }).frequency).toEqual({ type: 'weekdays', days: [2, 4] })
    expect(draftToInput({ ...base, frequencyType: 'timesPerWeek', timesPerWeek: 4 }).frequency).toEqual({ type: 'timesPerWeek', times: 4 })
  })

  test('maps goal, group and reminder, turning blanks into null', () => {
    const draft = {
      ...emptyDraft(TODAY, '#d9421c'),
      name: '물',
      goalKind: 'count' as const,
      target: 8,
      unit: '잔',
      group: '',
      reminderTime: '',
    }

    const input = draftToInput(draft)

    expect(input.goal).toEqual({ kind: 'count', target: 8, unit: '잔' })
    expect(input.group).toBeNull()
    expect(input.reminderTime).toBeNull()
  })

  test('sorts weekdays so equal selections produce equal data', () => {
    const draft = { ...emptyDraft(TODAY, '#d9421c'), name: 'a', frequencyType: 'weekdays' as const, days: [5, 1, 3] as const }

    expect(draftToInput({ ...draft, days: [...draft.days] }).frequency).toEqual({ type: 'weekdays', days: [1, 3, 5] })
  })
})

describe('draftFromHabit', () => {
  test('round-trips an existing habit through the draft', () => {
    const habit: Habit = {
      id: 'h',
      name: '독서',
      icon: null,
      color: '#7a3e8e',
      frequency: { type: 'timesPerWeek', times: 5 },
      goal: { kind: 'count', target: 20, unit: '쪽' },
      startDate: '2026-09-01',
      group: '저녁',
      reminderTime: '21:00',
      archived: false,
      logs: {},
      order: 1000,
    }

    const draft = draftFromHabit(habit)
    const input = draftToInput(draft)

    expect(draft.timesPerWeek).toBe(5)
    expect(input).toEqual({
      name: '독서',
      color: '#7a3e8e',
      frequency: { type: 'timesPerWeek', times: 5 },
      goal: { kind: 'count', target: 20, unit: '쪽' },
      startDate: '2026-09-01',
      group: '저녁',
      reminderTime: '21:00',
    })
  })
})

describe('HABIT_EXAMPLES', () => {
  test('every example is a valid draft', () => {
    for (const example of HABIT_EXAMPLES) {
      expect(validateDraft(draftFromExample(example))).toBeNull()
    }
    expect(HABIT_EXAMPLES.map((e) => e.name)).toContain('물 마시기')
    expect(HABIT_EXAMPLES.map((e) => e.name)).toContain('스트레칭')
  })
})

function draftFromExample(example: (typeof HABIT_EXAMPLES)[number]) {
  return { ...emptyDraft(TODAY, example.color), name: example.name, goalKind: example.goal.kind, target: example.goal.target, unit: example.goal.unit ?? '' }
}
