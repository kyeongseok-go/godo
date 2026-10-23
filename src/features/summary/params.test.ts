import {
  DEFAULT_SUMMARY_PARAMS,
  isQuickPresetActive,
  parseSummaryParams,
  quickPresetParams,
  resolveSummaryOptions,
  summaryFileName,
  toggleProject,
  writeSummaryParams,
} from './params'
import type { SummaryParams } from './params'

const q = (search: string) => new URLSearchParams(search)
const params = (patch: Partial<SummaryParams> = {}): SummaryParams => ({ ...DEFAULT_SUMMARY_PARAMS, ...patch })

describe('parseSummaryParams', () => {
  test('falls back to this week, every project and every status', () => {
    expect(parseSummaryParams(q(''))).toEqual({
      range: 'thisWeek',
      from: null,
      to: null,
      projectIds: null,
      status: 'all',
    })
  })

  test('reads every field', () => {
    const result = parseSummaryParams(q('range=custom&from=2026-10-01&to=2026-10-15&projects=a,b&status=completed'))

    expect(result).toEqual({
      range: 'custom',
      from: '2026-10-01',
      to: '2026-10-15',
      projectIds: ['a', 'b'],
      status: 'completed',
    })
  })

  test('ignores unknown range and status values', () => {
    const result = parseSummaryParams(q('range=forever&status=maybe'))

    expect(result.range).toBe('thisWeek')
    expect(result.status).toBe('all')
  })

  test('drops malformed or impossible dates', () => {
    const result = parseSummaryParams(q('range=custom&from=2026-02-30&to=yesterday'))

    expect(result.from).toBeNull()
    expect(result.to).toBeNull()
  })

  test('treats an empty projects value as "none selected" and removes blanks and duplicates', () => {
    expect(parseSummaryParams(q('projects=')).projectIds).toEqual([])
    expect(parseSummaryParams(q('projects=,a,,a,b')).projectIds).toEqual(['a', 'b'])
  })

  test('keeps project ids that contain url-escaped characters', () => {
    expect(parseSummaryParams(q('projects=p%20one')).projectIds).toEqual(['p one'])
  })
})

describe('writeSummaryParams', () => {
  test('writes nothing for the defaults', () => {
    expect(writeSummaryParams(DEFAULT_SUMMARY_PARAMS).toString()).toBe('')
  })

  test('round-trips a fully customised state', () => {
    const state = params({ range: 'custom', from: '2026-10-01', to: '2026-10-15', projectIds: ['a', 'b'], status: 'pending' })

    expect(parseSummaryParams(writeSummaryParams(state))).toEqual(state)
  })

  test('round-trips an empty project selection', () => {
    const state = params({ projectIds: [] })

    expect(parseSummaryParams(writeSummaryParams(state))).toEqual(state)
  })

  test('only writes custom dates for the custom range', () => {
    const written = writeSummaryParams(params({ range: 'lastWeek', from: '2026-10-01', to: '2026-10-02' }))

    expect(written.has('from')).toBe(false)
    expect(written.get('range')).toBe('lastWeek')
  })

  test('keeps unrelated query keys and replaces stale summary keys', () => {
    const base = q('task=abc&status=completed&range=today')

    const written = writeSummaryParams(params(), base)

    expect(written.get('task')).toBe('abc')
    expect(written.has('status')).toBe(false)
    expect(written.has('range')).toBe(false)
    expect(base.get('status')).toBe('completed')
  })
})

