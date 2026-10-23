import { describe, expect, it } from 'vitest'
import type { DayPlan, EngineContext, Habit, Task, TimeFrame } from '../../domain/types'
import { makeTask } from '../../test/factories'
import {
  MAX_HIGHLIGHTS,
  defaultPlanTab,
  describeLoad,
  eveningSummary,
  highlightProgress,
  parseCapacityHours,
  morningCandidates,
  offloadCandidates,
  planPlacements,
  recentReflections,
  scheduledTasks,
  sanitizeHighlights,
  toggleHighlight,
} from './logic'

const TODAY = '2026-03-10'

function ctxOf(tasks: Task[], now = new Date(2026, 2, 10, 9, 0)): EngineContext {
  return { today: TODAY, now, weekStartsOn: 1, projects: [], sections: [], labels: [], tasks }
}

describe('defaultPlanTab', () => {
  it('opens the morning tab before 3 pm', () => {
    expect(defaultPlanTab(new Date(2026, 2, 10, 6, 0))).toBe('morning')
    expect(defaultPlanTab(new Date(2026, 2, 10, 14, 59))).toBe('morning')
  })

  it('opens the evening tab from 3 pm', () => {
    expect(defaultPlanTab(new Date(2026, 2, 10, 15, 0))).toBe('evening')
    expect(defaultPlanTab(new Date(2026, 2, 10, 23, 30))).toBe('evening')
  })
})

describe('morningCandidates', () => {
  it('splits what is already on today from undated tasks that could be added', () => {
    const planned = makeTask({ id: 'planned', startDate: TODAY })
    const undated = makeTask({ id: 'undated' })
    const future = makeTask({ id: 'future', startDate: '2026-03-12' })
    const result = morningCandidates(ctxOf([planned, undated, future]))
    expect(result.scheduled.map((t) => t.id)).toEqual(['planned'])
    expect(result.available.map((t) => t.id)).toEqual(['undated'])
  })

  it('keeps overdue tasks out of both lists because the replan session owns them', () => {
    const overdue = makeTask({ startDate: '2026-03-05' })
    const result = morningCandidates(ctxOf([overdue]))
    expect(result.scheduled).toEqual([])
    expect(result.available).toEqual([])
  })

  it('excludes held, someday, blocked, finished and dated-by-deadline tasks from the undated list', () => {
    const blocker = makeTask({ id: 'blocker' })
    const tasks = [
      blocker,
      makeTask({ onHold: true }),
      makeTask({ someday: true }),
      makeTask({ blockedBy: ['blocker'] }),
      makeTask({ status: 'done' }),
      makeTask({ dueDate: '2026-03-20' }),
    ]
    expect(morningCandidates(ctxOf(tasks)).available.map((t) => t.id)).toEqual(['blocker'])
  })

  it('orders the undated list by priority then order', () => {
    const low = makeTask({ id: 'low', priority: 4, order: 1 })
    const high = makeTask({ id: 'high', priority: 1, order: 2 })
    expect(morningCandidates(ctxOf([low, high])).available.map((t) => t.id)).toEqual(['high', 'low'])
  })

  it('lists timed tasks first on the scheduled side', () => {
    const anytime = makeTask({ id: 'any', startDate: TODAY })
    const timed = makeTask({ id: 'timed', startDate: TODAY, startTime: '10:00' })
    expect(morningCandidates(ctxOf([anytime, timed])).scheduled.map((t) => t.id)).toEqual(['timed', 'any'])
  })
})

describe('highlights', () => {
  it('adds a task until the limit is reached', () => {
    const result = toggleHighlight(['a', 'b'], 'c')
    expect(result).toEqual({ ids: ['a', 'b', 'c'], rejected: false })
  })

  it('refuses a fourth highlight and says so', () => {
    const result = toggleHighlight(['a', 'b', 'c'], 'd')
    expect(result).toEqual({ ids: ['a', 'b', 'c'], rejected: true })
    expect(MAX_HIGHLIGHTS).toBe(3)
  })

  it('removes a task that is already chosen even when full', () => {
    expect(toggleHighlight(['a', 'b', 'c'], 'b')).toEqual({ ids: ['a', 'c'], rejected: false })
  })

  it('drops highlights that are no longer on today and enforces the cap', () => {
    const valid = new Set(['a', 'b', 'c', 'd'])
    expect(sanitizeHighlights(['a', 'gone', 'b', 'a', 'c', 'd'], valid)).toEqual(['a', 'b', 'c'])
  })
})

