import { makeTask } from '../../test/factories'
import { buildTaskTree, countDescendants } from './tree'
import type { TaskNode } from './types'

const shape = (nodes: readonly TaskNode[]): unknown[] =>
  nodes.map((n) => (n.children.length ? [n.task.id, shape(n.children)] : n.task.id))

describe('buildTaskTree', () => {
  test('returns an empty array for empty input', () => {
    expect(buildTaskTree([])).toEqual([])
  })

  test('nests children under their parent with depth', () => {
    const root = makeTask({ id: 'root' })
    const child = makeTask({ id: 'child', parentId: 'root' })
    const grand = makeTask({ id: 'grand', parentId: 'child' })
    const tree = buildTaskTree([grand, child, root])
    expect(shape(tree)).toEqual([['root', [['child', ['grand']]]]])
    expect(tree[0].depth).toBe(0)
    expect(tree[0].children[0].depth).toBe(1)
    expect(tree[0].children[0].children[0].depth).toBe(2)
  })

  test('orders siblings by order and keeps input order for ties', () => {
    const a = makeTask({ id: 'a', order: 30 })
    const b = makeTask({ id: 'b', order: 10 })
    const c = makeTask({ id: 'c', order: 10 })
    const k1 = makeTask({ id: 'k1', parentId: 'a', order: 2 })
    const k2 = makeTask({ id: 'k2', parentId: 'a', order: 1 })
    expect(shape(buildTaskTree([a, b, c, k1, k2]))).toEqual(['b', 'c', ['a', ['k2', 'k1']]])
  })

  test('promotes a task to the top level when its parent is not in the list', () => {
    const orphan = makeTask({ id: 'orphan', parentId: 'missing' })
    const kid = makeTask({ id: 'kid', parentId: 'orphan' })
    const tree = buildTaskTree([orphan, kid])
    expect(shape(tree)).toEqual([['orphan', ['kid']]])
    expect(tree[0].depth).toBe(0)
  })

  test('treats a self-parented task as a root without looping forever', () => {
    const self = makeTask({ id: 'self', parentId: 'self' })
    const tree = buildTaskTree([self])
    expect(shape(tree)).toEqual(['self'])
  })

  test('survives a two-task cycle and keeps every task exactly once', () => {
    const a = makeTask({ id: 'a', parentId: 'b', order: 1 })
    const b = makeTask({ id: 'b', parentId: 'a', order: 2 })
    const tree = buildTaskTree([a, b])
    expect(shape(tree)).toEqual([['a', ['b']]])
  })

  test('keeps descendants hanging off a cycle', () => {
    const a = makeTask({ id: 'a', parentId: 'c', order: 1 })
    const b = makeTask({ id: 'b', parentId: 'a', order: 1 })
    const c = makeTask({ id: 'c', parentId: 'b', order: 1 })
    const tail = makeTask({ id: 'tail', parentId: 'c' })
    const tree = buildTaskTree([a, b, c, tail])
    const seen: string[] = []
    const walk = (nodes: readonly TaskNode[]): void =>
      nodes.forEach((n) => {
        seen.push(n.task.id)
        walk(n.children)
      })
    walk(tree)
    expect(seen.sort()).toEqual(['a', 'b', 'c', 'tail'])
  })

  test('does not mutate the input tasks', () => {
    const a = makeTask({ id: 'a' })
    const b = makeTask({ id: 'b', parentId: 'a' })
    const snapshot = JSON.stringify([a, b])
    buildTaskTree([a, b])
    expect(JSON.stringify([a, b])).toBe(snapshot)
  })

  test('ignores a repeated id after its first occurrence', () => {
    const first = makeTask({ id: 'dup', title: '첫째' })
    const second = makeTask({ id: 'dup', title: '둘째' })
    const tree = buildTaskTree([first, second])
    expect(tree).toHaveLength(1)
    expect(tree[0].task.title).toBe('첫째')
  })
})

describe('countDescendants', () => {
  test('counts nested descendants and finished ones, excluding the node itself', () => {
    const root = makeTask({ id: 'root', status: 'done' })
    const k1 = makeTask({ id: 'k1', parentId: 'root', status: 'done' })
    const k2 = makeTask({ id: 'k2', parentId: 'root', status: 'todo' })
    const g1 = makeTask({ id: 'g1', parentId: 'k2', status: 'done' })
    const g2 = makeTask({ id: 'g2', parentId: 'k2', status: 'canceled' })
    const [node] = buildTaskTree([root, k1, k2, g1, g2])
    expect(countDescendants(node)).toEqual({ total: 4, done: 2 })
  })

  test('returns zeros for a leaf', () => {
    const [node] = buildTaskTree([makeTask({ id: 'solo' })])
    expect(countDescendants(node)).toEqual({ total: 0, done: 0 })
  })
})
