import { makeTask } from '../../test/factories'
import { computeDrop } from './drop'
import type { BoardColumn } from './drop'

const t = (id: string, order: number) => makeTask({ id, order })

const columns = (): BoardColumn[] => [
  { key: 'none', sectionId: null, tasks: [t('a', 1000), t('b', 2000), t('c', 3000)] },
  { key: 's1', sectionId: 's1', tasks: [t('x', 1000), t('y', 2000)] },
  { key: 's2', sectionId: 's2', tasks: [] },
]

describe('computeDrop', () => {
  test('dropping on a column appends after its last card', () => {
    const r = computeDrop(columns(), 'a', 'col:s1')

    expect(r?.sectionId).toBe('s1')
    expect(r?.order).toBeGreaterThan(2000)
  })

  test('dropping on an empty column gives it a first order value', () => {
    const r = computeDrop(columns(), 'a', 'col:s2')

    expect(r).toMatchObject({ sectionId: 's2' })
    expect(Number.isFinite(r?.order)).toBe(true)
  })

  test('dropping on a card in another column inserts before it', () => {
    const r = computeDrop(columns(), 'a', 'y')

    expect(r?.sectionId).toBe('s1')
    expect(r?.order).toBeGreaterThan(1000)
    expect(r?.order).toBeLessThan(2000)
  })

  test('moving down within a column lands after the target card', () => {
    const r = computeDrop(columns(), 'a', 'b')

    expect(r?.sectionId).toBeNull()
    expect(r?.order).toBeGreaterThan(2000)
    expect(r?.order).toBeLessThan(3000)
  })

  test('moving up within a column lands before the target card', () => {
    const r = computeDrop(columns(), 'c', 'b')

    expect(r?.order).toBeGreaterThan(1000)
    expect(r?.order).toBeLessThan(2000)
  })

  test('dropping onto the first card places the card above everything', () => {
    const r = computeDrop(columns(), 'c', 'a')

    expect(r?.order).toBeLessThan(1000)
  })

  test('returns null for unknown ids or dropping on itself', () => {
    expect(computeDrop(columns(), 'ghost', 'col:s1')).toBeNull()
    expect(computeDrop(columns(), 'a', 'col:nope')).toBeNull()
    expect(computeDrop(columns(), 'a', 'a')).toBeNull()
    expect(computeDrop(columns(), 'a', 'unknown')).toBeNull()
  })
})
