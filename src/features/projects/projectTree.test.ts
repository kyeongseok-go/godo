import { INBOX_ID } from '../../domain/types'
import { makeProject } from '../../test/factories'
import { buildProjectTree, flattenProjectTree, projectSubtreeIds } from './projectTree'

describe('buildProjectTree', () => {
  test('nests children under their folder and sorts by order', () => {
    const folder = makeProject({ id: 'f', name: '업무', isFolder: true, order: 1 })
    const a = makeProject({ id: 'a', name: 'A', parentId: 'f', order: 2 })
    const b = makeProject({ id: 'b', name: 'B', parentId: 'f', order: 1 })
    const solo = makeProject({ id: 's', name: '개인', order: 0 })

    const tree = buildProjectTree([folder, a, b, solo])

    expect(tree.map((n) => n.project.id)).toEqual(['s', 'f'])
    expect(tree[1].children.map((n) => n.project.id)).toEqual(['b', 'a'])
    expect(tree[1].children[0].depth).toBe(1)
  })

  test('hides the inbox, archived, and deleted projects', () => {
    const projects = [
      makeProject({ id: INBOX_ID }),
      makeProject({ id: 'arch', archived: true }),
      makeProject({ id: 'del', deletedAt: 5 }),
      makeProject({ id: 'ok' }),
    ]

    expect(buildProjectTree(projects).map((n) => n.project.id)).toEqual(['ok'])
    expect(buildProjectTree(projects, { includeArchived: true }).map((n) => n.project.id)).toEqual(['arch', 'ok'])
  })

  test('promotes projects whose parent is missing to the top level', () => {
    const orphan = makeProject({ id: 'o', parentId: 'ghost' })

    expect(buildProjectTree([orphan]).map((n) => n.project.id)).toEqual(['o'])
  })

  test('survives a parent cycle without looping', () => {
    const a = makeProject({ id: 'a', parentId: 'b' })
    const b = makeProject({ id: 'b', parentId: 'a' })

    expect(() => buildProjectTree([a, b])).not.toThrow()
  })
})

describe('projectSubtreeIds', () => {
  test('collects the root and every descendant', () => {
    const projects = [
      makeProject({ id: 'r' }),
      makeProject({ id: 'c1', parentId: 'r' }),
      makeProject({ id: 'c2', parentId: 'c1' }),
      makeProject({ id: 'x' }),
    ]

    expect(projectSubtreeIds(projects, 'r').sort()).toEqual(['c1', 'c2', 'r'])
  })
})

describe('flattenProjectTree', () => {
  test('returns parents before their children', () => {
    const tree = buildProjectTree([makeProject({ id: 'p' }), makeProject({ id: 'c', parentId: 'p' })])

    expect(flattenProjectTree(tree).map((n) => n.project.id)).toEqual(['p', 'c'])
  })
})
