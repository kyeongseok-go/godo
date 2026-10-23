import { describe, expect, it } from 'vitest'
import { INBOX_ID } from '../../domain/types'
import type { Task } from '../../domain/types'
import { makeTask } from '../../test/factories'
import { applyChangeSet, emptyEntityState } from '../../store/changes'
import type { ChangeSet, EntityState } from '../../store/changes'
import {
  archiveMessage,
  autoResolveDecision,
  currentTaskId,
  describeSummary,
  flowProgress,
  recordDecision,
  replanChangeSet,
  startFlow,
  summarizeFlow,
  undoDecision,
} from './flow'
import type { ReplanRecord } from './flow'

const TODAY = '2026-03-10'
const NOW = 1_800_000_000_000

const stateWith = (tasks: Task[]): EntityState =>
  applyChangeSet(emptyEntityState(), { puts: { tasks }, deletes: {} }).next
const run = (state: EntityState, cs: ChangeSet): EntityState => applyChangeSet(state, cs).next

const record = (taskId: string, decision: ReplanRecord['decision'], auto = false): ReplanRecord => ({
  taskId,
  decision,
  inverse: { puts: {}, deletes: {} },
  auto,
})

describe('flow reducer', () => {
  const a = makeTask({ id: 'a' })
  const b = makeTask({ id: 'b' })
  const c = makeTask({ id: 'c' })

  it('starts on the first candidate with 1 / total progress', () => {
    const flow = startFlow([a, b, c])
    expect(currentTaskId(flow)).toBe('a')
    expect(flowProgress(flow)).toEqual({ position: 1, total: 3, finished: false })
  })

  it('advances one card per recorded decision', () => {
    const flow = recordDecision(startFlow([a, b, c]), record('a', { type: 'done' }))
    expect(currentTaskId(flow)).toBe('b')
    expect(flowProgress(flow).position).toBe(2)
  })

  it('finishes after the last decision and keeps position clamped to total', () => {
    let flow = startFlow([a])
    flow = recordDecision(flow, record('a', { type: 'delete' }))
    expect(currentTaskId(flow)).toBeNull()
    expect(flowProgress(flow)).toEqual({ position: 1, total: 1, finished: true })
  })

  it('ignores a decision for a task that is not the current card', () => {
    const flow = startFlow([a, b])
    expect(recordDecision(flow, record('b', { type: 'done' }))).toBe(flow)
  })

  it('does not mutate the previous flow', () => {
    const flow = startFlow([a, b])
    recordDecision(flow, record('a', { type: 'done' }))
    expect(flow.records).toHaveLength(0)
  })

  it('reports an empty flow as finished', () => {
    const flow = startFlow([])
    expect(flowProgress(flow)).toEqual({ position: 0, total: 0, finished: true })
    expect(currentTaskId(flow)).toBeNull()
  })

  it('undo returns the last record and moves back one card', () => {
    const flow = recordDecision(startFlow([a, b]), record('a', { type: 'done' }))
    const result = undoDecision(flow)
    expect(result.record?.taskId).toBe('a')
    expect(currentTaskId(result.flow)).toBe('a')
  })

  it('undo on a fresh flow does nothing', () => {
    const flow = startFlow([a])
    expect(undoDecision(flow)).toEqual({ flow, record: null })
  })

  it('undo also drops automatic records that followed the real decision', () => {
    let flow = startFlow([a, b, c])
    flow = recordDecision(flow, record('a', { type: 'done' }))
    flow = recordDecision(flow, record('b', { type: 'done' }, true))
    const result = undoDecision(flow)
    expect(result.record?.taskId).toBe('a')
    expect(currentTaskId(result.flow)).toBe('a')
    expect(result.flow.records).toHaveLength(0)
  })
})

describe('summarizeFlow / describeSummary', () => {
  const tasks = ['1', '2', '3', '4', '5', '6', '7'].map((id) => makeTask({ id }))

  it('counts decisions by kind and tells today apart from other days', () => {
    let flow = startFlow(tasks)
    const decisions: ReplanRecord['decision'][] = [
      { type: 'reschedule', date: TODAY },
      { type: 'reschedule', date: '2026-03-12' },
      { type: 'inbox' },
      { type: 'done' },
      { type: 'someday' },
      { type: 'someday' },
      { type: 'delete' },
    ]
    decisions.forEach((d, i) => {
      flow = recordDecision(flow, record(tasks[i].id, d))
    })
    expect(summarizeFlow(flow, TODAY)).toEqual({
      total: 7,
      decided: 7,
      today: 1,
      otherDay: 1,
      inbox: 1,
      done: 1,
      someday: 2,
      deleted: 1,
    })
  })

  it('writes the summary sentence with only the non-zero kinds', () => {
    const text = describeSummary({
      total: 12,
      decided: 12,
      today: 4,
      otherDay: 0,
      inbox: 0,
      done: 0,
      someday: 5,
      deleted: 3,
    })
    expect(text).toBe('12개 중 오늘로 4, 언젠가 5, 삭제 3')
  })

  it('says nothing was sorted when no decision exists', () => {
    const text = describeSummary({
      total: 3,
      decided: 0,
      today: 0,
      otherDay: 0,
      inbox: 0,
      done: 0,
      someday: 0,
      deleted: 0,
    })
    expect(text).toBe('3개 중 아직 정리한 게 없어요')
  })
})

