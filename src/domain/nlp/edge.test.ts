import { parseQuickAdd } from './index'
import { makeCtx } from './test-ctx'

const ctx = makeCtx()
const parse = (s: string, c = ctx) => parseQuickAdd(s, c)

describe('positions and text handling', () => {
  test('token offsets count UTF-16 units of the original input, even after emoji', () => {
    const input = '🙂 회의  내일   오후 3시 #업무'
    const r = parse(input)
    for (const t of r.tokens) expect(input.slice(t.start, t.end)).toBe(t.text)
    expect(r.title).toBe('🙂 회의')
    expect(r.projectId).toBe('p-work')
  })

  test('handles tabs, full-width spaces and repeated blanks', () => {
    const r = parse('회의\t\t내일　오후 3시')
    expect(r.title).toBe('회의')
    expect(r.startTime).toBe('15:00')
  })

  test('is case-insensitive for English words and labels', () => {
    const r = parse('Call TOMORROW 5PM P2 @URGENT #work')
    expect(r.startDate).toBe('2026-10-24')
    expect(r.startTime).toBe('17:00')
    expect(r.priority).toBe(2)
    expect(r.labelIds).toEqual(['l-urgent'])
    expect(r.projectId).toBe('p-en')
    expect(r.title).toBe('Call')
  })

  test('returns an untouched but whitespace-normalised title when nothing is recognised', () => {
    expect(parse('  그냥   메모  ').title).toBe('그냥 메모')
  })
})

describe('quoted names', () => {
  test('quoted projects and sections match exactly', () => {
    const r = parse('#"개인" /"장보기" 우유')
    expect(r.projectId).toBe('p-home')
    expect(r.sectionId).toBe('s-home-buy')
    expect(r.title).toBe('우유')
  })

  test('curly quotes work and an unknown quoted name is ignored', () => {
    expect(parse('#“내 프로젝트” 일').projectId).toBe('p-my')
    expect(parse('#"없음" 일').title).toBe('#"없음" 일')
  })
})

describe('day-part hints for bare hours', () => {
  test('an evening word nearby makes a bare 7시 mean 19:00', () => {
    expect(parse('7시 저녁 약속').startTime).toBe('19:00')
    expect(parse('밤 산책 2시').startTime).toBe('02:00')
  })

  test('morning and lunch words do not bend the default reading', () => {
    expect(parse('아침 운동 후 3시 회의').startTime).toBe('15:00')
    expect(parse('점심 약속 11시').startTime).toBe('11:00')
  })

  test('a hint that cannot apply falls back to the default reading', () => {
    expect(parse('저녁 약속 12시').startTime).toBe('12:00')
  })

  test('the nearest hint word wins', () => {
    expect(parse('오후 저녁 약속 7시').startTime).toBe('19:00')
  })
})

describe('week and weekday arithmetic', () => {
  test('last week and "담주" are supported', () => {
    expect(parse('지난주 금요일 회고').startDate).toBe('2026-10-16')
    expect(parse('담주 월요일 회의').startDate).toBe('2026-10-26')
  })

  test('uses Sunday-start weeks when configured', () => {
    const sun = makeCtx({ weekStartsOn: 0 })
    expect(parse('이번 주 월요일', sun).startDate).toBe('2026-10-19')
    expect(parse('이번 주 토요일', sun).startDate).toBe('2026-10-24')
    expect(parse('다음 주 일요일', sun).startDate).toBe('2026-10-25')
  })

  test('weekend uses the configured week start on a Sunday', () => {
    const sunday = makeCtx({ today: '2026-10-25', now: new Date(2026, 9, 25, 9, 0), weekStartsOn: 0 })
    expect(parse('주말 청소', sunday).startDate).toBe('2026-10-31')
  })

  test('English bare weekday with "on" and time', () => {
    const r = parse('dentist on monday at 3pm')
    expect(r.startDate).toBe('2026-10-26')
    expect(r.startTime).toBe('15:00')
    expect(r.title).toBe('dentist')
  })

  test('English "tomorrow at 5pm" removes the filler word', () => {
    expect(parse('call tomorrow at 5pm').title).toBe('call')
  })
})

describe('rejected recurrence and date values', () => {
  test.each([
    '매월 32일 정산',
    '매월 0일 정산',
    '0일마다 운동',
    '0주마다 운동',
    '매년 2월 30일 기념일',
    'every 32nd gym',
    'every feb 30 gym',
    'every 0 weeks gym',
  ])('"%s" is not a recurrence it could build', (input) => {
    const r = parse(input)
    expect(r.recurrence?.byMonthDay ?? null).toBeNull()
    if (input.startsWith('0') || input.includes('0주') || input.includes('0 weeks')) {
      expect(r.recurrence).toBeNull()
    }
  })

  test('far-off relative offsets still resolve', () => {
    expect(parse('1000일 후 점검').startDate).toBe('2029-07-19')
  })

  test('English month-day with an impossible day is ignored', () => {
    expect(parse('feb 30 meeting').startDate).toBeNull()
  })
})