describe('offloadCandidates', () => {
  it('suggests nothing while the day fits', () => {
    const tasks = [makeTask({ startDate: TODAY, estimateMin: 60 })]
    expect(offloadCandidates(tasks, TODAY, 480, 30, [])).toEqual([])
  })

  it('suggests less urgent tasks first and never touches highlights', () => {
    const keep = makeTask({ id: 'keep', startDate: TODAY, estimateMin: 120, priority: 4 })
    const urgent = makeTask({ id: 'urgent', startDate: TODAY, estimateMin: 120, dueDate: TODAY })
    const spare = makeTask({ id: 'spare', startDate: TODAY, estimateMin: 120, priority: 4 })
    const result = offloadCandidates([keep, urgent, spare], TODAY, 240, 30, ['keep'])
    expect(result.map((t) => t.id)).toEqual(['spare'])
  })

  it('ignores tasks on other days when measuring the load', () => {
    const tomorrow = makeTask({ startDate: '2026-03-11', estimateMin: 900 })
    expect(offloadCandidates([tomorrow], TODAY, 60, 30, [])).toEqual([])
  })
})

describe('planPlacements', () => {
  const opts = { capacityMin: 360, workStart: '09:00', workEnd: '18:00', bufferMin: 10, defaultMin: 30 }

  it('places untimed tasks of today around a timed block', () => {
    const timed = makeTask({ id: 'timed', startDate: TODAY, startTime: '09:00', durationMin: 60 })
    const loose = makeTask({ id: 'loose', startDate: TODAY, estimateMin: 45 })
    const { placements, failures } = planPlacements(ctxOf([timed, loose]), opts)
    expect(failures).toEqual([])
    expect(placements).toEqual([{ taskId: 'loose', date: TODAY, startTime: '10:15', durationMin: 45, frameName: null }])
  })

  it('does not place tasks that are not on today', () => {
    const undated = makeTask({ id: 'undated' })
    const future = makeTask({ id: 'future', startDate: '2026-03-12' })
    expect(planPlacements(ctxOf([undated, future]), opts)).toEqual({ placements: [], failures: [], habitBlocks: [], habitFailures: [] })
  })

  it('does not place a blocked task', () => {
    const blocker = makeTask({ id: 'blocker', startDate: '2026-03-12' })
    const blocked = makeTask({ id: 'blocked', startDate: TODAY, blockedBy: ['blocker'] })
    expect(planPlacements(ctxOf([blocker, blocked]), opts).placements).toEqual([])
  })

  it('starts from the current time when it is already past work start', () => {
    const loose = makeTask({ id: 'loose', startDate: TODAY, estimateMin: 30 })
    const ctx = ctxOf([loose], new Date(2026, 2, 10, 13, 20))
    const { placements } = planPlacements(ctx, opts)
    expect(placements[0].startTime).toBe('13:30')
  })

  it('explains in Korean why a task does not fit today', () => {
    const huge = makeTask({ id: 'huge', startDate: TODAY, estimateMin: 120 })
    const { failures } = planPlacements(ctxOf([huge]), { ...opts, capacityMin: 60 })
    expect(failures).toHaveLength(1)
    expect(failures[0].reason).toContain('하루 용량')
  })

  it('says "today" rather than "the next 1 days" when nothing is left in the work window', () => {
    const loose = makeTask({ id: 'loose', startDate: TODAY, estimateMin: 60 })
    const ctx = ctxOf([loose], new Date(2026, 2, 10, 17, 30))
    const { failures } = planPlacements(ctx, opts)
    expect(failures[0].reason).toBe('오늘 안에 들어갈 빈 시간이 없어요')
  })
})

