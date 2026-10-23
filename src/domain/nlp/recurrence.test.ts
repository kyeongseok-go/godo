import type { RecurrenceRule } from '../types'
import { parseQuickAdd } from './index'
import { makeCtx } from './test-ctx'

const ctx = makeCtx() // 오늘 2026-10-23(금)

const base: Pick<RecurrenceRule, 'anchor' | 'end' | 'resetSubtasks'> = {
  anchor: 'due',
  end: { type: 'never' },
  resetSubtasks: false,
}
const rule = (r: Partial<RecurrenceRule> & Pick<RecurrenceRule, 'freq' | 'interval'>): RecurrenceRule => ({
  ...base,
  ...r,
})
const rec = (s: string, c = ctx) => parseQuickAdd(s, c).recurrence

describe('Korean daily and interval recurrences', () => {
  test('매일 is a daily rule starting today', () => {
    const r = parseQuickAdd('매일 운동', ctx)
    expect(r.recurrence).toEqual(rule({ freq: 'daily', interval: 1 }))
    expect(r.startDate).toBe('2026-10-23')
    expect(r.title).toBe('운동')
    expect(r.tokens).toEqual([expect.objectContaining({ kind: 'recurrence', text: '매일', label: '매일' })])
  })

  test.each([
    ['매일마다 운동', { freq: 'daily', interval: 1 }],
    ['3일마다 운동', { freq: 'daily', interval: 3 }],
    ['3일 마다 운동', { freq: 'daily', interval: 3 }],
    ['격일 운동', { freq: 'daily', interval: 2 }],
    ['2주마다 청소', { freq: 'weekly', interval: 2 }],
    ['격주 청소', { freq: 'weekly', interval: 2 }],
    ['2주일마다 청소', { freq: 'weekly', interval: 2 }],
    ['3개월마다 점검', { freq: 'monthly', interval: 3 }],
    ['격월 점검', { freq: 'monthly', interval: 2 }],
    ['2년마다 점검', { freq: 'yearly', interval: 2 }],
    ['매달 정산', { freq: 'monthly', interval: 1 }],
    ['매월 정산', { freq: 'monthly', interval: 1 }],
    ['매년 건강검진', { freq: 'yearly', interval: 1 }],
    ['해마다 건강검진', { freq: 'yearly', interval: 1 }],
    ['매주 청소', { freq: 'weekly', interval: 1 }],
  ] as const)('reads "%s"', (input, partial) => {
    expect(rec(input)).toEqual(rule(partial))
  })

  test('bare weekly recurrences start today and use the start weekday', () => {
    const r = parseQuickAdd('매주 청소', ctx)
    expect(r.startDate).toBe('2026-10-23')
    expect(r.recurrence?.byWeekday).toBeUndefined()
  })
})