describe('recurrence variants', () => {
  test('날마다 and 매일매일 are daily', () => {
    expect(parse('날마다 운동').recurrence?.freq).toBe('daily')
    expect(parse('매일매일 운동').recurrence?.freq).toBe('daily')
  })

  test('completion prefix works with monthly phrases', () => {
    const r = parse('완료 후 매월 25일 정산')
    expect(r.recurrence).toMatchObject({ freq: 'monthly', byMonthDay: 25, anchor: 'completion' })
    expect(r.title).toBe('정산')
  })

  test('English every 2 weeks on monday keeps the weekday as the start date', () => {
    const r = parse('sync every 2 weeks on monday')
    expect(r.recurrence).toMatchObject({ freq: 'weekly', interval: 2 })
    expect(r.startDate).toBe('2026-10-26')
    expect(r.title).toBe('sync')
  })

  test('every weekday starting on a weekend picks Monday', () => {
    const sat = makeCtx({ today: '2026-10-24', now: new Date(2026, 9, 24, 9, 0) })
    expect(parse('every weekday standup', sat).startDate).toBe('2026-10-26')
  })

  test('nth weekday of this month is used when it is still ahead', () => {
    const early = makeCtx({ today: '2026-10-01', now: new Date(2026, 9, 1, 9, 0) })
    expect(parse('매월 첫째 월요일 회의', early).startDate).toBe('2026-10-05')
    expect(parse('매월 마지막 금요일 회의', early).startDate).toBe('2026-10-30')
  })

  test('monthly day that equals today starts today', () => {
    expect(parse('매월 23일 정산').startDate).toBe('2026-10-23')
  })

  test('yearly labels with intervals and intervals on other units', () => {
    expect(parse('2년마다 점검').tokens[0].label).toBe('2년마다')
    expect(parse('5일마다 점검').tokens[0].label).toBe('5일마다')
    expect(parse('격주 금요일 청소').tokens[0].label).toBe('2주마다 금요일')
    expect(parse('매주 월/수 청소').tokens[0].label).toBe('매주 월·수')
    expect(parse('매주 청소').tokens[0].label).toBe('매주')
    expect(parse('매월 둘째 화요일 회의').tokens[0].label).toBe('매월 둘째 화요일')
    expect(parse('매월 정산').tokens[0].label).toBe('매월')
    expect(parse('완료 후 매주 청소').tokens[0].label).toBe('완료 후 매주')
  })
})

describe('reminders and estimates', () => {
  test('zero-minute reminders mean "at the start time"', () => {
    expect(parse('회의 !0분').reminderOffsetsMin).toEqual([0])
  })

  test('combined day-hour-minute reminders', () => {
    expect(parse('회의 !1일 2시간 30분').reminderOffsetsMin).toEqual([1590])
    expect(parse('회의 !2d').reminderOffsetsMin).toEqual([2880])
  })

  test('estimate rejects zero and leading blanks', () => {
    expect(parse('일 ~0분').estimateMin).toBeNull()
    expect(parse('일 ~ 30분').estimateMin).toBeNull()
  })

  test('estimate label and reminder label are Korean', () => {
    expect(parse('일 ~1h30m').tokens[0].label).toBe('예상 1시간 30분')
    expect(parse('일 !1일').tokens[0].label).toBe('1일 전 알림')
    expect(parse('일 !15분').tokens[0].label).toBe('15분 전 알림')
  })
})

describe('time details', () => {
  test('a second time stays in the title', () => {
    const r = parse('오전 9시 회의 오후 3시 정리')
    expect(r.startTime).toBe('09:00')
    expect(r.title).toBe('회의 오후 3시 정리')
  })

  test('time followed by 부터 without an end is a plain start time', () => {
    const r = parse('내일 3시부터 운동')
    expect(r.startTime).toBe('15:00')
    expect(r.durationMin).toBeNull()
    expect(r.title).toBe('운동')
  })

  test('3-4pm style shared meridiem wraps to the previous half-day when needed', () => {
    const r = parse('11-1pm 점심')
    expect(r.startTime).toBe('11:00')
    expect(r.durationMin).toBe(120)
  })

  test('12-1pm keeps noon as the start', () => {
    const r = parse('12-1pm 점심')
    expect(r.startTime).toBe('12:00')
    expect(r.durationMin).toBe(60)
  })

  test('shared meridiem with an impossible hour is ignored', () => {
    expect(parse('13-14pm 점심').startTime).toBeNull()
    expect(parse('3-3pm 점심').durationMin).toBeNull()
  })

  test('half hour with colon marker', () => {
    expect(parse('내일 오후 3:30 회의').startTime).toBe('15:30')
  })
})
