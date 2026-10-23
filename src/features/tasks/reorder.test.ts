import { makeTask } from '../../test/factories'
import { computeReorder } from './reorder'

const list = () => [makeTask({ id: 'a', order: 1000 }), makeTask({ id: 'b', order: 2000 }), makeTask({ id: 'c', order: 3000 })]

describe('computeReorder', () => {
  test('moving down lands after the target', () => {
    const r = computeReorder(list(), 'a', 'b')

    expect(r?.order).toBeGreaterThan(2000)
    expect(r?.order).toBeLessThan(3000)
  })

  test('moving up lands before the target', () => {
    const r = computeReorder(list(), 'c', 'b')

    expect(r?.order).toBeGreaterThan(1000)
    expect(r?.order).toBeLessThan(2000)
  })

  test('moving to the very top or bottom extends past the ends', () => {
    expect(computeReorder(list(), 'c', 'a')?.order).toBeLessThan(1000)
    expect(computeReorder(list(), 'a', 'c')?.order).toBeGreaterThan(3000)
  })

  test('works regardless of the input order', () => {
    const shuffled = [list()[2], list()[0], list()[1]]

    expect(computeReorder(shuffled, 'a', 'b')?.order).toBeGreaterThan(2000)
  })

  test('returns null for identical ids or non-siblings', () => {
    expect(computeReorder(list(), 'a', 'a')).toBeNull()
    expect(computeReorder(list(), 'a', 'ghost')).toBeNull()
    expect(computeReorder(list(), 'ghost', 'a')).toBeNull()
  })

  test('flags rebalance when neighbours are nearly equal', () => {
    const tight = [makeTask({ id: 'a', order: 1 }), makeTask({ id: 'b', order: 2 }), makeTask({ id: 'c', order: 2 + 1e-10 })]

    expect(computeReorder(tight, 'a', 'b')?.needsRebalance).toBe(true)
  })
})
