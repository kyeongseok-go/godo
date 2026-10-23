import { makeTask } from '../../test/factories'
import { matrixQuadrants, moveToQuadrantPriority } from './matrix'
import type { Quadrant } from './types'

const ids = (tasks: readonly { id: string }[]): string[] => tasks.map((t) => t.id)

describe('matrixQuadrants', () => {
  test('returns four empty quadrants for empty input', () => {
    expect(matrixQuadrants([])).toEqual({ doFirst: [], schedule: [], delegate: [], eliminate: [] })
  })

  test('maps P1..P4 to the four quadrants', () => {
    const tasks = [
      makeTask({ id: 'p1', priority: 1 }),
      makeTask({ id: 'p2', priority: 2 }),
      makeTask({ id: 'p3', priority: 3 }),
      makeTask({ id: 'p4', priority: 4 }),
    ]
    const result = matrixQuadrants(tasks)
    expect(ids(result.doFirst)).toEqual(['p1'])
    expect(ids(result.schedule)).toEqual(['p2'])
    expect(ids(result.delegate)).toEqual(['p3'])
    expect(ids(result.eliminate)).toEqual(['p4'])
  })

  test('keeps input order inside a quadrant', () => {
    const a = makeTask({ id: 'a', priority: 1 })
    const b = makeTask({ id: 'b', priority: 1 })
    const c = makeTask({ id: 'c', priority: 1 })
    expect(ids(matrixQuadrants([b, c, a]).doFirst)).toEqual(['b', 'c', 'a'])
  })

  test('skips finished, canceled and trashed tasks but keeps active ones', () => {
    const tasks = [
      makeTask({ id: 'done', priority: 1, status: 'done' }),
      makeTask({ id: 'canceled', priority: 1, status: 'canceled' }),
      makeTask({ id: 'trashed', priority: 1, deletedAt: 123 }),
      makeTask({ id: 'active', priority: 1, status: 'active' }),
      makeTask({ id: 'todo', priority: 1, status: 'todo' }),
    ]
    expect(ids(matrixQuadrants(tasks).doFirst)).toEqual(['active', 'todo'])
  })
})

describe('moveToQuadrantPriority', () => {
  test('is the inverse of the quadrant mapping', () => {
    const quadrants: Quadrant[] = ['doFirst', 'schedule', 'delegate', 'eliminate']
    expect(quadrants.map(moveToQuadrantPriority)).toEqual([1, 2, 3, 4])
    quadrants.forEach((q) => {
      const task = makeTask({ priority: moveToQuadrantPriority(q) })
      expect(matrixQuadrants([task])[q]).toEqual([task])
    })
  })
})