describe('Korean weekly recurrences with weekdays', () => {
  test('매주 월요일 starts on the coming Monday', () => {
    const r = parseQuickAdd('매주 월요일 스탠드업', ctx)
    expect(r.recurrence).toEqual(rule({ freq: 'weekly', interval: 1, byWeekday: [1] }))
    expect(r.startDate).toBe('2026-10-26')
    expect(r.title).toBe('스탠드업')
  })

  test('매주 월요일 on a Monday starts today', () => {
    const monday = makeCtx({ today: '2026-10-26', now: new Date(2026, 9, 26, 8, 0) })
    expect(parseQuickAdd('매주 월요일 스탠드업', monday).startDate).toBe('2026-10-26')
  })

  test('매주 월요일 오전 9시 gives both a rule and a time (TickTick cannot)', () => {
    const r = parseQuickAdd('매주 월요일 오전 9시 팀 미팅', ctx)
    expect(r.recurrence).toEqual(rule({ freq: 'weekly', interval: 1, byWeekday: [1] }))
    expect(r.startDate).toBe('2026-10-26')
    expect(r.startTime).toBe('09:00')
    expect(r.title).toBe('팀 미팅')
    expect(r.tokens.map((t) => t.kind)).toEqual(['recurrence', 'time'])
  })

  test.each([
    ['매주 월/수/금 운동', [1, 3, 5]],
    ['매주 월,수,금 운동', [1, 3, 5]],
    ['매주 월, 수, 금 운동', [1, 3, 5]],
    ['매주 월수금 운동', [1, 3, 5]],
    ['매주 월요일, 수요일 운동', [1, 3]],
    ['매주 월요일과 수요일 운동', [1, 3]],
    ['매주 금/월 운동', [1, 5]],
    ['매주 일요일 운동', [0]],
    ['매주 화요일마다 운동', [2]],
    ['매 월요일 운동', [1]],
    ['매 주 목요일 운동', [4]],
    ['월요일마다 운동', [1]],
    ['월요일, 목요일마다 운동', [1, 4]],
    ['매주 평일 운동', [1, 2, 3, 4, 5]],
    ['평일마다 운동', [1, 2, 3, 4, 5]],
    ['매 평일 운동', [1, 2, 3, 4, 5]],
    ['매일 평일 운동', [1, 2, 3, 4, 5]],
    ['주말마다 운동', [0, 6]],
    ['매 주말 운동', [0, 6]],
    ['매주 주말 운동', [0, 6]],
  ])('reads "%s"', (input, days) => {
    const r = parseQuickAdd(input, ctx)
    expect(r.recurrence).toEqual(rule({ freq: 'weekly', interval: 1, byWeekday: days as RecurrenceRule['byWeekday'] }))
    expect(r.title).toBe('운동')
  })

  test('first occurrence is the nearest listed weekday on or after today', () => {
    expect(parseQuickAdd('매주 월/수/금 운동', ctx).startDate).toBe('2026-10-23') // 오늘이 금요일
    expect(parseQuickAdd('매주 화/목 운동', ctx).startDate).toBe('2026-10-27')
    expect(parseQuickAdd('주말마다 운동', ctx).startDate).toBe('2026-10-24')
    expect(parseQuickAdd('평일마다 운동', ctx).startDate).toBe('2026-10-23')
  })

  test('격주 and N주마다 accept a trailing weekday list', () => {
    expect(rec('격주 금요일 청소')).toEqual(rule({ freq: 'weekly', interval: 2, byWeekday: [5] }))
    expect(rec('2주마다 월/수 청소')).toEqual(rule({ freq: 'weekly', interval: 2, byWeekday: [1, 3] }))
    expect(parseQuickAdd('격주 금요일 청소', ctx).title).toBe('청소')
  })

  test('does not read single syllables inside other words as weekdays', () => {
    for (const s of ['매주 일찍 일어나기', '매주 토익 공부', '매주 수업 준비', '매주 금융 공부', '매주 목욕']) {
      const r = parseQuickAdd(s, ctx)
      expect(r.recurrence).toEqual(rule({ freq: 'weekly', interval: 1 }))
      expect(r.recurrence?.byWeekday).toBeUndefined()
    }
  })
})

describe('Korean monthly and yearly recurrences', () => {
  test('매월 25일 starts on the next 25th', () => {
    const r = parseQuickAdd('매월 25일 월세', ctx)
    expect(r.recurrence).toEqual(rule({ freq: 'monthly', interval: 1, byMonthDay: 25 }))
    expect(r.startDate).toBe('2026-10-25')
    expect(r.title).toBe('월세')
  })

  test('rolls to next month when this month already passed the day', () => {
    expect(parseQuickAdd('매월 5일 월세', ctx).startDate).toBe('2026-11-05')
    expect(parseQuickAdd('매달 23일 월세', ctx).startDate).toBe('2026-10-23')
  })

  test('clamps day 31 to short months for the first occurrence', () => {
    const nov = makeCtx({ today: '2026-11-10', now: new Date(2026, 10, 10, 8, 0) })
    const r = parseQuickAdd('매월 31일 정산', nov)
    expect(r.recurrence?.byMonthDay).toBe(31)
    expect(r.startDate).toBe('2026-11-30')
  })

  test.each([
    ['매월 마지막 날 정산', 'last'],
    ['매월 말일 정산', 'last'],
    ['매월 말 정산', 'last'],
    ['매달 마지막날 정산', 'last'],
  ])('reads "%s"', (input, day) => {
    const r = parseQuickAdd(input, ctx)
    expect(r.recurrence).toEqual(rule({ freq: 'monthly', interval: 1, byMonthDay: day as 'last' }))
    expect(r.startDate).toBe('2026-10-31')
    expect(r.title).toBe('정산')
  })

  test('nth weekday of the month', () => {
    const r = parseQuickAdd('매월 첫째 월요일 회의', ctx)
    expect(r.recurrence).toEqual(rule({ freq: 'monthly', interval: 1, nth: { n: 1, weekday: 1 } }))
    expect(r.startDate).toBe('2026-11-02') // 10월 첫째 월요일(5일)은 지났다
    expect(r.title).toBe('회의')
  })

  test.each([
    ['매월 둘째 화요일 회의', { n: 2, weekday: 2 }, '2026-11-10'],
    ['매월 셋째 주 금요일 회의', { n: 3, weekday: 5 }, '2026-11-20'],
    ['매월 넷째 일요일 회의', { n: 4, weekday: 0 }, '2026-10-25'],
    ['매월 마지막 금요일 회의', { n: -1, weekday: 5 }, '2026-10-30'],
    ['매월 첫 번째 수요일 회의', { n: 1, weekday: 3 }, '2026-11-04'],
  ] as const)('reads "%s"', (input, nth, first) => {
    const r = parseQuickAdd(input, ctx)
    expect(r.recurrence).toEqual(rule({ freq: 'monthly', interval: 1, nth }))
    expect(r.startDate).toBe(first)
    expect(r.title).toBe('회의')
  })

  test('매년 3월 2일 starts on the next March 2nd', () => {
    const r = parseQuickAdd('매년 3월 2일 기념일', ctx)
    expect(r.recurrence).toEqual(rule({ freq: 'yearly', interval: 1 }))
    expect(r.startDate).toBe('2027-03-02')
    expect(r.title).toBe('기념일')
    expect(r.tokens).toHaveLength(1)
  })

  test('매년 with M/D or a date still ahead this year', () => {
    expect(parseQuickAdd('매년 12/25 파티', ctx).startDate).toBe('2026-12-25')
    expect(parseQuickAdd('매년 10월 23일 기념일', ctx).startDate).toBe('2026-10-23')
    expect(parseQuickAdd('해마다 2월 29일 생일', ctx).startDate).toBe('2028-02-29')
  })

  test('매년 alone starts today', () => {
    expect(parseQuickAdd('매년 건강검진', ctx).startDate).toBe('2026-10-23')
  })
})

