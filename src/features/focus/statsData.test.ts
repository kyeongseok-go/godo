import { makeTask } from '../../test/factories'
import { buildDailyBars, buildDots, buildTopTasks } from './statsData'

describe('buildDailyBars', () => {
  test('returns a continuous window ending today with zero-filled gaps', () => {
    const bars = buildDailyBars([{ date: '2026-03-02', min: 50 }, { date: '2026-03-04', min: 25 }], '2026-03-05', 5)
    expect(bars).toEqual([
      { date: '2026-03-01', min: 0 },
      { date: '2026-03-02', min: 50 },
      { date: '2026-03-03', min: 0 },
      { date: '2026-03-04', min: 25 },
      { date: '2026-03-05', min: 0 },
    ])
  })

  test('ignores days outside the window and crosses month and year ends', () => {
    const bars = buildDailyBars([{ date: '2025-12-20', min: 99 }, { date: '2025-12-31', min: 10 }], '2026-01-02', 3)
    expect(bars.map((b) => b.date)).toEqual(['2025-12-31', '2026-01-01', '2026-01-02'])
    expect(bars.map((b) => b.min)).toEqual([10, 0, 0])
  })

  test('returns an empty list for a non-positive window', () => {
    expect(buildDailyBars([], '2026-03-05', 0)).toEqual([])
  })
})

describe('buildTopTasks', () => {
  const tasks = new Map([
    ['a', makeTask({ id: 'a', title: '보고서' })],
    ['b', makeTask({ id: 'b', title: '운동' })],
  ])

  test('keeps the highest linked tasks with titles and reports unlinked time separately', () => {
    const result = buildTopTasks(
      [{ taskId: 'a', min: 90 }, { taskId: null, min: 40 }, { taskId: 'b', min: 30 }],
      tasks,
      5,
    )
    expect(result.items).toEqual([
      { taskId: 'a', title: '보고서', min: 90 },
      { taskId: 'b', title: '운동', min: 30 },
    ])
    expect(result.unlinkedMin).toBe(40)
  })

  test('limits the list and labels tasks that no longer exist', () => {
    const result = buildTopTasks(
      [{ taskId: 'a', min: 90 }, { taskId: 'gone', min: 60 }, { taskId: 'b', min: 30 }],
      tasks,
      2,
    )
    expect(result.items.map((i) => i.title)).toEqual(['보고서', '삭제된 할 일'])
  })

  test('skips entries with no minutes', () => {
    expect(buildTopTasks([{ taskId: 'a', min: 0 }], tasks, 5).items).toEqual([])
  })
})

describe('buildDots', () => {
  test('pads to the next full cycle', () => {
    expect(buildDots(0, 4)).toEqual({ done: 0, total: 4 })
    expect(buildDots(3, 4)).toEqual({ done: 3, total: 4 })
    expect(buildDots(4, 4)).toEqual({ done: 4, total: 4 })
    expect(buildDots(5, 4)).toEqual({ done: 5, total: 8 })
  })

  test('guards against an invalid cycle length', () => {
    expect(buildDots(2, 0)).toEqual({ done: 2, total: 2 })
  })
})
