import { describe, expect, it } from 'vitest'
import { INBOX_ID } from '../../domain/types'
import type { Task } from '../../domain/types'
import { makeTask } from '../../test/factories'
import { applyChangeSet, emptyEntityState } from '../../store/changes'
import type { ChangeSet, EntityState } from '../../store/changes'
import { triageChangeSet } from './commands'

const TODAY = '2026-03-10'
const NOW = 1_800_000_000_000

const stateWith = (tasks: Task[]): EntityState =>
  applyChangeSet(emptyEntityState(), { puts: { tasks }, deletes: {} }).next
const run = (state: EntityState, cs: ChangeSet): EntityState => applyChangeSet(state, cs).next

describe('triageChangeSet', () => {
  const inboxTask = makeTask({ id: 't', title: '메모', projectId: INBOX_ID, sectionId: null })

  it('moves to the chosen project and keeps the task undated when no date is picked', () => {
    const state = stateWith([inboxTask])
    const next = run(state, triageChangeSet(state, 't', { type: 'accept', projectId: 'work', date: null }, TODAY, NOW))
    expect(next.tasks.t).toMatchObject({ projectId: 'work', startDate: null })
  })

  it('moves and schedules at once when a date is picked', () => {
    const state = stateWith([inboxTask])
    const next = run(state, triageChangeSet(state, 't', { type: 'accept', projectId: 'work', date: '2026-03-12' }, TODAY, NOW))
    expect(next.tasks.t).toMatchObject({ projectId: 'work', startDate: '2026-03-12' })
  })

  it('moves the subtasks along with the parent', () => {
    const child = makeTask({ id: 'c', parentId: 't', projectId: INBOX_ID })
    const state = stateWith([inboxTask, child])
    const next = run(state, triageChangeSet(state, 't', { type: 'accept', projectId: 'work', date: null }, TODAY, NOW))
    expect(next.tasks.c.projectId).toBe('work')
  })

  it('schedules for today or tomorrow without leaving the inbox', () => {
    const state = stateWith([inboxTask])
    const today = run(state, triageChangeSet(state, 't', { type: 'today' }, TODAY, NOW))
    expect(today.tasks.t).toMatchObject({ startDate: TODAY, projectId: INBOX_ID })
    const tomorrow = run(state, triageChangeSet(state, 't', { type: 'tomorrow' }, TODAY, NOW))
    expect(tomorrow.tasks.t.startDate).toBe('2026-03-11')
  })

  it('does not count scheduling a fresh inbox item as a postponement', () => {
    const state = stateWith([inboxTask])
    const next = run(state, triageChangeSet(state, 't', { type: 'tomorrow' }, TODAY, NOW))
    expect(next.tasks.t.postponeCount).toBe(0)
  })

  it('shelves as someday and sends to the trash', () => {
    const state = stateWith([inboxTask])
    expect(run(state, triageChangeSet(state, 't', { type: 'someday' }, TODAY, NOW)).tasks.t.someday).toBe(true)
    expect(run(state, triageChangeSet(state, 't', { type: 'delete' }, TODAY, NOW)).tasks.t.deletedAt).toBe(NOW)
  })

  it('changes nothing on skip or for an unknown task', () => {
    const state = stateWith([inboxTask])
    expect(triageChangeSet(state, 't', { type: 'skip' }, TODAY, NOW)).toEqual({ puts: {}, deletes: {} })
    expect(triageChangeSet(state, 'nope', { type: 'today' }, TODAY, NOW)).toEqual({ puts: {}, deletes: {} })
  })
})
