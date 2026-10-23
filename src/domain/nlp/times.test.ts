import { parseQuickAdd } from './index'
import { makeCtx } from './test-ctx'

const ctx = makeCtx() // 오늘 2026-10-23, 지금 10:00
const time = (s: string, c = ctx) => parseQuickAdd(s, c).startTime

describe('Korean clock times', () => {
  test.each([
    ['내일 오후 3시', '15:00'],
    ['내일 오전 9시', '09:00'],
    ['내일 오후 12시', '12:00'],
    ['내일 오전 12시', '00:00'],
    ['내일 아침 7시', '07:00'],
    ['내일 저녁 7시', '19:00'],
    ['내일 저녁 12시', '12:00'],
    ['내일 밤 11시', '23:00'],
    ['내일 밤 12시', '00:00'],
    ['내일 밤 2시', '02:00'],
    ['내일 낮 12시', '12:00'],
    ['내일 낮 2시', '14:00'],
    ['내일 점심 12시', '12:00'],
    ['내일 새벽 5시', '05:00'],
    ['내일 오후 3시 30분', '15:30'],
    ['내일 오후 3시30분', '15:30'],
    ['내일 오후 3시 반', '15:30'],
    ['내일 오후3시반', '15:30'],
    ['내일 오후 3시에', '15:00'],
    ['내일 오후 3시쯤', '15:00'],
    ['내일 15시', '15:00'],
    ['내일 0시', '00:00'],
  ])('reads "%s"', (input, expected) => {
    expect(time(input)).toBe(expected)
  })

  test('guesses AM or PM for a bare hour the way people usually mean it', () => {
    expect(time('내일 3시 회의')).toBe('15:00')
    expect(time('내일 6시 회의')).toBe('18:00')
    expect(time('내일 7시 기상')).toBe('07:00')
    expect(time('내일 11시 기상')).toBe('11:00')
    expect(time('내일 12시 점심')).toBe('12:00')
  })

  test('uses a nearby day-part word to resolve a bare hour without consuming it', () => {
    const r = parseQuickAdd('내일 저녁 약속 7시', ctx)
    expect(r.startTime).toBe('19:00')
    expect(r.title).toBe('저녁 약속')
    expect(r.dayPart).toBeNull()
  })

  test('rejects impossible clock values', () => {
    for (const s of ['내일 25시', '내일 오후 13시 반', '내일 3시 75분', '내일 24시']) {
      expect(time(s)).toBeNull()
    }
  })

  test('3시간 is a duration phrase, not a clock time', () => {
    const r = parseQuickAdd('3시간 회의', ctx)
    expect(r.startTime).toBeNull()
    expect(r.title).toBe('3시간 회의')
    expect(parseQuickAdd('내일 3시간 회의', ctx).startTime).toBeNull()
  })

  test('does not read times when 시 starts another word', () => {
    expect(time('3시민 토론')).toBeNull()
    expect(time('3시까지 제출')).toBeNull()
  })
})

describe('numeric and English times', () => {
  test.each([
    ['내일 15:00 회의', '15:00'],
    ['내일 9:05 회의', '09:05'],
    ['meet 3pm', '15:00'],
    ['meet 3 PM', '15:00'],
    ['meet 3:30pm', '15:30'],
    ['meet at 3pm', '15:00'],
    ['meet 12am', '00:00'],
    ['meet 12pm', '12:00'],
    ['meet 9am', '09:00'],
    ['meet 12:30 am', '00:30'],
  ])('reads "%s"', (input, expected) => {
    expect(time(input)).toBe(expected)
  })

  test('removes "at" together with the time', () => {
    expect(parseQuickAdd('meet at 3pm', ctx).title).toBe('meet')
  })

  test('rejects invalid clocks', () => {
    for (const s of ['25:00 회의', '12:75 회의', '13pm 회의', '0am 회의', '99:99']) {
      expect(time(s)).toBeNull()
    }
  })

  test('does not read ratios or ids as times', () => {
    for (const s of ['점수 3:2 승리', '파일 a15:00']) {
      expect(time(s)).toBeNull()
    }
  })
})

describe('time without a date', () => {
  test('uses today when the time is still ahead', () => {
    const r = parseQuickAdd('오후 3시 회의', ctx)
    expect(r.startDate).toBe('2026-10-23')
    expect(r.startTime).toBe('15:00')
  })

  test('uses tomorrow when the time has already passed', () => {
    const r = parseQuickAdd('오전 9시 회의', ctx)
    expect(r.startDate).toBe('2026-10-24')
  })

  test('a time equal to the current minute still counts as today', () => {
    expect(parseQuickAdd('오전 10시 회의', ctx).startDate).toBe('2026-10-23')
  })

  test('keeps an explicit date', () => {
    expect(parseQuickAdd('모레 오전 9시 회의', ctx).startDate).toBe('2026-10-25')
  })

  test('rolls over relative to ctx.today, not the wall-clock date', () => {
    const late = makeCtx({ today: '2026-12-31', now: new Date(2026, 11, 31, 23, 30) })
    expect(parseQuickAdd('오후 3시 회의', late).startDate).toBe('2027-01-01')
  })
})

