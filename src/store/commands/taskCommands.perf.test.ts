import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeBulkState, makeBulkTasks } from '../../test/bulk'
import { makeProject } from '../../test/factories'
import { deleteProject } from './entityCommands'
import { deleteTasks, emptyTrash, patchTasks, purgeExpiredTrash, purgeTasks } from './taskCommands'
import { childrenIndex } from './taskTree'

// 자식 색인 생성 횟수를 세려고 childrenIndex 를 감싼다(동작은 그대로).
vi.mock('./taskTree', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./taskTree')>()
  return { ...actual, childrenIndex: vi.fn(actual.childrenIndex) }
})

const BULK = 10_000
const TRASHED = 3_000
const SELECTED = 1_000
const NOW = 100 * 86_400_000
// 이전 구현은 휴지통 3천 개 비우기 약 8~11초, 1천 개 삭제 약 2.6~3초. 느린 환경에서도 흔들리지 않게 넉넉히 잡는다.
const BUDGET_MS = 2_000

const trashedState = () => {
  const tasks = makeBulkTasks(BULK).map((t, i) => (i < TRASHED ? { ...t, deletedAt: 1 } : t))
  return makeBulkState(tasks)
}

describe('bulk task commands', () => {
  beforeEach(() => {
    vi.mocked(childrenIndex).mockClear()
  })

  it('emptyTrash builds the children index once and stays within the budget', () => {
    const state = trashedState()
    const started = performance.now()

    const changes = emptyTrash(state)

    expect(performance.now() - started).toBeLessThan(BUDGET_MS)
    expect(childrenIndex).toHaveBeenCalledTimes(1)
    expect(changes.deletes.tasks).toHaveLength(TRASHED)
  })

  it('purgeExpiredTrash builds the children index once', () => {
    const state = trashedState()

    const changes = purgeExpiredTrash(state, NOW)

    expect(childrenIndex).toHaveBeenCalledTimes(1)
    expect(changes.deletes.tasks).toHaveLength(TRASHED)
  })

  it('purgeTasks builds the children index once for many ids', () => {
    const state = trashedState()

    purgeTasks(state, Object.keys(state.tasks).slice(0, SELECTED))

    expect(childrenIndex).toHaveBeenCalledTimes(1)
  })

  it('deleteTasks builds the children index once and stays within the budget', () => {
    const state = makeBulkState(makeBulkTasks(BULK))
    const ids = Object.keys(state.tasks).slice(0, SELECTED)
    const started = performance.now()

    const changes = deleteTasks(state, ids, NOW)

    expect(performance.now() - started).toBeLessThan(BUDGET_MS)
    expect(childrenIndex).toHaveBeenCalledTimes(1)
    expect(changes.puts.tasks?.length).toBeGreaterThanOrEqual(SELECTED)
  })

  it('deleteProject sends every task of a large project to the trash with one index', () => {
    const state = makeBulkState(makeBulkTasks(BULK))
    const started = performance.now()

    const changes = deleteProject({ ...state, projects: { p0: makeProject({ id: 'p0' }) } }, 'p0', NOW)

    expect(performance.now() - started).toBeLessThan(BUDGET_MS)
    expect(childrenIndex).toHaveBeenCalledTimes(1)
    expect(changes.puts.tasks?.length).toBeGreaterThan(0)
  })

  it('patchTasks moving many tasks to another project builds the children index once', () => {
    const state = makeBulkState(makeBulkTasks(BULK))
    const ids = Object.keys(state.tasks).slice(0, SELECTED)
    const started = performance.now()

    const changes = patchTasks(state, ids, { projectId: 'p-target' }, NOW)

    expect(performance.now() - started).toBeLessThan(BUDGET_MS)
    expect(childrenIndex).toHaveBeenCalledTimes(1)
    expect(changes.puts.tasks?.length).toBeGreaterThanOrEqual(SELECTED)
  })

  it('patchTasks that does not touch project or parent never builds the index', () => {
    const state = makeBulkState(makeBulkTasks(BULK))

    patchTasks(state, Object.keys(state.tasks).slice(0, SELECTED), { priority: 1 }, NOW)

    expect(childrenIndex).not.toHaveBeenCalled()
  })
})
