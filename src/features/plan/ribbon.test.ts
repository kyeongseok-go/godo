import { describe, expect, it } from 'vitest'
import { makeTask } from '../../test/factories'
import { ribbonPlacement, ribbonPoint, ribbonSegments, ribbonTicks, ribbonWindow } from './ribbon'

const DAY = '2026-03-10'
const WORK = { start: '09:00', end: '18:00' }

describe('ribbonSegments', () => {
  it('시각이 정해진 그날 일만 이른 순서로 모은다', () => {
    const tasks = [
      makeTask({ id: 'late', startDate: DAY, startTime: '14:00', durationMin: 60 }),
      makeTask({ id: 'early', startDate: DAY, startTime: '09:30', estimateMin: 90 }),
      makeTask({ id: 'untimed', startDate: DAY }),
      makeTask({ id: 'other-day', startDate: '2026-03-11', startTime: '10:00' }),
    ]

    const segments = ribbonSegments(tasks, DAY, 30)

    expect(segments.map((s) => [s.id, s.startMin, s.endMin])).toEqual([
      ['early', 570, 660],
      ['late', 840, 900],
    ])
  })

  it('길이가 없으면 기본 길이를 쓰고 자정을 넘기지 않는다', () => {
    const tasks = [makeTask({ id: 'a', startDate: DAY, startTime: '23:50' })]

    expect(ribbonSegments(tasks, DAY, 30)[0]?.endMin).toBe(1440)
  })

  it('휴지통에 있는 일은 빼고, 완료는 완료로 표시한다', () => {
    const tasks = [
      makeTask({ id: 'trashed', startDate: DAY, startTime: '10:00', deletedAt: 1 }),
      makeTask({ id: 'done', startDate: DAY, startTime: '11:00', status: 'done', completedAt: 1 }),
    ]

    const segments = ribbonSegments(tasks, DAY, 30)

    expect(segments.map((s) => s.id)).toEqual(['done'])
    expect(segments[0]?.done).toBe(true)
  })
})

describe('ribbonWindow', () => {
  it('기본은 근무 시간이다', () => {
    expect(ribbonWindow(WORK.start, WORK.end, [], null)).toEqual({ startMin: 540, endMin: 1080 })
  })

  it('근무 시간 밖에 잡힌 일과 지금 시각까지 담는다', () => {
    const segments = ribbonSegments([makeTask({ startDate: DAY, startTime: '07:00', durationMin: 60 })], DAY, 30)

    expect(ribbonWindow(WORK.start, WORK.end, segments, 20 * 60)).toEqual({ startMin: 420, endMin: 1200 })
  })

  it('정시에 맞춰 끊어 지금 눈금이 가장자리에 붙지 않게 한다', () => {
    expect(ribbonWindow(WORK.start, WORK.end, [], 18 * 60 + 7)).toEqual({ startMin: 540, endMin: 1140 })
  })

  it('창이 너무 좁으면 최소 폭까지 넓힌다', () => {
    expect(ribbonWindow('09:00', '10:00', [], null)).toEqual({ startMin: 540, endMin: 780 })
  })

  it('하루 끝에 닿으면 앞쪽으로 넓힌다', () => {
    expect(ribbonWindow('23:00', '23:30', [], null)).toEqual({ startMin: 1200, endMin: 1440 })
  })
})

describe('ribbonPlacement', () => {
  const window = { startMin: 540, endMin: 1080 }

  it('창 안의 구간을 백분율로 바꾼다', () => {
    expect(ribbonPlacement(window, 540, 630)).toEqual({ left: 0, width: (90 / 540) * 100 })
    expect(ribbonPlacement(window, 1035, 1080)).toEqual({ left: (495 / 540) * 100, width: (45 / 540) * 100 })
  })

  it('창 밖으로 삐져나온 부분은 잘라 낸다', () => {
    expect(ribbonPlacement(window, 480, 570)).toEqual({ left: 0, width: (30 / 540) * 100 })
    expect(ribbonPlacement(window, 1070, 1200).width).toBeCloseTo((10 / 540) * 100, 5)
  })

  it('창을 완전히 벗어나면 폭이 0이다', () => {
    expect(ribbonPlacement(window, 60, 120).width).toBe(0)
  })
})

describe('ribbonPoint', () => {
  it('창 안이면 위치를, 밖이면 null 을 준다', () => {
    const window = { startMin: 540, endMin: 1080 }
    expect(ribbonPoint(window, 810)).toBeCloseTo(50, 5)
    expect(ribbonPoint(window, 400)).toBeNull()
    expect(ribbonPoint(window, 1200)).toBeNull()
  })
})

describe('ribbonTicks', () => {
  it('근무 시간대에는 두 시간 간격으로 눈금을 둔다', () => {
    const ticks = ribbonTicks({ startMin: 540, endMin: 1080 })

    expect(ticks.map((t) => t.label)).toEqual(['10', '12', '14', '16', '18'])
  })

  it('창이 짧으면 한 시간, 아주 길면 세 시간 간격이다', () => {
    expect(ribbonTicks({ startMin: 540, endMin: 780 }).map((t) => t.label)).toEqual(['09', '10', '11', '12', '13'])
    expect(ribbonTicks({ startMin: 360, endMin: 1380 }).map((t) => t.label)).toEqual(['06', '09', '12', '15', '18', '21'])
  })
})