describe('eveningSummary', () => {
  const at = (h: number): number => new Date(2026, 2, 10, h, 0).getTime()

  it('collects tasks completed on the plan day and totals estimate vs actual', () => {
    const a = makeTask({ id: 'a', status: 'done', completedAt: at(10), estimateMin: 30, actualMin: { [TODAY]: 45 } })
    const b = makeTask({ id: 'b', status: 'done', completedAt: at(9), estimateMin: 60, actualMin: { [TODAY]: 50 } })
    const old = makeTask({ id: 'old', status: 'done', completedAt: new Date(2026, 2, 9, 22, 0).getTime() })
    const summary = eveningSummary([a, b, old], TODAY, 0)
    expect(summary.done.map((t) => t.id)).toEqual(['b', 'a'])
    expect(summary.estimateMin).toBe(90)
    expect(summary.actualMin).toBe(95)
  })

  it('treats a 2 am completion as the previous day when the day starts at 4 am', () => {
    const late = makeTask({ id: 'late', status: 'done', completedAt: new Date(2026, 2, 11, 2, 0).getTime() })
    expect(eveningSummary([late], TODAY, 4).done.map((t) => t.id)).toEqual(['late'])
  })

  it('skips trashed completions and counts tasks without a recorded time', () => {
    const trashed = makeTask({ status: 'done', completedAt: at(10), deletedAt: 1 })
    const bare = makeTask({ id: 'bare', status: 'done', completedAt: at(11) })
    const summary = eveningSummary([trashed, bare], TODAY, 0)
    expect(summary.done.map((t) => t.id)).toEqual(['bare'])
    expect(summary.estimateMin).toBe(0)
    expect(summary.untrackedCount).toBe(1)
  })

  it('lists what is still open on today as unfinished, timed ones first', () => {
    const open = makeTask({ id: 'open', startDate: TODAY })
    const timed = makeTask({ id: 'timed', startDate: TODAY, startTime: '08:00' })
    const tomorrow = makeTask({ id: 'tomorrow', startDate: '2026-03-11' })
    const finished = makeTask({ id: 'finished', startDate: TODAY, status: 'done', completedAt: at(8) })
    const summary = eveningSummary([open, timed, tomorrow, finished], TODAY, 0)
    expect(summary.unfinished.map((t) => t.id)).toEqual(['timed', 'open'])
  })
})

describe('recentReflections', () => {
  const plan = (date: string, reflection: string): DayPlan => ({
    date,
    capacityMin: null,
    highlightIds: [],
    morningDoneAt: null,
    eveningDoneAt: null,
    reflection,
  })

  it('returns the last seven days with text, newest first, without today', () => {
    const plans = [
      plan('2026-03-10', '오늘 것'),
      plan('2026-03-09', '어제'),
      plan('2026-03-03', '정확히 7일 전'),
      plan('2026-03-02', '너무 오래됨'),
      plan('2026-03-08', '   '),
    ]
    expect(recentReflections(plans, TODAY, 7).map((p) => p.date)).toEqual(['2026-03-09', '2026-03-03'])
  })
})

describe('describeLoad', () => {
  const load = (plannedMin: number, capacityMin: number) => ({
    date: TODAY,
    plannedMin,
    capacityMin,
    overMin: Math.max(0, plannedMin - capacityMin),
    ratio: capacityMin > 0 ? plannedMin / capacityMin : plannedMin > 0 ? Infinity : 0,
    level: plannedMin > capacityMin ? ('over' as const) : plannedMin / capacityMin >= 0.85 ? ('near' as const) : ('ok' as const),
  })

  it('writes used and total as durations', () => {
    expect(describeLoad(load(330, 360))).toMatchObject({ used: '5시간 30분', total: '6시간' })
  })

  it('says how much is over when the day overflows', () => {
    expect(describeLoad(load(440, 360)).note).toBe('1시간 20분 넘쳤어요')
  })

  it('says it is nearly full, or how much room is left, or that the day is empty', () => {
    expect(describeLoad(load(330, 360)).note).toBe('거의 찼어요')
    expect(describeLoad(load(120, 360)).note).toBe('4시간 여유')
    expect(describeLoad(load(0, 360)).note).toBe('아직 비어 있어요')
  })
})

describe('parseCapacityHours', () => {
  it('turns hours into minutes, accepting halves', () => {
    expect(parseCapacityHours('6')).toBe(360)
    expect(parseCapacityHours('5.5')).toBe(330)
    expect(parseCapacityHours(' 4,5 ')).toBe(270)
  })

  it('rejects empty, non-numeric, zero, negative and more than a day', () => {
    expect(parseCapacityHours('')).toBeNull()
    expect(parseCapacityHours('abc')).toBeNull()
    expect(parseCapacityHours('0')).toBeNull()
    expect(parseCapacityHours('-2')).toBeNull()
    expect(parseCapacityHours('25')).toBeNull()
  })
})