describe('anchor on completion', () => {
  test.each([
    '완료 후 3일마다 물주기',
    '끝낸 날부터 3일마다 물주기',
    '완료한 후 3일마다 물주기',
    '완료일 기준 3일마다 물주기',
    '완료 뒤 3일마다 물주기',
  ])('%s', (input) => {
    const r = parseQuickAdd(input, ctx)
    expect(r.recurrence).toEqual(rule({ freq: 'daily', interval: 3, anchor: 'completion' }))
    expect(r.title).toBe('물주기')
    expect(r.tokens).toHaveLength(1)
    expect(r.tokens[0].label).toContain('완료')
  })

  test('works with weekly intervals as well', () => {
    expect(rec('완료 후 2주마다 청소')).toEqual(rule({ freq: 'weekly', interval: 2, anchor: 'completion' }))
  })
})

describe('English recurrences', () => {
  test.each([
    ['every day gym', { freq: 'daily', interval: 1 }],
    ['everyday gym', { freq: 'daily', interval: 1 }],
    ['gym daily', { freq: 'daily', interval: 1 }],
    ['every other day gym', { freq: 'daily', interval: 2 }],
    ['every 3 days gym', { freq: 'daily', interval: 3 }],
    ['every week gym', { freq: 'weekly', interval: 1 }],
    ['gym weekly', { freq: 'weekly', interval: 1 }],
    ['every other week gym', { freq: 'weekly', interval: 2 }],
    ['every 2 weeks gym', { freq: 'weekly', interval: 2 }],
    ['every month gym', { freq: 'monthly', interval: 1 }],
    ['gym monthly', { freq: 'monthly', interval: 1 }],
    ['every 3 months gym', { freq: 'monthly', interval: 3 }],
    ['every year gym', { freq: 'yearly', interval: 1 }],
    ['gym yearly', { freq: 'yearly', interval: 1 }],
    ['gym annually', { freq: 'yearly', interval: 1 }],
    ['every weekday gym', { freq: 'weekly', interval: 1, byWeekday: [1, 2, 3, 4, 5] }],
    ['every weekend gym', { freq: 'weekly', interval: 1, byWeekday: [0, 6] }],
    ['every mon,wed,fri gym', { freq: 'weekly', interval: 1, byWeekday: [1, 3, 5] }],
    ['every mon, wed, fri gym', { freq: 'weekly', interval: 1, byWeekday: [1, 3, 5] }],
    ['every monday and wednesday gym', { freq: 'weekly', interval: 1, byWeekday: [1, 3] }],
    ['every friday gym', { freq: 'weekly', interval: 1, byWeekday: [5] }],
    ['every 25th gym', { freq: 'monthly', interval: 1, byMonthDay: 25 }],
    ['every month on the 25th gym', { freq: 'monthly', interval: 1, byMonthDay: 25 }],
    ['every last day gym', { freq: 'monthly', interval: 1, byMonthDay: 'last' }],
    ['every first monday gym', { freq: 'monthly', interval: 1, nth: { n: 1, weekday: 1 } }],
    ['every last friday gym', { freq: 'monthly', interval: 1, nth: { n: -1, weekday: 5 } }],
  ] as const)('reads "%s"', (input, partial) => {
    const r = parseQuickAdd(input, ctx)
    expect(r.recurrence).toEqual(rule(partial as unknown as Parameters<typeof rule>[0]))
    expect(r.title).toBe('gym')
  })

  test('every! switches to completion-based', () => {
    expect(rec('water plants every! 3 days')).toEqual(rule({ freq: 'daily', interval: 3, anchor: 'completion' }))
    expect(rec('water plants every! week')).toEqual(rule({ freq: 'weekly', interval: 1, anchor: 'completion' }))
    expect(parseQuickAdd('water plants every! 3 days', ctx).title).toBe('water plants')
  })

  test('every yearly date starts on the next such day', () => {
    const r = parseQuickAdd('birthday every mar 2', ctx)
    expect(r.recurrence).toEqual(rule({ freq: 'yearly', interval: 1 }))
    expect(r.startDate).toBe('2027-03-02')
    expect(r.title).toBe('birthday')
  })

  test('mixes with Korean in one sentence', () => {
    const r = parseQuickAdd('every mon,wed 오전 9시 팀 미팅 #업무', ctx)
    expect(r.recurrence?.byWeekday).toEqual([1, 3])
    expect(r.startTime).toBe('09:00')
    expect(r.projectId).toBe('p-work')
    expect(r.title).toBe('팀 미팅')
  })

  test('does not read "every" inside other words or without a unit', () => {
    for (const s of ['everything done', 'every thing', 'every 0 days', 'every sunny day']) {
      expect(rec(s)).toBeNull()
    }
  })
})

