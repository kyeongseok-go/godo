import { makeProject, makeTask } from '../../test/factories'
import {
  axisLabelIndices,
  buildTrend,
  describeTrendBar,
  hasCompletionHistory,
  levelProgress,
  projectDistribution,
  TREND_PADDING,
} from './chart'

const series = (counts: number[]) =>
  counts.map((done, i) => {
    const d = new Date(2026, 9, 23 - (counts.length - 1 - i))
    return { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, done }
  })

const base = { dailyGoal: 4, daysOff: [0, 6] as const, today: '2026-10-23', width: 340, height: 200 }

describe('buildTrend', () => {
  test('scales bars against the larger of the goal and the busiest day', () => {
    const chart = buildTrend({ ...base, series: series([0, 2, 8]), daysOff: [] })
    const plotH = base.height - TREND_PADDING.top - TREND_PADDING.bottom

    expect(chart.max).toBe(8)
    expect(chart.bars[2].height).toBeCloseTo(plotH)
    expect(chart.bars[1].height).toBeCloseTo(plotH / 4)
    expect(chart.bars[0].height).toBe(0)
  })

  test('raises the scale to the goal when no day reaches it', () => {
    const chart = buildTrend({ ...base, series: series([1, 1]), dailyGoal: 5 })

    expect(chart.max).toBe(5)
    expect(chart.goalY).toBeCloseTo(TREND_PADDING.top)
  })

  test('keeps a visible sliver for days with at least one completion', () => {
    const chart = buildTrend({ ...base, series: series([1, 100]), dailyGoal: 1 })

    expect(chart.bars[0].height).toBeGreaterThanOrEqual(2)
  })

  test('marks days off by weekday and flags only the last day as today', () => {
    // 2026-10-23 is a Friday, so 24 is not in the series; 17/18 are Sat/Sun
    const chart = buildTrend({ ...base, series: series([1, 1, 1, 1, 1, 1, 1]), daysOff: [0, 6] })
    const offDates = chart.bars.filter((b) => b.isOff).map((b) => b.date)

    expect(offDates).toEqual(['2026-10-17', '2026-10-18'])
    expect(chart.bars.filter((b) => b.isToday).map((b) => b.date)).toEqual(['2026-10-23'])
  })

  test('lays slots left to right without overflowing the plot area', () => {
    const chart = buildTrend({ ...base, series: series(Array.from({ length: 30 }, () => 1)) })
    const last = chart.bars[29]

    expect(chart.bars[0].slotX).toBeCloseTo(TREND_PADDING.left)
    expect(last.slotX + last.slotWidth).toBeLessThanOrEqual(base.width - TREND_PADDING.right + 0.001)
    expect(chart.bars.every((b) => b.x >= b.slotX && b.x + b.width <= b.slotX + b.slotWidth + 0.001)).toBe(true)
  })

  test('returns no bars for an empty series without dividing by zero', () => {
    const chart = buildTrend({ ...base, series: [] })

    expect(chart.bars).toEqual([])
    expect(chart.max).toBeGreaterThanOrEqual(1)
  })

  test('treats a non-positive goal as one', () => {
    const chart = buildTrend({ ...base, series: series([0]), dailyGoal: 0 })

    expect(chart.max).toBe(1)
  })
})

describe('axisLabelIndices', () => {
  test('counts back from today so the last bar is always labelled', () => {
    expect(axisLabelIndices(30, 7)).toEqual([1, 8, 15, 22, 29])
  })

  test('handles short and empty series', () => {
    expect(axisLabelIndices(0, 7)).toEqual([])
    expect(axisLabelIndices(1, 7)).toEqual([0])
  })

  test('falls back to a step of one for invalid steps', () => {
    expect(axisLabelIndices(3, 0)).toEqual([0, 1, 2])
  })
})

