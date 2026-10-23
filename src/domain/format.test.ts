import { describeDate, formatDayTitle, formatDuration, formatTime, dateTone } from './format'

describe('describeDate', () => {
  const today = '2026-10-23' // 금요일

  test('uses relative words near today', () => {
    expect(describeDate('2026-10-23', today)).toBe('오늘')
    expect(describeDate('2026-10-24', today)).toBe('내일')
    expect(describeDate('2026-10-22', today)).toBe('어제')
  })

  test('shows the weekday within the coming week', () => {
    expect(describeDate('2026-10-26', today)).toBe('월요일')
    expect(describeDate('2026-10-29', today)).toBe('목요일')
  })

  test('shows month and day beyond a week, with weekday', () => {
    expect(describeDate('2026-11-05', today)).toBe('11월 5일 (목)')
  })

  test('adds the year when it differs from the current year', () => {
    expect(describeDate('2027-01-02', today)).toBe('2027년 1월 2일 (토)')
  })

  test('past dates beyond yesterday show month and day', () => {
    expect(describeDate('2026-10-10', today)).toBe('10월 10일 (토)')
  })
})

describe('dateTone', () => {
  const today = '2026-10-23'

  test('flags past dates as overdue, today as today, future as normal', () => {
    expect(dateTone('2026-10-22', today)).toBe('overdue')
    expect(dateTone('2026-10-23', today)).toBe('today')
    expect(dateTone('2026-10-24', today)).toBe('soon')
    expect(dateTone('2026-11-30', today)).toBe('later')
  })
})

describe('formatTime', () => {
  test('24h passes through', () => {
    expect(formatTime('15:05', '24h')).toBe('15:05')
  })

  test('12h uses Korean meridiem', () => {
    expect(formatTime('15:05', '12h')).toBe('오후 3:05')
    expect(formatTime('00:30', '12h')).toBe('오전 12:30')
    expect(formatTime('12:00', '12h')).toBe('오후 12:00')
  })
})

describe('formatDuration', () => {
  test('formats minutes, hours, and mixed', () => {
    expect(formatDuration(45)).toBe('45분')
    expect(formatDuration(60)).toBe('1시간')
    expect(formatDuration(95)).toBe('1시간 35분')
  })
})

describe('formatDayTitle', () => {
  test('월·일과 요일을 함께 보여준다', () => {
    expect(formatDayTitle('2026-10-24')).toBe('10월 24일 (토)')
    expect(formatDayTitle('2026-01-01')).toBe('1월 1일 (목)')
  })
})
