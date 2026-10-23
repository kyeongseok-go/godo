import { makeLabel, makeTask } from '../test/factories'
import {
  applyChangeSet,
  emptyEntityState,
  isEmptyChangeSet,
  mergeChangeSets,
  type ChangeSet,
} from './changes'

describe('applyChangeSet', () => {
  test('adds new entities without mutating the previous state', () => {
    const before = emptyEntityState()
    const task = makeTask({ id: 'a' })

    const { next } = applyChangeSet(before, { puts: { tasks: [task] }, deletes: {} })

    expect(next.tasks.a).toEqual(task)
    expect(before.tasks).toEqual({})
    expect(next.projects).toBe(before.projects)
  })

  test('inverse of an insert deletes the entity', () => {
    const task = makeTask({ id: 'a' })
    const { next, inverse } = applyChangeSet(emptyEntityState(), { puts: { tasks: [task] }, deletes: {} })

    const { next: undone } = applyChangeSet(next, inverse)

    expect(undone.tasks).toEqual({})
  })

  test('inverse of an update restores the previous version', () => {
    const original = makeTask({ id: 'a', title: '원래' })
    const base = applyChangeSet(emptyEntityState(), { puts: { tasks: [original] }, deletes: {} }).next

    const { next, inverse } = applyChangeSet(base, { puts: { tasks: [{ ...original, title: '수정' }] }, deletes: {} })
    expect(next.tasks.a.title).toBe('수정')

    const restored = applyChangeSet(next, inverse).next
    expect(restored.tasks.a.title).toBe('원래')
  })

  test('inverse of a delete brings the entity back', () => {
    const task = makeTask({ id: 'a' })
    const base = applyChangeSet(emptyEntityState(), { puts: { tasks: [task] }, deletes: {} }).next

    const { next, inverse } = applyChangeSet(base, { puts: {}, deletes: { tasks: ['a'] } })
    expect(next.tasks.a).toBeUndefined()

    expect(applyChangeSet(next, inverse).next.tasks.a).toEqual(task)
  })

  test('deleting an unknown id is a harmless no-op', () => {
    const { next, inverse } = applyChangeSet(emptyEntityState(), { puts: {}, deletes: { tasks: ['ghost'] } })

    expect(next.tasks).toEqual({})
    expect(isEmptyChangeSet(inverse)).toBe(true)
  })

  test('keys day plans by date', () => {
    const plan = { date: '2026-10-23', capacityMin: null, highlightIds: [], morningDoneAt: null, eveningDoneAt: null, reflection: '' }

    const { next } = applyChangeSet(emptyEntityState(), { puts: { dayPlans: [plan] }, deletes: {} })

    expect(next.dayPlans['2026-10-23']).toEqual(plan)
  })
})

describe('mergeChangeSets', () => {
  test('the later put of the same key wins', () => {
    const a: ChangeSet = { puts: { labels: [makeLabel({ id: 'x', name: '1' })] }, deletes: {} }
    const b: ChangeSet = { puts: { labels: [makeLabel({ id: 'x', name: '2' })] }, deletes: {} }

    const merged = mergeChangeSets(a, b)

    expect(merged.puts.labels).toHaveLength(1)
    expect(merged.puts.labels?.[0].name).toBe('2')
  })

  test('a delete after a put cancels the put', () => {
    const put: ChangeSet = { puts: { labels: [makeLabel({ id: 'x' })] }, deletes: {} }
    const del: ChangeSet = { puts: {}, deletes: { labels: ['x'] } }

    const merged = mergeChangeSets(put, del)

    expect(merged.puts.labels).toBeUndefined()
    expect(merged.deletes.labels).toEqual(['x'])
  })

  test('a put after a delete cancels the delete', () => {
    const del: ChangeSet = { puts: {}, deletes: { labels: ['x'] } }
    const put: ChangeSet = { puts: { labels: [makeLabel({ id: 'x' })] }, deletes: {} }

    const merged = mergeChangeSets(del, put)

    expect(merged.deletes.labels).toBeUndefined()
    expect(merged.puts.labels).toHaveLength(1)
  })
})
