import { describe, expect, it } from 'vitest'
import { frameWindows, framesForTask } from './frames'
import type { Priority, TimeFrame } from '../types'
import { makeTask } from '../../test/factories'

const WORK = { start: 9 * 60, end: 18 * 60 }

function makeFrame(patch: Partial<TimeFrame> = {}): TimeFrame {
  return {
    id: 'f1',
    name: '딥워크',
    days: [1, 2, 3, 4, 5],
    start: '09:00',
    end: '12:00',
    match: { labelIds: [], priorities: [], minMinutes: null },
    order: 0,
    ...patch,
  }
}

describe('framesForTask', () => {
  it('조건이 모두 비어 있으면 모든 일에 해당한다', () => {
    const frame = makeFrame()
    expect(framesForTask(makeTask({ title: '아무 일' }), [frame], 30)).toEqual([frame])
  })

  it('라벨 조건이 있으면 그 라벨을 가진 일만 해당한다', () => {
    const frame = makeFrame({ match: { labelIds: ['deep'], priorities: [], minMinutes: null } })
    expect(framesForTask(makeTask({ labelIds: ['deep'] }), [frame], 30)).toEqual([frame])
    expect(framesForTask(makeTask({ labelIds: ['chore'] }), [frame], 30)).toEqual([])
  })

  it('우선순위 조건은 지정한 우선순위만 받는다', () => {
    const frame = makeFrame({ match: { labelIds: [], priorities: [1, 2], minMinutes: null } })
    expect(framesForTask(makeTask({ priority: 1 }), [frame], 30)).toEqual([frame])
    expect(framesForTask(makeTask({ priority: 3 }), [frame], 30)).toEqual([])
  })

  it('최소 길이 조건은 예상 시간이 그보다 짧은 일을 뺀다', () => {
    const frame = makeFrame({ match: { labelIds: [], priorities: [], minMinutes: 60 } })
    expect(framesForTask(makeTask(), [frame], 90)).toEqual([frame])
    expect(framesForTask(makeTask(), [frame], 30)).toEqual([])
  })

  it('조건이 여러 개면 모두 맞아야 한다', () => {
    const frame = makeFrame({ match: { labelIds: ['deep'], priorities: [1], minMinutes: 60 } })
    expect(framesForTask(makeTask({ labelIds: ['deep'], priority: 1 }), [frame], 90)).toEqual([frame])
    expect(framesForTask(makeTask({ labelIds: ['deep'], priority: 2 }), [frame], 90)).toEqual([])
  })

  it('시작이 종료보다 늦거나 같은 시간대는 무시한다', () => {
    expect(framesForTask(makeTask(), [makeFrame({ start: '12:00', end: '12:00' })], 30)).toEqual([])
    expect(framesForTask(makeTask(), [makeFrame({ start: '13:00', end: '12:00' })], 30)).toEqual([])
  })

  it('요일이 비어 있는 시간대는 무시한다', () => {
    expect(framesForTask(makeTask(), [makeFrame({ days: [] })], 30)).toEqual([])
  })

  it('order 순으로 돌려준다', () => {
    const late = makeFrame({ id: 'late', order: 2 })
    const early = makeFrame({ id: 'early', order: 1 })
    expect(framesForTask(makeTask(), [late, early], 30).map((f) => f.id)).toEqual(['early', 'late'])
  })
})

describe('frameWindows', () => {
  const deep = makeFrame({ id: 'deep', name: '딥워크', days: [1], start: '09:00', end: '12:00' })

  it('해당하는 시간대가 없으면 근무 시간 하나를 그대로 쓴다', () => {
    const task = makeTask({ labelIds: ['chore'] })
    const frames = [makeFrame({ match: { labelIds: ['deep'], priorities: [], minMinutes: null } })]
    const result = frameWindows(task, frames, '2026-10-26', 30, WORK)
    expect(result.constrained).toBe(false)
    expect(result.windows).toEqual([{ frame: null, range: WORK }])
  })

  it('해당하는 시간대가 있으면 그 시간대 창만 쓴다', () => {
    // 2026-10-26 은 월요일
    const result = frameWindows(makeTask(), [deep], '2026-10-26', 30, WORK)
    expect(result.constrained).toBe(true)
    expect(result.windows).toEqual([{ frame: deep, range: { start: 9 * 60, end: 12 * 60 } }])
  })

  it('그 요일에 열리지 않으면 창이 없다', () => {
    // 2026-10-27 은 화요일
    const result = frameWindows(makeTask(), [deep], '2026-10-27', 30, WORK)
    expect(result.constrained).toBe(true)
    expect(result.windows).toEqual([])
  })

  it('같은 날 여러 시간대가 열리면 이른 시각부터 시도한다', () => {
    const afternoon = makeFrame({ id: 'pm', name: '오후', days: [1], start: '14:00', end: '18:00', order: 0 })
    const morning = makeFrame({ id: 'am', name: '오전', days: [1], start: '09:00', end: '12:00', order: 1 })
    const result = frameWindows(makeTask(), [afternoon, morning], '2026-10-26', 30, WORK)
    expect(result.windows.map((w) => w.frame?.id)).toEqual(['am', 'pm'])
  })

  it('근무 시간 밖의 시간대도 그대로 쓴다(일부러 정한 시간이라서)', () => {
    const dawn = makeFrame({ id: 'dawn', days: [1], start: '06:00', end: '08:00' })
    const result = frameWindows(makeTask(), [dawn], '2026-10-26', 30, WORK)
    expect(result.windows).toEqual([{ frame: dawn, range: { start: 6 * 60, end: 8 * 60 } }])
  })

  it('우선순위 조건의 타입은 Priority 를 따른다', () => {
    const priorities: Priority[] = [1, 4]
    const frame = makeFrame({ match: { labelIds: [], priorities, minMinutes: null } })
    expect(frameWindows(makeTask({ priority: 4 }), [frame], '2026-10-26', 30, WORK).constrained).toBe(true)
  })
})
