import { INBOX_ID } from '../../domain/types'
import type { RecurrenceRule } from '../../domain/types'
import { makeSection, makeTask } from '../../test/factories'
import { applyChangeSet, emptyEntityState } from '../changes'
import type { ChangeSet, EntityState } from '../changes'
import {
  cancelTask,
  completeTask,
  createTask,
  deleteTasks,
  emptyTrash,
  duplicateTask,
  indentTask,
  moveTask,
  outdentTask,
  patchTask,
  patchTasks,
  postponeTask,
  purgeExpiredTrash,
  purgeTasks,
  reopenTask,
  restoreTask,
} from './taskCommands'
import type { Task } from '../../domain/types'

const NOW = 5_000
const TODAY = '2026-10-23'

const stateWith = (tasks: Task[], extra: ChangeSet['puts'] = {}): EntityState =>
  applyChangeSet(emptyEntityState(), { puts: { tasks, ...extra }, deletes: {} }).next
const run = (state: EntityState, cs: ChangeSet): EntityState => applyChangeSet(state, cs).next

const weekly: RecurrenceRule = { freq: 'weekly', interval: 1, byWeekday: [5], anchor: 'due', end: { type: 'never' }, resetSubtasks: false }

describe('createTask', () => {
  test('defaults to the inbox and appends after existing siblings', () => {
    const state = stateWith([makeTask({ id: 'a', order: 3000 })])

    const { task, changes } = createTask(state, { title: '  새 일  ' }, NOW)

    expect(task.projectId).toBe(INBOX_ID)
    expect(task.title).toBe('새 일')
    expect(task.order).toBe(4000)
    expect(changes.puts.activity).toHaveLength(1)
  })
})

describe('patchTask', () => {
  test('stamps updatedAt and leaves other fields alone', () => {
    const state = stateWith([makeTask({ id: 'a', title: 'x', priority: 2 })])

    const next = run(state, patchTask(state, 'a', { title: 'y' }, NOW))

    expect(next.tasks.a).toMatchObject({ title: 'y', priority: 2, updatedAt: NOW })
  })

  test('moving to another project carries subtasks along and clears sections', () => {
    const state = stateWith([
      makeTask({ id: 'p', projectId: 'old', sectionId: 's1' }),
      makeTask({ id: 'c', projectId: 'old', parentId: 'p' }),
    ])

    const next = run(state, patchTask(state, 'p', { projectId: 'new' }, NOW))

    expect(next.tasks.p).toMatchObject({ projectId: 'new', sectionId: null })
    expect(next.tasks.c.projectId).toBe('new')
  })

  test('refuses to parent a task under its own descendant', () => {
    const state = stateWith([makeTask({ id: 'p' }), makeTask({ id: 'c', parentId: 'p' })])

    expect(patchTask(state, 'p', { parentId: 'c' }, NOW).puts.tasks).toBeUndefined()
  })

  test('ignores unknown ids', () => {
    expect(patchTask(emptyEntityState(), 'ghost', { title: 'x' }, NOW).puts.tasks).toBeUndefined()
  })
})

describe('patchTasks', () => {
  test('moving a parent and its child together to another project moves each exactly once', () => {
    const state = stateWith([makeTask({ id: 'p', projectId: 'a' }), makeTask({ id: 'c', parentId: 'p', projectId: 'a' })])

    const next = run(state, patchTasks(state, ['p', 'c'], { projectId: 'b' }, NOW))

    expect(next.tasks.p.projectId).toBe('b')
    expect(next.tasks.c.projectId).toBe('b')
  })

  test('refuses a parent change that would create a cycle but still patches the other ids', () => {
    const state = stateWith([makeTask({ id: 'p' }), makeTask({ id: 'c', parentId: 'p' }), makeTask({ id: 'x' })])

    const next = run(state, patchTasks(state, ['p', 'x'], { parentId: 'c' }, NOW))

    expect(next.tasks.p.parentId).toBeNull()
    expect(next.tasks.x.parentId).toBe('c')
  })

  test('returns no changes for an empty id list', () => {
    expect(patchTasks(stateWith([makeTask({ id: 'p' })]), [], { priority: 1 }, NOW)).toEqual({ puts: {}, deletes: {} })
  })
})

