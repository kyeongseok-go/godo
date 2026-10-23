import { describe, expect, it } from 'vitest'
import type { TaskGroup } from '../../domain/views'
import { makeBulkTasks } from '../../test/bulk'
import { makeTask } from '../../test/factories'
import { nextMembership } from './membership'

const group = (key: string, ids: string[]): TaskGroup => ({ key, title: key, tasks: ids.map((id) => makeTask({ id })) })
const none: Readonly<Record<string, true>> = {}

describe('nextMembership', () => {
  it('records the group key of every visible task', () => {
    const next = nextMembership(new Map(), [group('g1', ['a', 'b']), group('g2', ['c'])], none)

    expect([...next]).toEqual([['a', 'g1'], ['b', 'g1'], ['c', 'g2']])
  })

  it('keeps a lingering task that has just left the list in its old group', () => {
    const prev = nextMembership(new Map(), [group('g1', ['a', 'b'])], none)

    const next = nextMembership(prev, [group('g1', ['b'])], { a: true })

    expect(next.get('a')).toBe('g1')
    expect(next.get('b')).toBe('g1')
  })

  it('forgets a task that left the list once it stops lingering', () => {
    const prev = nextMembership(new Map(), [group('g1', ['a', 'b'])], none)

    const next = nextMembership(prev, [group('g1', ['b'])], none)

    expect(next.has('a')).toBe(false)
  })

  it('does not invent a group for a lingering id it has never seen', () => {
    expect(nextMembership(new Map(), [group('g1', ['b'])], { ghost: true }).has('ghost')).toBe(false)
  })

  it('follows a task that moved to another group', () => {
    const prev = nextMembership(new Map(), [group('g1', ['a']), group('g2', [])], none)

    const next = nextMembership(prev, [group('g1', []), group('g2', ['a'])], { a: true })

    expect(next.get('a')).toBe('g2')
  })

  it('handles empty input and never mutates the previous map', () => {
    const prev = new Map([['a', 'g1']])

    const next = nextMembership(prev, [], none)

    expect(next.size).toBe(0)
    expect([...prev]).toEqual([['a', 'g1']])
    expect(nextMembership(new Map(), [], none).size).toBe(0)
  })

  it('handles 100,000 tasks well within the budget (was O(n²), 394ms per render at 10,000)', () => {
    const tasks = makeBulkTasks(100_000)
    const groups: TaskGroup[] = [{ key: 'all', title: '', tasks }]
    const prev = nextMembership(new Map(), groups, none)
    const started = performance.now()

    const next = nextMembership(prev, groups, none)

    expect(performance.now() - started).toBeLessThan(2_000)
    expect(next.size).toBe(100_000)
  })
})
