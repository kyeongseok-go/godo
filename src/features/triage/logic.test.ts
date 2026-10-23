import { describe, expect, it } from 'vitest'
import { INBOX_ID } from '../../domain/types'
import type { EngineContext, Task } from '../../domain/types'
import { makeProject, makeTask } from '../../test/factories'
import { startDecisionFlow, recordDecision } from '../replan/decisionFlow'
import { describeTriageSummary, projectChoices, quickDates, summarizeTriage, triageQueue } from './logic'
import type { TriageDecision, TriageRecord } from './logic'

const TODAY = '2026-03-10'

function ctxOf(tasks: Task[]): EngineContext {
  return { today: TODAY, now: new Date(2026, 2, 10, 9, 0), weekStartsOn: 1, projects: [], sections: [], labels: [], tasks }
}

describe('triageQueue', () => {
  it('lists open, undated, top-level inbox tasks in manual order', () => {
    const second = makeTask({ id: 'second', order: 2000 })
    const first = makeTask({ id: 'first', order: 1000 })
    const queue = triageQueue(ctxOf([second, first]))
    expect(queue.map((t) => t.id)).toEqual(['first', 'second'])
  })

  it('leaves out dated, someday, finished, deleted, subtasks and other projects', () => {
    const parent = makeTask({ id: 'parent' })
    const tasks = [
      parent,
      makeTask({ startDate: TODAY }),
      makeTask({ someday: true }),
      makeTask({ status: 'done' }),
      makeTask({ deletedAt: 5 }),
      makeTask({ parentId: 'parent' }),
      makeTask({ projectId: 'work' }),
    ]
    expect(triageQueue(ctxOf(tasks)).map((t) => t.id)).toEqual(['parent'])
  })

  it('only looks at the inbox project', () => {
    const task = makeTask({ projectId: INBOX_ID })
    expect(triageQueue(ctxOf([task]))).toHaveLength(1)
  })
})

describe('projectChoices', () => {
  it('numbers up to nine real projects, favorites first, then by order', () => {
    const projects = [
      makeProject({ id: INBOX_ID, name: '받은편지함' }),
      makeProject({ id: 'b', order: 2 }),
      makeProject({ id: 'a', order: 1 }),
      makeProject({ id: 'fav', order: 9, favorite: true }),
      makeProject({ id: 'folder', isFolder: true, order: 0 }),
      makeProject({ id: 'old', archived: true, order: 0 }),
      makeProject({ id: 'gone', deletedAt: 1, order: 0 }),
    ]
    const choices = projectChoices(projects)
    expect(choices.map((p) => p.id)).toEqual(['fav', 'a', 'b'])
  })

  it('caps the quick list at nine', () => {
    const projects = Array.from({ length: 12 }, (_, i) => makeProject({ id: `p${i}`, order: i }))
    expect(projectChoices(projects)).toHaveLength(9)
  })
})

describe('quickDates', () => {
  it('offers today, tomorrow and next week start', () => {
    const dates = quickDates(TODAY, 1)
    expect(dates.map((d) => d.key)).toEqual(['t', 'm', 'w'])
    expect(dates.map((d) => d.date)).toEqual(['2026-03-10', '2026-03-11', '2026-03-16'])
  })
})

describe('triage summary', () => {
  const tasks = ['1', '2', '3', '4', '5', '6'].map((id) => makeTask({ id }))
  const empty = { puts: {}, deletes: {} }
  const rec = (taskId: string, decision: TriageDecision): TriageRecord => ({ taskId, decision, inverse: empty })

  it('counts each kind of decision', () => {
    let flow = startDecisionFlow<TriageDecision>(tasks)
    const decisions: TriageDecision[] = [
      { type: 'accept', projectId: 'work', date: null },
      { type: 'today' },
      { type: 'tomorrow' },
      { type: 'someday' },
      { type: 'delete' },
      { type: 'skip' },
    ]
    decisions.forEach((d, i) => {
      flow = recordDecision(flow, rec(tasks[i].id, d))
    })
    expect(summarizeTriage(flow)).toEqual({
      total: 6,
      decided: 6,
      moved: 1,
      today: 1,
      tomorrow: 1,
      someday: 1,
      deleted: 1,
      skipped: 1,
    })
  })

  it('writes only the non-zero kinds', () => {
    const text = describeTriageSummary({ total: 5, decided: 5, moved: 2, today: 1, tomorrow: 0, someday: 0, deleted: 1, skipped: 1 })
    expect(text).toBe('5개 중 프로젝트로 2, 오늘 1, 삭제 1, 건너뜀 1')
  })

  it('handles the not-yet-started case', () => {
    const text = describeTriageSummary({ total: 2, decided: 0, moved: 0, today: 0, tomorrow: 0, someday: 0, deleted: 0, skipped: 0 })
    expect(text).toBe('2개 중 아직 정리한 게 없어요')
  })
})
