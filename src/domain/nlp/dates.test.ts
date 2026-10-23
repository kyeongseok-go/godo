import { parseQuickAdd } from './index'
import { makeCtx } from './test-ctx'

const ctx = makeCtx() // 오늘 2026-10-23(금), 주 시작 월요일
const start = (s: string, c = ctx) => parseQuickAdd(s, c).startDate

describe('Korean relative days', () => {
  test.each([
    ['오늘', '2026-10-23'],
    ['내일', '2026-10-24'],
    ['모레', '2026-10-25'],
    ['내일모레', '2026-10-25'],
    ['글피', '2026-10-26'],
    ['어제', '2026-10-22'],
    ['그저께', '2026-10-21'],
  ])('reads %s', (word, expected) => {
    expect(start(`${word} 회의`)).toBe(expected)
  })

  test('removes the date phrase and records a date token', () => {
    const r = parseQuickAdd('팀 회의 내일', ctx)
    expect(r.title).toBe('팀 회의')
    expect(r.tokens).toEqual([
      expect.objectContaining({ kind: 'date', start: 5, end: 7, text: '내일', label: expect.stringContaining('내일') }),
    ])
  })

  test('absorbs a trailing particle into the phrase', () => {
    for (const s of ['내일은 회의', '내일에 회의', '내일부터 운동']) {
      expect(start(s)).toBe('2026-10-24')
    }
    expect(parseQuickAdd('내일부터 운동', ctx).title).toBe('운동')
  })

  test('does not read dates glued into longer words', () => {
    for (const s of ['내일배움카드 신청', '오늘날의 과제', '모레사막 여행']) {
      expect(start(s)).toBeNull()
      expect(parseQuickAdd(s, ctx).title).toBe(s)
    }
  })
})

describe('Korean weekdays', () => {
  test('a bare weekday means the nearest one after today', () => {
    expect(start('금요일 회의')).toBe('2026-10-30') // 오늘이 금요일이어도 다음 금요일
    expect(start('월요일 회의')).toBe('2026-10-26')
    expect(start('토요일 회의')).toBe('2026-10-24')
    expect(start('일요일에 회의')).toBe('2026-10-25')
  })

  test('this, next and next-next week with a weekday', () => {
    expect(start('이번 주 금요일 회의')).toBe('2026-10-23')
    expect(start('이번주 월요일')).toBe('2026-10-19')
    expect(start('다음 주 수요일 회의')).toBe('2026-10-28')
    expect(start('다음주 수 회의')).toBe('2026-10-28')
    expect(start('다음 주 금 회의')).toBe('2026-10-30')
    expect(start('다다음 주 월요일 회의')).toBe('2026-11-02')
    expect(start('다다음주 화요일')).toBe('2026-11-03')
  })

  test('week boundaries follow weekStartsOn', () => {
    expect(start('다음 주 일요일', makeCtx({ weekStartsOn: 1 }))).toBe('2026-11-01')
    expect(start('다음 주 일요일', makeCtx({ weekStartsOn: 0 }))).toBe('2026-10-25')
    expect(start('이번 주 일요일', makeCtx({ weekStartsOn: 1 }))).toBe('2026-10-25')
  })

  test('weekday phrases without 주 use the same week arithmetic', () => {
    expect(start('이번 토요일')).toBe('2026-10-24')
    expect(start('다음 월요일')).toBe('2026-10-26')
  })

  test('주를 생략한 지난·다다음 요일도 수식어까지 읽는다', () => {
    const past = parseQuickAdd('지난 금요일 회의록', ctx)
    expect(past.startDate).toBe('2026-10-16')
    expect(past.title).toBe('회의록')
    const afterNext = parseQuickAdd('다다음 월요일 회의', ctx)
    expect(afterNext.startDate).toBe('2026-11-02')
    expect(afterNext.title).toBe('회의')
    expect(start('저번 금요일 회고')).toBe('2026-10-16')
    expect(start('담 화요일 회의')).toBe('2026-10-27')
  })

  test('weekend means the coming Saturday, or today during the weekend', () => {
    expect(start('주말 대청소')).toBe('2026-10-24')
    expect(start('이번 주말에 대청소')).toBe('2026-10-24')
    expect(start('다음 주말 여행')).toBe('2026-10-31')
    const sunday = makeCtx({ today: '2026-10-25', now: new Date(2026, 9, 25, 9, 0) })
    expect(start('주말 대청소', sunday)).toBe('2026-10-25')
  })

  test('does not read ambiguous single syllables or plain nouns as weekdays', () => {
    for (const s of ['금 4g 구매', '수 정리', '월 보고 정리', '주말농장 가기', '화요일날']) {
      expect(start(s)).toBeNull()
    }
    expect(start('다음 주 일 정리')).toBeNull()
  })
})