describe('highlightProgress', () => {
  it('counts how many of the chosen highlights got done', () => {
    const done = makeTask({ id: 'a', status: 'done' })
    const open = makeTask({ id: 'b' })
    expect(highlightProgress(['a', 'b', 'missing'], [done, open])).toEqual({ done: 1, total: 2 })
  })

  it('is empty when nothing was highlighted', () => {
    expect(highlightProgress([], [])).toEqual({ done: 0, total: 0 })
  })
})

describe('scheduledTasks', () => {
  it('returns only that day, timed first by clock then the rest by priority', () => {
    const later = makeTask({ id: 'later', startDate: TODAY, startTime: '15:00' })
    const early = makeTask({ id: 'early', startDate: TODAY, startTime: '08:00' })
    const urgent = makeTask({ id: 'urgent', startDate: TODAY, priority: 1 })
    const plain = makeTask({ id: 'plain', startDate: TODAY })
    const other = makeTask({ id: 'other', startDate: '2026-03-11' })
    const ids = scheduledTasks([plain, later, other, urgent, early], TODAY).map((t) => t.id)
    expect(ids).toEqual(['early', 'later', 'urgent', 'plain'])
  })
})

describe('planPlacements - 시간대 템플릿과 습관 블록(F12)', () => {
  const opts = { capacityMin: 360, workStart: '09:00', workEnd: '18:00', bufferMin: 10, defaultMin: 30 }

  const frame = (over: Partial<TimeFrame> = {}): TimeFrame => ({
    id: 'f1',
    name: '잡무',
    days: [0, 1, 2, 3, 4, 5, 6],
    start: '14:00',
    end: '18:00',
    match: { labelIds: [], priorities: [4], minMinutes: null },
    order: 0,
    ...over,
  })

  const habit = (over: Partial<Habit> = {}): Habit => ({
    id: 'h1',
    name: '운동',
    icon: null,
    color: '#2f6f5e',
    frequency: { type: 'daily' },
    goal: { kind: 'check', target: 1, unit: null },
    startDate: '2026-01-01',
    group: null,
    reminderTime: null,
    block: { durationMin: 30, start: '09:00', end: '12:00' },
    archived: false,
    logs: {},
    order: 1000,
    ...over,
  })

  it('시간대 템플릿에 맞는 일은 그 시간대에 넣고 이름을 붙인다', () => {
    const chore = makeTask({ id: 'chore', startDate: TODAY, priority: 4 })
    const { placements } = planPlacements(ctxOf([chore]), { ...opts, frames: [frame()] })

    expect(placements[0]).toMatchObject({ startTime: '14:00', frameName: '잡무' })
  })

  it('습관 블록이 먼저 자리를 잡고 할 일은 그 자리를 피한다', () => {
    const task = makeTask({ id: 't', startDate: TODAY })
    const result = planPlacements(ctxOf([task]), { ...opts, habits: [habit()] })

    expect(result.habitBlocks[0]).toMatchObject({ habitId: 'h1', startTime: '09:00', durationMin: 30 })
    // 09:00~09:30 + 버퍼 10분 → 15분 격자에 맞춰 09:45
    expect(result.placements[0]?.startTime).toBe('09:45')
  })

  it('이미 시각이 정해진 할 일 자리에는 습관 블록을 넣지 않는다', () => {
    const fixed = makeTask({ id: 'fixed', startDate: TODAY, startTime: '09:00', durationMin: 60 })
    const result = planPlacements(ctxOf([fixed]), { ...opts, habits: [habit()] })

    expect(result.habitBlocks[0]?.startTime).toBe('10:15')
  })

  it('습관 블록이 들어갈 자리가 없으면 이유를 돌려준다', () => {
    const blocking = makeTask({ id: 'all-day', startDate: TODAY, startTime: '09:00', durationMin: 180 })
    const result = planPlacements(ctxOf([blocking]), { ...opts, habits: [habit()] })

    expect(result.habitBlocks).toEqual([])
    expect(result.habitFailures[0]?.habitId).toBe('h1')
  })
})
