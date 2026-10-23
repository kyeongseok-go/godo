import { makeTask } from '../../test/factories'
import type { EngineContext } from '../../domain/types'
import { applyOptions, DEFAULT_OPTIONS, readOptions, writeOptions } from './viewOptions'

const ctx: EngineContext = { today: '2026-10-23', now: new Date(2026, 9, 23), weekStartsOn: 1, projects: [], sections: [], labels: [], tasks: [] }

describe('readOptions', () => {
  test('returns defaults for an empty query string', () => {
    expect(readOptions(new URLSearchParams())).toEqual(DEFAULT_OPTIONS)
  })

  test('reads valid values and ignores unknown ones', () => {
    const opts = readOptions(new URLSearchParams('sort=priority&dir=desc&group=label&done=1'))
    expect(opts).toEqual({ sort: 'priority', dir: 'desc', group: 'label', showDone: true })

    const bad = readOptions(new URLSearchParams('sort=nonsense&group=zzz&dir=sideways'))
    expect(bad).toEqual(DEFAULT_OPTIONS)
  })
})

describe('writeOptions', () => {
  test('omits defaults and preserves unrelated params', () => {
    const params = writeOptions(new URLSearchParams('view=board&task=abc'), { sort: 'date' })

    expect(params.get('sort')).toBe('date')
    expect(params.get('view')).toBe('board')
    expect(params.get('task')).toBe('abc')
    expect(params.has('dir')).toBe(false)
  })

  test('returning to the default removes the key', () => {
    const params = writeOptions(new URLSearchParams('sort=date&done=1'), { sort: 'manual', showDone: false })

    expect(params.toString()).toBe('')
  })
})

describe('applyOptions', () => {
  const open = makeTask({ id: 'o', title: 'b' })
  const done = makeTask({ id: 'd', title: 'a', status: 'done' })
  const canceled = makeTask({ id: 'c', title: 'c', status: 'canceled' })

  test('hides done and canceled tasks by default', () => {
    const groups = applyOptions([open, done, canceled], DEFAULT_OPTIONS, ctx)

    expect(groups).toHaveLength(1)
    expect(groups[0].tasks.map((t) => t.id)).toEqual(['o'])
  })

  test('shows them when showDone is on, and sorts by name', () => {
    const groups = applyOptions([open, done, canceled], { ...DEFAULT_OPTIONS, showDone: true, sort: 'name' }, ctx)

    expect(groups[0].tasks.map((t) => t.id)).toEqual(['d', 'o', 'c'])
  })

  test('groups by priority when asked', () => {
    const p1 = makeTask({ id: 'p1', priority: 1 })
    const p4 = makeTask({ id: 'p4', priority: 4 })

    const groups = applyOptions([p4, p1], { ...DEFAULT_OPTIONS, group: 'priority' }, ctx)

    expect(groups.map((g) => g.tasks[0].id)).toEqual(['p1', 'p4'])
  })
})