describe('Korean offsets and month days', () => {
  test.each([
    ['3일 후 점검', '2026-10-26'],
    ['3일 뒤 점검', '2026-10-26'],
    ['3일후 점검', '2026-10-26'],
    ['2주 후 점검', '2026-11-06'],
    ['2주일 뒤 점검', '2026-11-06'],
    ['1개월 후 점검', '2026-11-23'],
    ['2달 뒤 점검', '2026-12-23'],
    ['1년 후 점검', '2027-10-23'],
    ['일주일 후 점검', '2026-10-30'],
    ['이틀 뒤 점검', '2026-10-25'],
    ['한 달 뒤 점검', '2026-11-23'],
  ])('reads %s', (input, expected) => {
    expect(start(input)).toBe(expected)
  })

  test('clamps month offsets to the end of shorter months', () => {
    const jan31 = makeCtx({ today: '2026-01-31', now: new Date(2026, 0, 31, 8, 0) })
    expect(start('1개월 후 점검', jan31)).toBe('2026-02-28')
  })

  test('reads month-day phrases and rolls past dates into next year', () => {
    expect(start('10월 30일 마감 준비')).toBe('2026-10-30')
    expect(start('10월 23일 행사')).toBe('2026-10-23') // 오늘은 지난 날이 아니다
    expect(start('3월 2일 행사')).toBe('2027-03-02')
    expect(start('10월 22일 행사')).toBe('2027-10-22')
    expect(start('3월 2일에 행사')).toBe('2027-03-02')
    expect(start('12/25 파티')).toBe('2026-12-25')
    expect(start('3/2 행사')).toBe('2027-03-02')
  })

  test('skips to the next leap year for Feb 29 and rejects impossible dates', () => {
    expect(start('2월 29일 생일')).toBe('2028-02-29')
    expect(start('2월 30일 생일')).toBeNull()
    expect(start('13월 1일')).toBeNull()
    expect(start('13/40 번')).toBeNull()
  })

  test('reads explicit years without rolling', () => {
    expect(start('2027년 1월 5일 시험')).toBe('2027-01-05')
    expect(start('2025년 3월 2일 회고')).toBe('2025-03-02')
    expect(start('2026-12-31 송년')).toBe('2026-12-31')
    expect(start('2026/12/31 송년')).toBe('2026-12-31')
    expect(start('2026.12.31 송년')).toBe('2026-12-31')
    expect(start('2026-02-30 송년')).toBeNull()
  })

  test('reads next-month days and month ends', () => {
    expect(start('다음 달 5일 정산')).toBe('2026-11-05')
    expect(start('다음달 31일 정산')).toBe('2026-11-30')
    expect(start('이번 달 28일 정산')).toBe('2026-10-28')
    expect(start('다다음 달 1일 정산')).toBe('2026-12-01')
    expect(start('월말 정산')).toBe('2026-10-31')
    expect(start('말일 정산')).toBe('2026-10-31')
    expect(start('다음 달 말 정산')).toBe('2026-11-30')
    expect(start('이번 달 말일 정산')).toBe('2026-10-31')
  })

  test('0일은 날짜로 읽지 않는다', () => {
    const r = parseQuickAdd('이번 달 0일 정산', ctx)
    expect(r.startDate).toBeNull()
    expect(r.title).toBe('이번 달 0일 정산')
    expect(start('다음 달 0일 정산')).toBeNull()
    expect(start('이번 달 32일 정산')).toBeNull()
    expect(start('이번 달 31일 정산')).toBe('2026-10-31')
  })

  test('month end works in February of a leap year', () => {
    const feb = makeCtx({ today: '2028-02-10', now: new Date(2028, 1, 10, 8, 0) })
    expect(start('월말 정산', feb)).toBe('2028-02-29')
  })
})

describe('English dates', () => {
  test.each([
    ['call today', '2026-10-23'],
    ['call tomorrow', '2026-10-24'],
    ['call tmrw', '2026-10-24'],
    ['call yesterday', '2026-10-22'],
    ['call next monday', '2026-10-26'],
    ['call next friday', '2026-10-30'],
    ['call this friday', '2026-10-23'],
    ['call monday', '2026-10-26'],
    ['call in 3 days', '2026-10-26'],
    ['call in 2 weeks', '2026-11-06'],
    ['call in 1 month', '2026-11-23'],
    ['call jan 5', '2027-01-05'],
    ['call January 5th', '2027-01-05'],
    ['call 5 jan', '2027-01-05'],
    ['call dec 25', '2026-12-25'],
    ['call oct 23', '2026-10-23'],
    ['call oct 5', '2027-10-05'],
    ['call jan 5 2028', '2028-01-05'],
  ])('reads "%s"', (input, expected) => {
    expect(start(input)).toBe(expected)
  })

  test('does not read short weekday names or loose numbers', () => {
    for (const s of ['sun cream', 'call at 5', 'jan 40', 'dec 5pm', 'may be later']) {
      expect(parseQuickAdd(s, ctx).tokens.filter((t) => t.kind === 'date')).toEqual([])
    }
  })

  test('4자리 시각을 연도로 삼지 않는다', () => {
    const r = parseQuickAdd('Dec 25 1530 meeting', ctx)
    expect(r.startDate).toBe('2026-12-25')
    expect(r.title).toBe('1530 meeting')
    expect(start('call 5 jan 1530')).toBe('2027-01-05')
  })

  test('현실적인 범위의 연도만 읽는다', () => {
    expect(start('call jan 5 2028')).toBe('2028-01-05')
    expect(start('call jan 5 1999')).toBe('1999-01-05')
    expect(start('call jan 5 2999')).toBe('2999-01-05')
    expect(start('call jan 5 0930')).toBe('2027-01-05') // 연도가 아니라 시각 꼴이다
  })

  test('연도 0~99를 1900년대로 바꾸지 않는다', () => {
    expect(start('0050년 1월 5일 회의')).not.toBe('1950-01-05')
    expect(start('0050년 1월 5일 회의')).toBe('2027-01-05') // 연도로 못 읽어 월·일만 남는다
  })

  test('reads English mixed into a Korean sentence', () => {
    const r = parseQuickAdd('tomorrow 팀 회의 오후 3시', ctx)
    expect(r.startDate).toBe('2026-10-24')
    expect(r.startTime).toBe('15:00')
    expect(r.title).toBe('팀 회의')
  })
})