describe('describeTrendBar', () => {
  const chart = buildTrend({ ...base, series: series([0, 3, 5]), daysOff: [6] })

  test('reads date, weekday and count in Korean', () => {
    expect(describeTrendBar(chart.bars[1], 4)).toBe('10월 22일 (목) · 3건 완료')
  })

  test('adds the today and day-off context and goal result', () => {
    expect(describeTrendBar(chart.bars[2], 4)).toBe('10월 23일 (금) · 5건 완료 · 목표 달성 · 오늘')
  })

  test('says so when nothing was completed on a day off', () => {
    const off = buildTrend({ ...base, series: series([0, 0, 0, 0, 0, 0, 0]), daysOff: [6] }).bars[0]

    expect(describeTrendBar(off, 4)).toBe('10월 17일 (토) · 완료 없음 · 쉬는 날')
  })
})

describe('levelProgress', () => {
  test('measures the share between the current level floor and the next', () => {
    expect(levelProgress(1500, 1, 2500)).toEqual({ ratio: 0.5, remaining: 1000 })
  })

  test('is full with nothing remaining at the top level', () => {
    expect(levelProgress(60000, 7, null)).toEqual({ ratio: 1, remaining: null })
  })

  test('starts at zero at the level floor', () => {
    expect(levelProgress(0, 0, 500)).toEqual({ ratio: 0, remaining: 500 })
  })
})

describe('projectDistribution', () => {
  const at = (month: number, day: number) => new Date(2026, month - 1, day, 12).getTime()
  const projects = [
    makeProject({ id: 'a', name: '업무', color: '#111111' }),
    makeProject({ id: 'b', name: '집', color: '#222222' }),
    makeProject({ id: 'c', name: '공부', color: '#333333' }),
  ]
  const done = (projectId: string, month: number, day: number) =>
    makeTask({ projectId, status: 'done', completedAt: at(month, day) })

  test('counts completions per project inside the window and sorts by count', () => {
    const tasks = [done('a', 10, 20), done('b', 10, 21), done('b', 10, 22), done('a', 9, 1), makeTask({ projectId: 'a' })]

    const result = projectDistribution({ tasks, projects, from: '2026-09-24', to: '2026-10-23' })

    expect(result.items.map((i) => [i.name, i.count])).toEqual([['집', 2], ['업무', 1]])
    expect(result.items[0].ratio).toBe(1)
    expect(result.items[1].ratio).toBe(0.5)
    expect(result.total).toBe(3)
  })

  test('ignores trashed and non-done tasks', () => {
    const trashed = makeTask({ projectId: 'a', status: 'done', completedAt: at(10, 20), deletedAt: 1 })
    const canceled = makeTask({ projectId: 'a', status: 'canceled', completedAt: at(10, 20) })

    const result = projectDistribution({ tasks: [trashed, canceled], projects, from: '2026-10-01', to: '2026-10-23' })

    expect(result.items).toEqual([])
  })

  test('limits the list and reports how many projects were left out', () => {
    const tasks = [done('a', 10, 20), done('a', 10, 21), done('b', 10, 20), done('c', 10, 20)]

    const result = projectDistribution({ tasks, projects, from: '2026-10-01', to: '2026-10-23', limit: 2 })

    expect(result.items).toHaveLength(2)
    expect(result.otherProjects).toBe(1)
  })

  test('labels completions whose project no longer exists', () => {
    const result = projectDistribution({ tasks: [done('gone', 10, 20)], projects, from: '2026-10-01', to: '2026-10-23' })

    expect(result.items[0].name).toBe('삭제된 프로젝트')
  })

  test('breaks ties by name so the order is stable', () => {
    const result = projectDistribution({ tasks: [done('b', 10, 20), done('a', 10, 20)], projects, from: '2026-10-01', to: '2026-10-23' })

    expect(result.items.map((i) => i.name)).toEqual(['업무', '집'])
  })
})

describe('hasCompletionHistory', () => {
  test('is true once any task was completed and not trashed', () => {
    expect(hasCompletionHistory([makeTask({ status: 'done', completedAt: 1 })])).toBe(true)
  })

  test('ignores open, canceled, trashed and timestamp-less tasks', () => {
    const tasks = [
      makeTask(),
      makeTask({ status: 'canceled', completedAt: 1 }),
      makeTask({ status: 'done', completedAt: 1, deletedAt: 2 }),
      makeTask({ status: 'done', completedAt: null }),
    ]

    expect(hasCompletionHistory(tasks)).toBe(false)
  })
})