describe('completeTask', () => {
  test('marks a plain task and its open subtasks done', () => {
    const state = stateWith([
      makeTask({ id: 'p' }),
      makeTask({ id: 'c1', parentId: 'p' }),
      makeTask({ id: 'c2', parentId: 'p', status: 'canceled' }),
    ])

    const next = run(state, completeTask(state, 'p', TODAY, NOW))

    expect(next.tasks.p).toMatchObject({ status: 'done', completedAt: NOW })
    expect(next.tasks.c1.status).toBe('done')
    expect(next.tasks.c2.status).toBe('canceled')
  })

  test('a recurring task advances in place and leaves a completed record behind', () => {
    const state = stateWith([makeTask({ id: 'r', title: '운동', startDate: '2026-10-23', recurrence: weekly })])

    const next = run(state, completeTask(state, 'r', TODAY, NOW))

    expect(next.tasks.r.status).toBe('todo')
    expect(next.tasks.r.startDate).toBe('2026-10-30')
    const records = Object.values(next.tasks).filter((t) => t.id !== 'r')
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ title: '운동', status: 'done', recurrence: null, completedAt: NOW })
  })

  test('a recurring series that has ended completes normally', () => {
    const ended: RecurrenceRule = { ...weekly, end: { type: 'count', count: 1 } }
    const state = stateWith([makeTask({ id: 'r', startDate: '2026-10-23', recurrence: ended })])

    const next = run(state, completeTask(state, 'r', TODAY, NOW))

    expect(next.tasks.r.status).toBe('done')
  })

  test('resetSubtasks reopens children when a recurring parent advances', () => {
    const rule: RecurrenceRule = { ...weekly, resetSubtasks: true }
    const state = stateWith([
      makeTask({ id: 'r', startDate: '2026-10-23', recurrence: rule }),
      makeTask({ id: 'c', parentId: 'r', status: 'done', completedAt: 1 }),
    ])

    const next = run(state, completeTask(state, 'r', TODAY, NOW))

    expect(next.tasks.c.status).toBe('todo')
    expect(next.tasks.c.completedAt).toBeNull()
  })

  test('completing an already completed task is a no-op', () => {
    const state = stateWith([makeTask({ id: 'a', status: 'done' })])

    expect(completeTask(state, 'a', TODAY, NOW).puts.tasks).toBeUndefined()
  })
})

describe('reopen and cancel', () => {
  test('reopenTask clears completion', () => {
    const state = stateWith([makeTask({ id: 'a', status: 'done', completedAt: 9 })])

    const next = run(state, reopenTask(state, 'a', NOW))

    expect(next.tasks.a).toMatchObject({ status: 'todo', completedAt: null })
  })

  test('cancelTask cancels open subtasks too', () => {
    const state = stateWith([makeTask({ id: 'p' }), makeTask({ id: 'c', parentId: 'p' })])

    const next = run(state, cancelTask(state, 'p', NOW))

    expect(next.tasks.p.status).toBe('canceled')
    expect(next.tasks.c.status).toBe('canceled')
  })
})

describe('delete, restore, purge', () => {
  const family = () => stateWith([makeTask({ id: 'p' }), makeTask({ id: 'c', parentId: 'p' }), makeTask({ id: 'x' })])

  test('deleteTasks soft-deletes the whole subtree only', () => {
    const state = family()

    const next = run(state, deleteTasks(state, ['p'], NOW))

    expect(next.tasks.p.deletedAt).toBe(NOW)
    expect(next.tasks.c.deletedAt).toBe(NOW)
    expect(next.tasks.x.deletedAt).toBeNull()
  })

  test('restoreTask brings the subtree back', () => {
    const state = family()
    const trashed = run(state, deleteTasks(state, ['p'], NOW))

    const next = run(trashed, restoreTask(trashed, 'p', NOW + 1))

    expect(next.tasks.p.deletedAt).toBeNull()
    expect(next.tasks.c.deletedAt).toBeNull()
  })

  test('restoring a child whose parent is still trashed lifts it to the top level', () => {
    const state = family()
    const trashed = run(state, deleteTasks(state, ['p'], NOW))

    const next = run(trashed, restoreTask(trashed, 'c', NOW + 1))

    expect(next.tasks.c.deletedAt).toBeNull()
    expect(next.tasks.c.parentId).toBeNull()
  })

  test('purgeTasks removes tasks, descendants and their comments for good', () => {
    const state = stateWith([makeTask({ id: 'p' }), makeTask({ id: 'c', parentId: 'p' })], {
      comments: [{ id: 'm', taskId: 'c', body: '메모', createdAt: 1 }],
    })

    const next = run(state, purgeTasks(state, ['p']))

    expect(next.tasks).toEqual({})
    expect(next.comments).toEqual({})
  })
})