describe('recurrence interplay', () => {
  test('keeps an explicit start date', () => {
    const r = parseQuickAdd('내일부터 매일 운동', ctx)
    expect(r.startDate).toBe('2026-10-24')
    expect(r.recurrence?.freq).toBe('daily')
    expect(r.title).toBe('운동')
  })

  test('does not treat the weekday of a recurrence as a start date', () => {
    const r = parseQuickAdd('매주 금요일 회고', ctx)
    expect(r.startDate).toBe('2026-10-23')
    expect(r.tokens.map((t) => t.kind)).toEqual(['recurrence'])
  })

  test('a time with a recurrence does not push the first occurrence to tomorrow', () => {
    const r = parseQuickAdd('매일 오전 9시 약 복용', ctx)
    expect(r.startDate).toBe('2026-10-23')
    expect(r.startTime).toBe('09:00')
  })

  test('a recurrence and a deadline can coexist', () => {
    const r = parseQuickAdd('매주 월요일 보고 {12월 1일}', ctx)
    expect(r.recurrence?.byWeekday).toEqual([1])
    expect(r.dueDate).toBe('2026-12-01')
  })

  test('a second recurrence phrase stays in the title', () => {
    const r = parseQuickAdd('매일 운동 매주 청소', ctx)
    expect(r.recurrence?.freq).toBe('daily')
    expect(r.title).toBe('운동 매주 청소')
  })

  test('recurrence labels are readable Korean', () => {
    const label = (s: string) => parseQuickAdd(s, ctx).tokens[0].label
    expect(label('매주 월/수/금 운동')).toBe('매주 월·수·금')
    expect(label('격주 청소')).toBe('2주마다')
    expect(label('매월 25일 월세')).toBe('매월 25일')
    expect(label('매월 마지막 날 정산')).toBe('매월 마지막 날')
    expect(label('매월 첫째 월요일 회의')).toBe('매월 첫째 월요일')
    expect(label('매월 마지막 금요일 회의')).toBe('매월 마지막 금요일')
    expect(label('평일마다 운동')).toBe('평일마다')
    expect(label('주말마다 운동')).toBe('주말마다')
    expect(label('매년 3월 2일 기념일')).toBe('매년')
    expect(label('3개월마다 점검')).toBe('3개월마다')
    expect(label('2년마다 점검')).toBe('2년마다')
    expect(label('완료 후 3일마다 물주기')).toBe('완료 후 3일마다')
    expect(label('매일 운동')).toBe('매일')
    expect(label('매달 정산')).toBe('매월')
  })
})