describe('time ranges', () => {
  test('3시부터 4시 gives a start time plus a duration', () => {
    const r = parseQuickAdd('내일 3시부터 4시 회의', ctx)
    expect(r.startTime).toBe('15:00')
    expect(r.durationMin).toBe(60)
    expect(r.title).toBe('회의')
  })

  test.each([
    ['오후 3시부터 5시까지 회의', '15:00', 120],
    ['오전 11시부터 1시 회의', '11:00', 120],
    ['오전 9시부터 12시 회의', '09:00', 180],
    ['오후 11시부터 오전 1시 회의', '23:00', 120],
    ['오후 3시 30분부터 4시 45분 회의', '15:30', 75],
    ['10:00-11:30 회의', '10:00', 90],
    ['10:00~11:30 회의', '10:00', 90],
    ['3pm-4pm 회의', '15:00', 60],
    ['3pm to 5pm 회의', '15:00', 120],
    ['3-4pm 회의', '15:00', 60],
    ['11am-1pm 회의', '11:00', 120],
  ])('reads "%s"', (input, startTime, durationMin) => {
    const r = parseQuickAdd(input, ctx)
    expect(r.startTime).toBe(startTime)
    expect(r.durationMin).toBe(durationMin)
    expect(r.title).toBe('회의')
  })

  test('emits a time token and a duration token that do not overlap', () => {
    const input = '오후 3시부터 5시까지 회의'
    const r = parseQuickAdd(input, ctx)
    expect(r.tokens.map((t) => t.kind)).toEqual(['time', 'duration'])
    const [a, b] = r.tokens
    expect(a.end).toBeLessThanOrEqual(b.start)
    expect(input.slice(b.start, b.end)).toBe('부터 5시까지')
    expect(b.label).toContain('2시간')
  })

  test('falls back to a single time when the range end is invalid', () => {
    const r = parseQuickAdd('오후 3시부터 99시 회의', ctx)
    expect(r.startTime).toBe('15:00')
    expect(r.durationMin).toBeNull()
  })

  test('refuses a zero-length range', () => {
    const r = parseQuickAdd('15:00-15:00 회의', ctx)
    expect(r.durationMin).toBeNull()
  })
})

describe('day parts', () => {
  test.each([
    ['아침 운동', 'morning', '운동'],
    ['점심 약속', 'afternoon', '약속'],
    ['저녁 약속', 'evening', '약속'],
    ['밤 산책', 'evening', '산책'],
    ['오전 회의', 'morning', '회의'],
    ['오후 회의', 'afternoon', '회의'],
    ['저녁에 산책', 'evening', '산책'],
  ])('reads "%s"', (input, dayPart, title) => {
    const r = parseQuickAdd(input, ctx)
    expect(r.dayPart).toBe(dayPart)
    expect(r.startTime).toBeNull()
    expect(r.title).toBe(title)
    expect(r.tokens[0].kind).toBe('dayPart')
  })

  test('combines with a date', () => {
    const r = parseQuickAdd('내일 아침 운동', ctx)
    expect(r.startDate).toBe('2026-10-24')
    expect(r.dayPart).toBe('morning')
    expect(r.title).toBe('운동')
  })

  test('is dropped when an explicit time is present', () => {
    const r = parseQuickAdd('내일 저녁 7시 약속', ctx)
    expect(r.startTime).toBe('19:00')
    expect(r.dayPart).toBeNull()
    expect(r.tokens.map((t) => t.kind)).toEqual(['date', 'time'])
  })

  test('does not read day parts inside longer words', () => {
    for (const s of ['아침식사 준비', '저녁노을 사진', '밤새 작업']) {
      expect(parseQuickAdd(s, ctx).dayPart).toBeNull()
    }
  })

  test('a day part alone does not invent a date', () => {
    expect(parseQuickAdd('아침 운동', ctx).startDate).toBeNull()
  })

  test('only the first day part is used', () => {
    const r = parseQuickAdd('아침 저녁 약속', ctx)
    expect(r.dayPart).toBe('morning')
  })
})

describe('full sentences from the spec', () => {
  test('내일 오후 3시 팀 회의 #업무 @중요 p1 ~1h', () => {
    const r = parseQuickAdd('내일 오후 3시 팀 회의 #업무 @중요 p1 ~1h', ctx)
    expect(r).toMatchObject({
      title: '팀 회의',
      startDate: '2026-10-24',
      startTime: '15:00',
      projectId: 'p-work',
      labelIds: ['l-important'],
      priority: 1,
      estimateMin: 60,
      dueDate: null,
      recurrence: null,
    })
    expect(r.tokens.map((t) => t.kind)).toEqual(['date', 'time', 'project', 'label', 'priority', 'estimate'])
  })

  test('다음주 수요일 저녁 7시 치과', () => {
    const r = parseQuickAdd('다음주 수요일 저녁 7시 치과', ctx)
    expect(r).toMatchObject({ title: '치과', startDate: '2026-10-28', startTime: '19:00' })
  })

  test('time labels show the 24-hour clock', () => {
    const r = parseQuickAdd('내일 오후 3시 회의', ctx)
    expect(r.tokens[1].label).toBe('15:00')
  })
})
