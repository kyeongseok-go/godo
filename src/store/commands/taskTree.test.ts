import { describe, expect, test } from 'vitest'
import { makeTask } from '../../test/factories'
import { emptyEntityState } from '../changes'
import type { EntityState } from '../changes'
import type { Task } from '../../domain/types'
import { childrenIndex, descendantsFrom, descendantsOf } from './taskTree'

const stateOf = (tasks: Task[]): EntityState => ({
  ...emptyEntityState(),
  tasks: Object.fromEntries(tasks.map((t) => [t.id, t])),
})
const idsOf = (tasks: Task[]): string[] => tasks.map((t) => t.id).sort()

describe('descendantsFrom', () => {
  const tasks = [
    makeTask({ id: 'root' }),
    makeTask({ id: 'a', parentId: 'root' }),
    makeTask({ id: 'a1', parentId: 'a' }),
    makeTask({ id: 'b', parentId: 'root' }),
    makeTask({ id: 'other' }),
  ]

  test('collects every descendant without the starting task', () => {
    const index = childrenIndex(stateOf(tasks).tasks)

    expect(idsOf(descendantsFrom(index, 'root'))).toEqual(['a', 'a1', 'b'])
    expect(idsOf(descendantsFrom(index, 'a'))).toEqual(['a1'])
  })

  test('returns an empty list for a leaf, an unknown id, and an empty index', () => {
    const index = childrenIndex(stateOf(tasks).tasks)

    expect(descendantsFrom(index, 'a1')).toEqual([])
    expect(descendantsFrom(index, 'ghost')).toEqual([])
    expect(descendantsFrom(childrenIndex({}), 'root')).toEqual([])
  })

  test('visits each task once even when the parent links form a cycle', () => {
    const cyclic = [
      makeTask({ id: 'x', parentId: 'y' }),
      makeTask({ id: 'y', parentId: 'z' }),
      makeTask({ id: 'z', parentId: 'x' }),
    ]
    const index = childrenIndex(stateOf(cyclic).tasks)

    expect(idsOf(descendantsFrom(index, 'x'))).toEqual(['y', 'z'])
  })

  test('can be called repeatedly on one index without changing it', () => {
    const index = childrenIndex(stateOf(tasks).tasks)

    const first = descendantsFrom(index, 'root')
    const second = descendantsFrom(index, 'root')

    expect(idsOf(second)).toEqual(idsOf(first))
    expect(index.get('root')).toHaveLength(2)
  })
})

describe('descendantsOf', () => {
  test('matches descendantsFrom on a freshly built index', () => {
    const tasks = [makeTask({ id: 'p' }), makeTask({ id: 'c', parentId: 'p' }), makeTask({ id: 'd', parentId: 'c' })]
    const state = stateOf(tasks)

    expect(idsOf(descendantsOf(state, 'p'))).toEqual(idsOf(descendantsFrom(childrenIndex(state.tasks), 'p')))
    expect(idsOf(descendantsOf(state, 'p'))).toEqual(['c', 'd'])
  })

  test('returns nothing for an empty state and survives a self-parented task', () => {
    expect(descendantsOf(emptyEntityState(), 'x')).toEqual([])
    expect(descendantsOf(stateOf([makeTask({ id: 'self', parentId: 'self' })]), 'self')).toEqual([])
  })
})
