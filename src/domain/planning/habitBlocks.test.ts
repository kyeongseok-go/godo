import { describe, expect, it } from 'vitest'
import { planHabitBlocks } from './habitBlocks'
import type { Habit } from '../types'
import type { BusyBlock } from './slots'

// 2026-10-26 은 월요일
const MONDAY = '2026-10-26'
const OPTS = { date: MONDAY, nowTime: null, bufferMin: 10, slotMin: 15 }

let seq = 0
function makeHabit(overrides: Partial<Habit> = {}): Habit {
  seq += 1
  return {
    id: `h${seq}`,
    name: '운동',
    icon: null,
    color: '#2f6f5e',
    frequency: { type: 'daily' },
    goal: { kind: 'check', target: 1, unit: null },
    startDate: '2026-10-01',
    group: null,
    reminderTime: null,
    block: { durationMin: 30, start: '07:00', end: '09:00' },
    archived: false,
    logs: {},
    order: 0,
    ...overrides,
  }
}

describe('planHabitBlocks', () => {
  it('블록이 있는 습관에 시간대 안의 가장 빠른 자리를 준다', () => {
    const habit = makeHabit()
    const result = planHabitBlocks([habit], [], OPTS)
    expect(result.failures).toEqual([])
    expect(result.blocks).toEqual([{ habitId: habit.id, date: MONDAY, startTime: '07:00', durationMin: 30 }])
  })

  it('블록이 없는 습관은 건너뛴다', () => {
    const result = planHabitBlocks([makeHabit({ block: null })], [], OPTS)
    expect(result.blocks).toEqual([])
    expect(result.failures).toEqual([])
  })

  it('보관한 습관과 그날 해야 하지 않는 습관은 건너뛴다', () => {
    const archived = makeHabit({ archived: true })
    const otherDays = makeHabit({ frequency: { type: 'weekdays', days: [2] } })
    const result = planHabitBlocks([archived, otherDays], [], OPTS)
    expect(result.blocks).toEqual([])
    expect(result.failures).toEqual([])
  })

  it('이미 달성한 습관은 시간을 잡지 않는다', () => {
    const done = makeHabit({ logs: { [MONDAY]: 1 } })
    expect(planHabitBlocks([done], [], OPTS).blocks).toEqual([])
  })

  it('이미 찬 시간은 피하고 버퍼만큼 띄운다', () => {
    const busy: BusyBlock[] = [{ date: MONDAY, start: '07:00', end: '07:30' }]
    const result = planHabitBlocks([makeHabit()], busy, OPTS)
    // 07:30 + 버퍼 10분 = 07:40 이지만 15분 격자에 맞춰 07:45
    expect(result.blocks[0]?.startTime).toBe('07:45')
  })

  it('다른 날짜의 일정은 영향을 주지 않는다', () => {
    const busy: BusyBlock[] = [{ date: '2026-10-27', start: '07:00', end: '09:00' }]
    expect(planHabitBlocks([makeHabit()], busy, OPTS).blocks[0]?.startTime).toBe('07:00')
  })

  it('습관끼리도 겹치지 않게 순서대로 잡는다', () => {
    const first = makeHabit({ order: 1 })
    const second = makeHabit({ order: 2 })
    const result = planHabitBlocks([second, first], [], OPTS)
    expect(result.blocks.map((b) => [b.habitId, b.startTime])).toEqual([
      [first.id, '07:00'],
      [second.id, '07:45'],
    ])
  })

  it('오늘은 지나간 시간에 잡지 않는다', () => {
    const result = planHabitBlocks([makeHabit()], [], { ...OPTS, nowTime: '07:50' })
    expect(result.blocks[0]?.startTime).toBe('08:00')
  })

  it('남은 시간이 길이보다 짧으면 이유를 돌려준다', () => {
    const habit = makeHabit({ block: { durationMin: 90, start: '07:00', end: '08:00' } })
    const result = planHabitBlocks([habit], [], OPTS)
    expect(result.blocks).toEqual([])
    expect(result.failures[0]?.habitId).toBe(habit.id)
    expect(result.failures[0]?.reason).toContain('90분')
  })

  it('시간대가 꽉 차면 이유를 돌려준다', () => {
    const busy: BusyBlock[] = [{ date: MONDAY, start: '07:00', end: '09:00' }]
    const result = planHabitBlocks([makeHabit()], busy, OPTS)
    expect(result.blocks).toEqual([])
    expect(result.failures[0]?.reason).toContain('빈 시간')
  })

  it('시작이 종료보다 늦은 블록은 이유를 돌려준다', () => {
    const habit = makeHabit({ block: { durationMin: 30, start: '09:00', end: '07:00' } })
    expect(planHabitBlocks([habit], [], OPTS).failures[0]?.reason).toContain('시간대')
  })

  it('길이가 0 이하인 블록은 이유를 돌려준다', () => {
    const habit = makeHabit({ block: { durationMin: 0, start: '07:00', end: '09:00' } })
    expect(planHabitBlocks([habit], [], OPTS).failures[0]?.reason).toContain('길이')
  })
})