describe('resolveSummaryOptions', () => {
  const today = '2026-10-23' // 금요일
  const resolve = (p: Partial<SummaryParams>, weekStartsOn: 0 | 1 = 1, day = today) =>
    resolveSummaryOptions(params(p), day, weekStartsOn)

  test('today is a single day', () => {
    expect(resolve({ range: 'today' })).toMatchObject({ from: today, to: today })
  })

  test('this week follows the week start setting', () => {
    expect(resolve({ range: 'thisWeek' }, 1)).toMatchObject({ from: '2026-10-19', to: '2026-10-25' })
    expect(resolve({ range: 'thisWeek' }, 0)).toMatchObject({ from: '2026-10-18', to: '2026-10-24' })
  })

  test('last week is the seven days before this week', () => {
    expect(resolve({ range: 'lastWeek' }, 1)).toMatchObject({ from: '2026-10-12', to: '2026-10-18' })
  })

  test('this month runs to the last day, including a leap February', () => {
    expect(resolve({ range: 'thisMonth' })).toMatchObject({ from: '2026-10-01', to: '2026-10-31' })
    expect(resolve({ range: 'thisMonth' }, 1, '2028-02-10')).toMatchObject({ from: '2028-02-01', to: '2028-02-29' })
  })

  test('crosses the year boundary for last week', () => {
    expect(resolve({ range: 'lastWeek' }, 1, '2027-01-05')).toMatchObject({ from: '2026-12-28', to: '2027-01-03' })
  })

  test('custom swaps reversed dates and fills a missing end with the other one', () => {
    expect(resolve({ range: 'custom', from: '2026-10-20', to: '2026-10-10' })).toMatchObject({ from: '2026-10-10', to: '2026-10-20' })
    expect(resolve({ range: 'custom', from: '2026-10-05', to: null })).toMatchObject({ from: '2026-10-05', to: '2026-10-05' })
    expect(resolve({ range: 'custom', from: null, to: null })).toMatchObject({ from: today, to: today })
  })

  test('passes the project and status filters through', () => {
    expect(resolve({ projectIds: ['a'], status: 'pending' })).toMatchObject({ projectIds: ['a'], status: 'pending' })
  })
})

describe('toggleProject', () => {
  const all = ['a', 'b', 'c']

  test('picking a project while "all" is on selects just that one', () => {
    expect(toggleProject(null, 'b', all)).toEqual(['b'])
  })

  test('adds and removes projects from an explicit selection', () => {
    expect(toggleProject(['a'], 'b', all)).toEqual(['a', 'b'])
    expect(toggleProject(['a', 'b'], 'a', all)).toEqual(['b'])
  })

  test('goes back to "all" when everything is selected or the last one is removed', () => {
    expect(toggleProject(['a', 'b'], 'c', all)).toBeNull()
    expect(toggleProject(['a'], 'a', all)).toBeNull()
  })

  test('does not mutate the current selection', () => {
    const current = ['a']
    toggleProject(current, 'b', all)

    expect(current).toEqual(['a'])
  })
})

describe('quick presets', () => {
  const today = '2026-10-23'

  test('"this week done" completes this week and keeps the project filter', () => {
    const result = quickPresetParams('thisWeekDone', params({ projectIds: ['a'] }), today, 1)

    expect(result).toEqual(params({ range: 'thisWeek', status: 'completed', projectIds: ['a'] }))
  })

  test('"next week todo" is the coming week as a custom range of open tasks', () => {
    const result = quickPresetParams('nextWeekTodo', params(), today, 1)

    expect(result).toEqual(params({ range: 'custom', from: '2026-10-26', to: '2026-11-01', status: 'pending' }))
  })

  test('detects which preset is currently active', () => {
    const next = quickPresetParams('nextWeekTodo', params(), today, 1)

    expect(isQuickPresetActive('nextWeekTodo', next, today, 1)).toBe(true)
    expect(isQuickPresetActive('thisWeekDone', next, today, 1)).toBe(false)
    expect(isQuickPresetActive('thisWeekDone', params({ range: 'thisWeek', status: 'completed' }), today, 1)).toBe(true)
  })
})

describe('summaryFileName', () => {
  test('names the file after the period', () => {
    expect(summaryFileName({ from: '2026-10-19', to: '2026-10-25' })).toBe('pace-summary-2026-10-19_2026-10-25.md')
  })

  test('uses a single date for one-day reports', () => {
    expect(summaryFileName({ from: '2026-10-23', to: '2026-10-23' })).toBe('pace-summary-2026-10-23.md')
  })
})
