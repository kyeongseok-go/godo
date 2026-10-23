import type { Countdown } from '../../domain/types'
import { applyChangeSet, emptyEntityState } from '../../store/changes'
import type { ChangeSet, EntityState } from '../../store/changes'
import { createCountdown, deleteCountdown, patchCountdown } from './commands'

const apply = (state: EntityState, cs: ChangeSet): EntityState => applyChangeSet(state, cs).next

const makeCountdown = (over: Partial<Countdown> = {}): Countdown => ({
  id: 'c1',
  name: '생일',
  date: '2026-12-25',
  color: '#d9421c',
  repeatYearly: false,
  order: 1000,
  ...over,
})

const seed = (...countdowns: Countdown[]): EntityState =>
  apply(emptyEntityState(), { puts: { countdowns }, deletes: {} })

describe('createCountdown', () => {
  test('trims the name and appends order after existing countdowns', () => {
    const state = seed(makeCountdown({ order: 4000 }))

    const { countdown, changes } = createCountdown(state, {
      name: '  기념일  ',
      date: '2027-03-01',
      color: '#2f6f5e',
      repeatYearly: true,
    })

    expect(countdown).toMatchObject({ name: '기념일', date: '2027-03-01', color: '#2f6f5e', repeatYearly: true, order: 5000 })
    expect(changes.puts.countdowns).toEqual([countdown])
  })

  test('throws a Korean message when the name is blank', () => {
    expect(() =>
      createCountdown(emptyEntityState(), { name: ' ', date: '2027-03-01', color: '#000', repeatYearly: false }),
    ).toThrow('이름')
  })

  test('throws when the date is not a real calendar day', () => {
    expect(() =>
      createCountdown(emptyEntityState(), { name: '시험', date: '2027-02-30', color: '#000', repeatYearly: false }),
    ).toThrow('날짜')
  })
})

describe('patchCountdown', () => {
  test('updates fields and keeps the id', () => {
    const state = seed(makeCountdown())

    const next = apply(state, patchCountdown(state, 'c1', { name: ' 친구 생일 ', repeatYearly: true, id: 'zzz' } as Partial<Countdown>))

    expect(next.countdowns.c1).toMatchObject({ name: '친구 생일', repeatYearly: true, date: '2026-12-25' })
    expect(next.countdowns.zzz).toBeUndefined()
  })

  test('rejects a blank name or invalid date', () => {
    const state = seed(makeCountdown())

    expect(() => patchCountdown(state, 'c1', { name: '' })).toThrow('이름')
    expect(() => patchCountdown(state, 'c1', { date: 'tomorrow' })).toThrow('날짜')
  })

  test('returns an empty change set for an unknown countdown', () => {
    expect(patchCountdown(emptyEntityState(), 'nope', { name: 'x' }).puts.countdowns).toBeUndefined()
  })
})

describe('deleteCountdown', () => {
  test('removes it and the inverse brings it back', () => {
    const state = seed(makeCountdown())

    const { next, inverse } = applyChangeSet(state, deleteCountdown(state, 'c1'))

    expect(next.countdowns.c1).toBeUndefined()
    expect(apply(next, inverse).countdowns.c1).toEqual(makeCountdown())
  })

  test('returns an empty change set for an unknown countdown', () => {
    expect(deleteCountdown(emptyEntityState(), 'nope').deletes.countdowns).toBeUndefined()
  })
})