describe('replanChangeSet', () => {
  const base = (over: Partial<Task> = {}): Task =>
    makeTask({ id: 't', title: '보고서', startDate: '2026-03-05', projectId: 'work', sectionId: 's1', postponeCount: 1, ...over })

  it('reschedules to the chosen day and counts the postponement', () => {
    const state = stateWith([base()])
    const next = run(state, replanChangeSet(state, 't', { type: 'reschedule', date: TODAY }, TODAY, NOW))
    expect(next.tasks.t.startDate).toBe(TODAY)
    expect(next.tasks.t.postponeCount).toBe(2)
    expect(Object.values(next.activity)).toHaveLength(1)
  })

  it('moves the task and its subtasks to the inbox without a date', () => {
    const child = makeTask({ id: 'c', parentId: 't', projectId: 'work', startDate: '2026-03-05' })
    const state = stateWith([base(), child])
    const next = run(state, replanChangeSet(state, 't', { type: 'inbox' }, TODAY, NOW))
    expect(next.tasks.t).toMatchObject({ projectId: INBOX_ID, sectionId: null, startDate: null })
    expect(next.tasks.c.projectId).toBe(INBOX_ID)
  })

  it('detaches a subtask from its parent when sending it to the inbox', () => {
    const parent = makeTask({ id: 'p', projectId: 'work' })
    const state = stateWith([parent, base({ parentId: 'p' })])
    const next = run(state, replanChangeSet(state, 't', { type: 'inbox' }, TODAY, NOW))
    expect(next.tasks.t.parentId).toBeNull()
  })

  it('shelves as someday and clears the date', () => {
    const state = stateWith([base({ startTime: '09:00' })])
    const next = run(state, replanChangeSet(state, 't', { type: 'someday' }, TODAY, NOW))
    expect(next.tasks.t).toMatchObject({ someday: true, startDate: null, startTime: null })
  })

  it('completes through the shared completion command so recurrence advances', () => {
    const recurring = base({
      recurrence: { freq: 'daily', interval: 1, anchor: 'due', end: { type: 'never' }, resetSubtasks: false },
    })
    const state = stateWith([recurring])
    const next = run(state, replanChangeSet(state, 't', { type: 'done' }, TODAY, NOW))
    const open = Object.values(next.tasks).filter((t) => t.status === 'todo')
    const done = Object.values(next.tasks).filter((t) => t.status === 'done')
    expect(open).toHaveLength(1)
    expect(done).toHaveLength(1)
  })

  it('moves to the trash on delete', () => {
    const state = stateWith([base()])
    const next = run(state, replanChangeSet(state, 't', { type: 'delete' }, TODAY, NOW))
    expect(next.tasks.t.deletedAt).toBe(NOW)
  })

  it('returns an empty change set for an unknown task', () => {
    const cs = replanChangeSet(emptyEntityState(), 'nope', { type: 'done' }, TODAY, NOW)
    expect(cs).toEqual({ puts: {}, deletes: {} })
  })

  it('produces an inverse that restores the original task', () => {
    const state = stateWith([base()])
    const cs = replanChangeSet(state, 't', { type: 'reschedule', date: TODAY }, TODAY, NOW)
    const { next, inverse } = applyChangeSet(state, cs)
    expect(applyChangeSet(next, inverse).next.tasks.t).toEqual(state.tasks.t)
  })
})

describe('autoResolveDecision', () => {
  it('returns null while the task is still open', () => {
    expect(autoResolveDecision(makeTask())).toBeNull()
  })

  it('treats a vanished or trashed task as deleted', () => {
    expect(autoResolveDecision(undefined)).toEqual({ type: 'delete' })
    expect(autoResolveDecision(makeTask({ deletedAt: 1 }))).toEqual({ type: 'delete' })
  })

  it('treats finished tasks as done and canceled ones as deleted', () => {
    expect(autoResolveDecision(makeTask({ status: 'done' }))).toEqual({ type: 'done' })
    expect(autoResolveDecision(makeTask({ status: 'canceled' }))).toEqual({ type: 'delete' })
  })
})

describe('archiveMessage', () => {
  it('is null when no archive suggestion applies', () => {
    const task = makeTask({ startDate: '2026-03-09' })
    expect(archiveMessage(task, TODAY, 7)).toBeNull()
  })

  it('names how many days the task has been stuck', () => {
    const task = makeTask({ startDate: '2026-02-28' })
    expect(archiveMessage(task, TODAY, 7)).toBe('10일째 못 하고 있어요. 보관할까요?')
  })

  it('names the postpone count when the days are few but it was pushed back often', () => {
    const task = makeTask({ startDate: '2026-03-09', postponeCount: 6 })
    expect(archiveMessage(task, TODAY, 7)).toBe('6번째 미루고 있어요. 보관할까요?')
  })
})