describe('deadline phrases', () => {
  test('reads "마감 날짜" as a due date', () => {
    const r = parseQuickAdd('보고서 마감 금요일', ctx)
    expect(r.dueDate).toBe('2026-10-30')
    expect(r.startDate).toBeNull()
    expect(r.title).toBe('보고서')
    expect(r.tokens[0]).toMatchObject({ kind: 'deadline', text: '마감 금요일' })
  })

  test('reads "날짜까지" as a due date', () => {
    const r = parseQuickAdd('금요일까지 보고서', ctx)
    expect(r.dueDate).toBe('2026-10-30')
    expect(r.startDate).toBeNull()
    expect(r.title).toBe('보고서')
    expect(parseQuickAdd('보고서 내일 까지', ctx).dueDate).toBe('2026-10-24')
  })

  test('supports 마감일 with a colon and English due/by', () => {
    expect(parseQuickAdd('보고서 마감일: 12월 1일', ctx).dueDate).toBe('2026-12-01')
    expect(parseQuickAdd('report due friday', ctx).dueDate).toBe('2026-10-30')
    expect(parseQuickAdd('report by tomorrow', ctx).dueDate).toBe('2026-10-24')
  })

  test('마감기한도 마감으로 읽는다', () => {
    const r = parseQuickAdd('보고서 마감기한 금요일', ctx)
    expect(r.dueDate).toBe('2026-10-30')
    expect(r.startDate).toBeNull()
    expect(r.title).toBe('보고서')
    expect(parseQuickAdd('보고서 마감 기한 금요일', ctx).dueDate).toBe('2026-10-30')
    expect(parseQuickAdd('보고서 기한 금요일', ctx).dueDate).toBe('2026-10-30')
  })

  test('영어 due·by 뒤의 콜론도 받는다', () => {
    const r = parseQuickAdd('report due: friday', ctx)
    expect(r.dueDate).toBe('2026-10-30')
    expect(r.startDate).toBeNull()
    expect(r.title).toBe('report')
    expect(parseQuickAdd('report by: tomorrow', ctx).dueDate).toBe('2026-10-24')
  })

  test('keeps a start date and a deadline apart', () => {
    const r = parseQuickAdd('내일 시작 금요일까지', ctx)
    expect(r.startDate).toBe('2026-10-24')
    expect(r.dueDate).toBe('2026-10-30')
  })

  test('does not read a deadline keyword without a date', () => {
    const r = parseQuickAdd('마감 정리하기', ctx)
    expect(r.dueDate).toBeNull()
    expect(r.title).toBe('마감 정리하기')
  })
})

describe('false positives stay in the title', () => {
  test.each([
    '5월 보고서',
    '2026 계획',
    '12번 버스 타기',
    '1일차 운동',
    '3일째 운동',
    '3시간 회의',
    '10개 정리',
    '버전 1.2.3 배포',
  ])('%s', (input) => {
    const r = parseQuickAdd(input, ctx)
    expect(r.startDate).toBeNull()
    expect(r.startTime).toBeNull()
    expect(r.dueDate).toBeNull()
    expect(r.title).toBe(input)
  })

  test('does not read dates inside URLs', () => {
    const r = parseQuickAdd('링크 https://x.com/2026-10-23/내일 확인', ctx)
    expect(r.startDate).toBeNull()
    expect(r.title).toBe('링크 https://x.com/2026-10-23/내일 확인')
  })

  test('keeps a second date in the title', () => {
    const r = parseQuickAdd('내일 모레 회의', ctx)
    expect(r.startDate).toBe('2026-10-24')
    expect(r.title).toBe('모레 회의')
  })

  test('returns an empty title when everything is consumed', () => {
    const r = parseQuickAdd('내일', ctx)
    expect(r.title).toBe('')
    expect(r.startDate).toBe('2026-10-24')
  })

  test('cleans up brackets and stray separators left behind', () => {
    const r = parseQuickAdd('회의 (내일), 준비', ctx)
    expect(r.title).toBe('회의, 준비')
    expect(parseQuickAdd('(내일) 회의', ctx).title).toBe('회의')
    expect(parseQuickAdd('내일, 회의', ctx).title).toBe('회의')
  })
})
