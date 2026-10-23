import { rebalanceOrders, reorderValue } from './order'

describe('reorderValue', () => {
  test('returns 0 when there are no neighbours', () => {
    expect(reorderValue(null, null)).toEqual({ value: 0, needsRebalance: false })
  })

  test('goes 1000 below the next item when inserted at the top', () => {
    expect(reorderValue(null, 500)).toEqual({ value: -500, needsRebalance: false })
  })

  test('goes 1000 above the previous item when inserted at the bottom', () => {
    expect(reorderValue(2000, null)).toEqual({ value: 3000, needsRebalance: false })
  })

  test('returns the midpoint between two neighbours', () => {
    expect(reorderValue(1000, 2000)).toEqual({ value: 1500, needsRebalance: false })
    expect(reorderValue(-1, 0)).toEqual({ value: -0.5, needsRebalance: false })
  })

  test('asks for a rebalance when the gap shrinks to 1e-9 or less', () => {
    const tight = reorderValue(1, 1 + 1e-10)
    expect(tight.needsRebalance).toBe(true)
    expect(tight.value).toBeCloseTo(1, 9)
    expect(reorderValue(1, 1 + 5e-10).needsRebalance).toBe(true)
    expect(reorderValue(1, 1 + 1e-6).needsRebalance).toBe(false)
  })

  test('asks for a rebalance when both neighbours share the same value', () => {
    expect(reorderValue(5, 5)).toEqual({ value: 5, needsRebalance: true })
  })

  test('treats non-finite neighbours as missing instead of throwing', () => {
    expect(reorderValue(Number.NaN, null)).toEqual({ value: 0, needsRebalance: false })
    expect(reorderValue(Number.POSITIVE_INFINITY, 10)).toEqual({ value: -990, needsRebalance: false })
  })

  test('can be applied repeatedly until a rebalance is requested', () => {
    let next = 1
    let hit = false
    for (let i = 0; i < 80 && !hit; i += 1) {
      const r = reorderValue(0, next)
      next = r.value
      hit = r.needsRebalance
    }
    expect(hit).toBe(true)
  })
})

describe('rebalanceOrders', () => {
  test('returns an empty map for empty input', () => {
    expect(rebalanceOrders([]).size).toBe(0)
  })

  test('assigns 1000-step values in the given order', () => {
    const result = rebalanceOrders([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
    expect([...result.entries()]).toEqual([
      ['a', 1000],
      ['b', 2000],
      ['c', 3000],
    ])
  })

  test('keeps the first position when an id appears twice', () => {
    const result = rebalanceOrders([{ id: 'a' }, { id: 'b' }, { id: 'a' }])
    expect(result.get('a')).toBe(1000)
    expect(result.get('b')).toBe(2000)
    expect(result.size).toBe(2)
  })
})