describe('bulk delete and purge', () => {
  const DAY = 86_400_000

  test('deleteTasks counts a task once when both the parent and its child are selected', () => {
    const state = stateWith([makeTask({ id: 'p' }), makeTask({ id: 'c', parentId: 'p' }), makeTask({ id: 'x' })])

    const changes = deleteTasks(state, ['p', 'c', 'ghost'], NOW)

    expect(changes.puts.tasks?.map((t) => t.id).sort()).toEqual(['c', 'p'])
  })

  test('deleteTasks does nothing for an empty selection', () => {
    expect(deleteTasks(stateWith([makeTask({ id: 'p' })]), [], NOW)).toEqual({ puts: {}, deletes: {} })
  })

  test('emptyTrash purges trashed trees and leaves live tasks alone', () => {
    const state = stateWith([
      makeTask({ id: 'p', deletedAt: 1 }),
      makeTask({ id: 'c', parentId: 'p', deletedAt: 1 }),
      makeTask({ id: 'live' }),
    ])

    const next = run(state, emptyTrash(state))

    expect(Object.keys(next.tasks)).toEqual(['live'])
  })

  test('emptyTrash on a state without trash is a no-op', () => {
    expect(emptyTrash(stateWith([makeTask({ id: 'live' })]))).toEqual({ puts: {}, deletes: {} })
  })

  test('purgeExpiredTrash only removes items trashed longer than the keep window', () => {
    const state = stateWith([
      makeTask({ id: 'old', deletedAt: NOW }),
      makeTask({ id: 'old-kid', parentId: 'old', deletedAt: NOW }),
      makeTask({ id: 'recent', deletedAt: NOW + 29 * DAY }),
    ])

    const next = run(state, purgeExpiredTrash(state, NOW + 31 * DAY))

    expect(Object.keys(next.tasks)).toEqual(['recent'])
  })
})

describe('duplicateTask', () => {
  test('copies the subtree with new ids, reset status, and a remapped parent chain', () => {
    const state = stateWith([
      makeTask({ id: 'p', title: '부모', status: 'done', postponeCount: 3, order: 1000 }),
      makeTask({ id: 'c', title: '자식', parentId: 'p' }),
    ])

    const { changes, newId } = duplicateTask(state, 'p', NOW)
    const next = run(state, changes)

    const copies = Object.values(next.tasks).filter((t) => t.id !== 'p' && t.id !== 'c')
    expect(copies).toHaveLength(2)
    const parent = next.tasks[newId as string]
    expect(parent).toMatchObject({ title: '부모', status: 'todo', postponeCount: 0 })
    const child = copies.find((t) => t.title === '자식')
    expect(child?.parentId).toBe(newId)
  })
})

describe('moveTask', () => {
  test('moving into a section with a category updates the status', () => {
    const state = stateWith([makeTask({ id: 'a', projectId: 'p' })], {
      sections: [makeSection({ id: 's', projectId: 'p', category: 'done' })],
    })

    const next = run(state, moveTask(state, 'a', { projectId: 'p', sectionId: 's', parentId: null, order: 10 }, NOW))

    expect(next.tasks.a).toMatchObject({ sectionId: 's', status: 'done', completedAt: NOW, order: 10 })
  })

  test('refuses to move a task under its own child', () => {
    const state = stateWith([makeTask({ id: 'p' }), makeTask({ id: 'c', parentId: 'p' })])

    expect(moveTask(state, 'p', { projectId: INBOX_ID, sectionId: null, parentId: 'c' }, NOW).puts.tasks).toBeUndefined()
  })
})

describe('postponeTask', () => {
  test('moves the start date and counts the postponement', () => {
    const state = stateWith([makeTask({ id: 'a', startDate: '2026-10-20', postponeCount: 1 })])

    const next = run(state, postponeTask(state, 'a', '2026-10-24', NOW))

    expect(next.tasks.a).toMatchObject({ startDate: '2026-10-24', postponeCount: 2 })
  })
})

describe('indentTask and outdentTask', () => {
  test('indent makes the task a child of the previous sibling', () => {
    const state = stateWith([makeTask({ id: 'a', order: 1000 }), makeTask({ id: 'b', order: 2000 })])

    const next = run(state, indentTask(state, 'b', NOW))

    expect(next.tasks.b.parentId).toBe('a')
  })

  test('indent does nothing for the first sibling', () => {
    const state = stateWith([makeTask({ id: 'a', order: 1000 }), makeTask({ id: 'b', order: 2000 })])

    expect(indentTask(state, 'a', NOW).puts.tasks).toBeUndefined()
  })

  test('indent skips completed siblings when choosing the new parent', () => {
    const state = stateWith([
      makeTask({ id: 'a', order: 1000 }),
      makeTask({ id: 'x', order: 1500, status: 'done' }),
      makeTask({ id: 'b', order: 2000 }),
    ])

    expect(run(state, indentTask(state, 'b', NOW)).tasks.b.parentId).toBe('a')
  })

  test('outdent lifts the task out and places it right after its former parent', () => {
    const state = stateWith([
      makeTask({ id: 'p', order: 1000 }),
      makeTask({ id: 'c', parentId: 'p', order: 1000 }),
      makeTask({ id: 'q', order: 2000 }),
    ])

    const next = run(state, outdentTask(state, 'c', NOW))

    expect(next.tasks.c.parentId).toBeNull()
    expect(next.tasks.c.order).toBeGreaterThan(1000)
    expect(next.tasks.c.order).toBeLessThan(2000)
  })

  test('outdent does nothing for top-level tasks', () => {
    const state = stateWith([makeTask({ id: 'a' })])

    expect(outdentTask(state, 'a', NOW).puts.tasks).toBeUndefined()
  })
})
