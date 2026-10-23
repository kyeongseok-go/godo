import type { Countdown } from '../../domain/types'
import { COUNTDOWN_EXAMPLES, describeCountdownDate, describeRepeat, splitCountdowns, validateCountdownDraft } from './countdownView'

const TODAY = '2026-10-23'

const make = (over: Partial<Countdown> = {}): Countdown => ({
  id: 'c',
  name: '디데이',
  date: '2026-12-25',
  color: '#d9421c',
  repeatYearly: false,
  order: 1000,
  ...over,
})

describe('splitCountdowns', () => {
  test('sorts upcoming ones nearest first and today before the future', () => {
    const { upcoming } = splitCountdowns(
      [
        make({ id: 'far', date: '2027-01-01' }),
        make({ id: 'today', date: TODAY }),
        make({ id: 'near', date: '2026-10-30' }),
      ],
      TODAY,
    )

    expect(upcoming.map((u) => u.countdown.id)).toEqual(['today', 'near', 'far'])
    expect(upcoming[0].info.label).toBe('D-DAY')
  })

  test('moves one-off countdowns in the past to the passed list, most recent first', () => {
    const { upcoming, passed } = splitCountdowns(
      [
        make({ id: 'old', date: '2026-01-01' }),
        make({ id: 'recent', date: '2026-10-20' }),
        make({ id: 'next', date: '2026-11-01' }),
      ],
      TODAY,
    )

    expect(upcoming.map((u) => u.countdown.id)).toEqual(['next'])
    expect(passed.map((u) => u.countdown.id)).toEqual(['recent', 'old'])
    expect(passed[0].info.label).toBe('D+3')
  })

  test('keeps yearly repeats in the upcoming list and rolls them to the next date', () => {
    const { upcoming, passed } = splitCountdowns([make({ id: 'bday', date: '2000-03-01', repeatYearly: true })], TODAY)

    expect(passed).toEqual([])
    expect(upcoming[0].nextDate).toBe('2027-03-01')
    expect(upcoming[0].info.label).toBe('D-129')
  })

  test('breaks ties by the stored order', () => {
    const { upcoming } = splitCountdowns(
      [make({ id: 'b', date: '2026-11-01', order: 2000 }), make({ id: 'a', date: '2026-11-01', order: 1000 })],
      TODAY,
    )

    expect(upcoming.map((u) => u.countdown.id)).toEqual(['a', 'b'])
  })

  test('returns two empty lists for no countdowns', () => {
    expect(splitCountdowns([], TODAY)).toEqual({ upcoming: [], passed: [] })
  })
})

describe('describeCountdownDate', () => {
  test('writes the year, month, day and weekday in Korean', () => {
    expect(describeCountdownDate('2026-12-25')).toBe('2026년 12월 25일 금요일')
  })
})

describe('COUNTDOWN_EXAMPLES', () => {
  test('offers birthday, anniversary and exam with sensible yearly flags', () => {
    expect(COUNTDOWN_EXAMPLES.map((e) => e.name)).toEqual(['생일', '기념일', '시험'])
    expect(COUNTDOWN_EXAMPLES.find((e) => e.name === '생일')?.repeatYearly).toBe(true)
    expect(COUNTDOWN_EXAMPLES.find((e) => e.name === '시험')?.repeatYearly).toBe(false)
  })
})

describe('validateCountdownDraft', () => {
  const ok = { name: '시험', date: '2026-12-01', color: '#2b4c7e', repeatYearly: false }

  test('accepts a complete draft', () => {
    expect(validateCountdownDraft(ok)).toBeNull()
  })

  test('requires a name', () => {
    expect(validateCountdownDraft({ ...ok, name: '  ' })).toBe('이름을 입력해 주세요')
  })

  test('requires a real date', () => {
    expect(validateCountdownDraft({ ...ok, date: '' })).toBe('날짜를 정해 주세요')
    expect(validateCountdownDraft({ ...ok, date: '2026-13-01' })).toBe('날짜를 정해 주세요')
  })
})

describe('describeRepeat', () => {
  test('mentions the yearly repeat only when it repeats', () => {
    expect(describeRepeat(true)).toBe('매년 반복')
    expect(describeRepeat(false)).toBe('')
  })
})
