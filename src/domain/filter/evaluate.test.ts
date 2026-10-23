import { describe, expect, it } from 'vitest'
import { makeLabel, makeProject, makeSection, makeTask } from '../../test/factories'
import { INBOX_ID } from '../types'
import type { EngineContext, Task } from '../types'
import { matchesFilter, parseFilter, runFilter } from './index'
import { makeCtx, TODAY } from './testContext'

/** 첫 묶음의 작업 id만 뽑아 비교하기 쉽게 한다. */
function ids(query: string, ctx: EngineContext): string[] {
  const result = runFilter(query, ctx)
  if (!result.ok) throw new Error(`실행 실패: ${result.error.message}`)
  return result.groups[0].map((t) => t.id)
}

function withTasks(tasks: Task[], extra: Partial<EngineContext> = {}): EngineContext {
  return makeCtx({ tasks, ...extra })
}

describe('date semantics (startDate is the due date, dueDate is the deadline)', () => {
  it('matches today by startDate', () => {
    const a = makeTask({ id: 'a', startDate: TODAY })
    const b = makeTask({ id: 'b', startDate: '2026-10-24' })
    expect(ids('today', withTasks([a, b]))).toEqual(['a'])
  })

  it('falls back to dueDate when there is no startDate', () => {
    const a = makeTask({ id: 'a', dueDate: TODAY })
    expect(ids('today', withTasks([a]))).toEqual(['a'])
  })

  it('prefers startDate over dueDate for date queries', () => {
    const a = makeTask({ id: 'a', startDate: '2026-10-24', dueDate: TODAY })
    const ctx = withTasks([a])
    expect(ids('today', ctx)).toEqual([])
    expect(ids('tomorrow', ctx)).toEqual(['a'])
    expect(ids('deadline: today', ctx)).toEqual(['a'])
    expect(ids('마감: 오늘', ctx)).toEqual(['a'])
  })

  it('matches yesterday and tomorrow', () => {
    const y = makeTask({ id: 'y', startDate: '2026-10-22' })
    const t = makeTask({ id: 't', startDate: '2026-10-24' })
    const ctx = withTasks([y, t])
    expect(ids('yesterday', ctx)).toEqual(['y'])
    expect(ids('내일', ctx)).toEqual(['t'])
  })

  it('treats overdue as effective date before today for open tasks only', () => {
    const late = makeTask({ id: 'late', startDate: '2026-10-22' })
    const lateDue = makeTask({ id: 'lateDue', dueDate: '2026-10-01' })
    const active = makeTask({ id: 'active', startDate: '2026-10-01', status: 'active' })
    const todayTask = makeTask({ id: 'today', startDate: TODAY })
    const undated = makeTask({ id: 'none' })
    const done = makeTask({ id: 'done', startDate: '2026-10-01', status: 'done' })
    const ctx = withTasks([late, lateDue, active, todayTask, undated, done])
    expect(ids('overdue', ctx)).toEqual(['late', 'lateDue', 'active'])
    expect(ids('od', ctx)).toEqual(['late', 'lateDue', 'active'])
    expect(ids('기한초과', ctx)).toEqual(['late', 'lateDue', 'active'])
  })

  it('does not call a task overdue because only its deadline passed', () => {
    const a = makeTask({ id: 'a', startDate: '2026-10-25', dueDate: '2026-10-01' })
    expect(ids('overdue', withTasks([a]))).toEqual([])
    expect(ids('deadline before: today', withTasks([a]))).toEqual(['a'])
  })

  it('handles no date, no time and no deadline', () => {
    const plain = makeTask({ id: 'plain' })
    const dated = makeTask({ id: 'dated', startDate: TODAY, startTime: '09:00' })
    const dueOnly = makeTask({ id: 'dueOnly', dueDate: TODAY })
    const ctx = withTasks([plain, dated, dueOnly])
    expect(ids('no date', ctx)).toEqual(['plain'])
    expect(ids('날짜없음', ctx)).toEqual(['plain'])
    expect(ids('!no date', ctx)).toEqual(['dated', 'dueOnly'])
    expect(ids('no time', ctx)).toEqual(['plain', 'dueOnly'])
    expect(ids('!no date & !no time', ctx)).toEqual(['dated'])
    expect(ids('no deadline', ctx)).toEqual(['plain', 'dated'])
    expect(ids('!no deadline', ctx)).toEqual(['dueOnly'])
  })

  it('compares explicit dates with on, before and after', () => {
    const a = makeTask({ id: 'a', startDate: '2026-10-29' })
    const b = makeTask({ id: 'b', startDate: '2026-10-30' })
    const c = makeTask({ id: 'c', startDate: '2026-10-31' })
    const n = makeTask({ id: 'n' })
    const ctx = withTasks([a, b, c, n])
    expect(ids('date: 2026-10-30', ctx)).toEqual(['b'])
    expect(ids('date: 10월 30일', ctx)).toEqual(['b'])
    expect(ids('date: Oct 30', ctx)).toEqual(['b'])
    expect(ids('date before: Oct 30', ctx)).toEqual(['a'])
    expect(ids('before: 2026-10-31', ctx)).toEqual(['a', 'b'])
    expect(ids('date after: 2026-10-30', ctx)).toEqual(['c'])
    expect(ids('날짜이후: 2026-10-29', ctx)).toEqual(['b', 'c'])
  })

  it('resolves relative and weekday expressions against the context', () => {
    const mon = makeTask({ id: 'mon', startDate: '2026-10-26' })
    const nextWeekStart = makeTask({ id: 'nw', startDate: '2026-10-26' })
    const sat = makeTask({ id: 'sat', startDate: '2026-10-24' })
    const ctx = withTasks([mon, sat])
    expect(ids('date: monday', ctx)).toEqual(['mon'])
    expect(ids('date: 월요일', ctx)).toEqual(['mon'])
    expect(ids('date before: next week', ctx)).toEqual(['sat'])
    expect(ids('date: next week', withTasks([nextWeekStart]))).toEqual(['nw'])
    expect(ids('date: in 1 days', ctx)).toEqual(['sat'])
    expect(ids('date: 3일 후', ctx)).toEqual(['mon'])
  })

  it('uses the context week start for next week', () => {
    const sun = makeTask({ id: 'sun', startDate: '2026-10-25' })
    const ctx = makeCtx({ tasks: [sun], weekStartsOn: 0 })
    expect(ids('date: next week', ctx)).toEqual(['sun'])
  })

  it('applies deadline queries to dueDate only', () => {
    const a = makeTask({ id: 'a', dueDate: '2026-10-30' })
    const b = makeTask({ id: 'b', startDate: '2026-10-30' })
    const ctx = withTasks([a, b])
    expect(ids('deadline: Oct 30', ctx)).toEqual(['a'])
    expect(ids('due before: 2026-11-01', ctx)).toEqual(['a'])
    expect(ids('deadline after: 2026-10-01', ctx)).toEqual(['a'])
    expect(ids('마감이전: 2026-10-01', ctx)).toEqual([])
  })

  it('평년의 2월 29일은 아무 작업과도 맞지 않는다', () => {
    const a = makeTask({ id: 'a', startDate: '2026-02-28' })
    expect(ids('date: Feb 29', withTasks([a]))).toEqual([])
    expect(ids('date before: Feb 29', withTasks([a]))).toEqual([])
    const leap = makeCtx({ today: '2028-03-01', tasks: [makeTask({ id: 'l', startDate: '2028-02-29' })] })
    expect(ids('date: Feb 29', leap)).toEqual(['l'])
  })

  it('matches created by local calendar date', () => {
    const made = new Date(2026, 9, 23, 23, 30).getTime()
    const old = new Date(2026, 0, 5, 8, 0).getTime()
    const a = makeTask({ id: 'a', createdAt: made })
    const b = makeTask({ id: 'b', createdAt: old })
    const ctx = withTasks([a, b])
    expect(ids('created: today', ctx)).toEqual(['a'])
    expect(ids('생성: 오늘', ctx)).toEqual(['a'])
    expect(ids('created before: 2026-02-01', ctx)).toEqual(['b'])
    expect(ids('created after: 2026-02-01', ctx)).toEqual(['a'])
  })
})

describe('day windows', () => {
  it('includes today through N-1 days ahead and excludes overdue', () => {
    const tasks = [
      makeTask({ id: 'late', startDate: '2026-10-22' }),
      makeTask({ id: 'd0', startDate: '2026-10-23' }),
      makeTask({ id: 'd6', startDate: '2026-10-29' }),
      makeTask({ id: 'd7', startDate: '2026-10-30' }),
      makeTask({ id: 'none' }),
    ]
    expect(ids('7 days', withTasks(tasks))).toEqual(['d0', 'd6'])
    expect(ids('7일', withTasks(tasks))).toEqual(['d0', 'd6'])
    expect(ids('next 7 days', withTasks(tasks))).toEqual(['d0', 'd6'])
  })

  it('crosses a month boundary when today is the last day of the month', () => {
    const ctx = makeCtx({
      today: '2026-10-31',
      tasks: [
        makeTask({ id: 'a', startDate: '2026-10-31' }),
        makeTask({ id: 'b', startDate: '2026-11-06' }),
        makeTask({ id: 'c', startDate: '2026-11-07' }),
      ],
    })
    expect(ids('7 days', ctx)).toEqual(['a', 'b'])
  })

  it('crosses a year boundary and leap february', () => {
    const newYear = makeCtx({
      today: '2026-12-29',
      tasks: [
        makeTask({ id: 'a', startDate: '2027-01-04' }),
        makeTask({ id: 'b', startDate: '2027-01-05' }),
      ],
    })
    expect(ids('7 days', newYear)).toEqual(['a'])
    const leap = makeCtx({
      today: '2028-02-26',
      tasks: [
        makeTask({ id: 'a', startDate: '2028-02-29' }),
        makeTask({ id: 'b', startDate: '2028-03-03' }),
        makeTask({ id: 'c', startDate: '2028-03-04' }),
      ],
    })
    expect(ids('7 days', leap)).toEqual(['a', 'b'])
  })

  it('looks back for negative windows', () => {
    const tasks = [
      makeTask({ id: 'old', startDate: '2026-10-19' }),
      makeTask({ id: 'p2', startDate: '2026-10-21' }),
      makeTask({ id: 'p1', startDate: '2026-10-22' }),
      makeTask({ id: 'p0', startDate: '2026-10-23' }),
      makeTask({ id: 'future', startDate: '2026-10-24' }),
    ]
    expect(ids('-3 days', withTasks(tasks))).toEqual(['p2', 'p1', 'p0'])
    expect(ids('-3일', withTasks(tasks))).toEqual(['p2', 'p1', 'p0'])
  })

  it('combines with overdue through OR', () => {
    const tasks = [
      makeTask({ id: 'late', startDate: '2026-10-01' }),
      makeTask({ id: 'soon', startDate: '2026-10-25' }),
      makeTask({ id: 'far', startDate: '2026-12-25' }),
    ]
    expect(ids('overdue | 7 days', withTasks(tasks))).toEqual(['late', 'soon'])
  })
})

describe('status gating', () => {
  const tasks = [
    makeTask({ id: 'todo', priority: 1 }),
    makeTask({ id: 'active', priority: 1, status: 'active' }),
    makeTask({ id: 'done', priority: 1, status: 'done' }),
    makeTask({ id: 'canceled', priority: 1, status: 'canceled' }),
    makeTask({ id: 'trash', priority: 1, deletedAt: 5 }),
    makeTask({ id: 'trashDone', priority: 1, status: 'done', deletedAt: 5 }),
  ]
  const ctx = withTasks(tasks)

  it('excludes deleted, done and canceled tasks by default', () => {
    expect(ids('p1', ctx)).toEqual(['todo', 'active'])
    expect(ids('!p4', ctx)).toEqual(['todo', 'active'])
    expect(ids('!subtask', ctx)).toEqual(['todo', 'active'])
  })

  it('includes done and canceled tasks with view all but never deleted ones', () => {
    expect(ids('view all', ctx)).toEqual(['todo', 'active', 'done', 'canceled'])
    expect(ids('전체보기 & p1', ctx)).toEqual(['todo', 'active', 'done', 'canceled'])
  })

  it('returns only done tasks for completed and only canceled for canceled', () => {
    expect(ids('completed', ctx)).toEqual(['done'])
    expect(ids('완료', ctx)).toEqual(['done'])
    expect(ids('canceled', ctx)).toEqual(['canceled'])
    expect(ids('취소', ctx)).toEqual(['canceled'])
    expect(ids('completed | canceled', ctx)).toEqual(['done', 'canceled'])
  })

  it('lets completed lift the gate for the whole group', () => {
    expect(ids('p1 | completed', ctx)).toEqual(['todo', 'active', 'done'])
  })

  it('keeps the gate when completed is negated', () => {
    expect(ids('p1 & !completed', ctx)).toEqual(['todo', 'active'])
    expect(ids('!!completed', ctx)).toEqual(['done'])
  })

  it('treats the all keyword as match-everything without lifting the gate', () => {
    expect(ids('all', ctx)).toEqual(['todo', 'active'])
    expect(ids('전체', ctx)).toEqual(['todo', 'active'])
  })

  it('applies the gate per group', () => {
    const result = runFilter('p1, completed', ctx)
    expect(result.ok && result.groups.map((g) => g.map((t) => t.id))).toEqual([
      ['todo', 'active'],
      ['done'],
    ])
  })
})

describe('properties', () => {
  it('filters by priority and treats no priority as p4', () => {
    const tasks = [
      makeTask({ id: 'a', priority: 1 }),
      makeTask({ id: 'b', priority: 2 }),
      makeTask({ id: 'c', priority: 4 }),
    ]
    const ctx = withTasks(tasks)
    expect(ids('p1', ctx)).toEqual(['a'])
    expect(ids('p1 | p2', ctx)).toEqual(['a', 'b'])
    expect(ids('no priority', ctx)).toEqual(['c'])
    expect(ids('p4', ctx)).toEqual(['c'])
  })

  it('filters projects by case-insensitive name', () => {
    const work = makeProject({ id: 'work', name: 'Work' })
    const home = makeProject({ id: 'home', name: '집' })
    const tasks = [
      makeTask({ id: 'a', projectId: 'work' }),
      makeTask({ id: 'b', projectId: 'home' }),
    ]
    const ctx = withTasks(tasks, { projects: [work, home] })
    expect(ids('#work', ctx)).toEqual(['a'])
    expect(ids('#WORK', ctx)).toEqual(['a'])
    expect(ids('#집', ctx)).toEqual(['b'])
    expect(ids('#missing', ctx)).toEqual([])
  })

  it('matches project wildcards in every position', () => {
    const projects = [
      makeProject({ id: 'p1', name: 'Work Alpha' }),
      makeProject({ id: 'p2', name: 'Home Alpha' }),
      makeProject({ id: 'p3', name: 'Work' }),
    ]
    const tasks = projects.map((p) => makeTask({ id: `t-${p.id}`, projectId: p.id }))
    const ctx = withTasks(tasks, { projects })
    expect(ids('#Work*', ctx)).toEqual(['t-p1', 't-p3'])
    expect(ids('#*Alpha', ctx)).toEqual(['t-p1', 't-p2'])
    expect(ids('#*o*A*', ctx)).toEqual(['t-p1', 't-p2'])
    expect(ids('#w*a', ctx)).toEqual(['t-p1'])
    expect(ids('#*', ctx)).toEqual(['t-p1', 't-p2', 't-p3'])
    expect(ids('#Wor*k', ctx)).toEqual(['t-p3'])
    expect(ids('#Work*Work', ctx)).toEqual([])
  })

  it('treats an escaped star as a literal character', () => {
    const star = makeProject({ id: 'star', name: 'a*b' })
    const other = makeProject({ id: 'other', name: 'axxb' })
    const tasks = [
      makeTask({ id: 'a', projectId: 'star' }),
      makeTask({ id: 'b', projectId: 'other' }),
    ]
    const ctx = withTasks(tasks, { projects: [star, other] })
    expect(ids('#a\\*b', ctx)).toEqual(['a'])
    expect(ids('#a*b', ctx)).toEqual(['a', 'b'])
  })

  it('includes subprojects recursively with double hash only', () => {
    const projects = [
      makeProject({ id: 'root', name: 'Root' }),
      makeProject({ id: 'child', name: 'Child', parentId: 'root' }),
      makeProject({ id: 'grand', name: 'Grand', parentId: 'child' }),
      makeProject({ id: 'great', name: 'Great', parentId: 'grand' }),
      makeProject({ id: 'sibling', name: 'Sibling' }),
    ]
    const tasks = projects.map((p) => makeTask({ id: `t-${p.id}`, projectId: p.id }))
    const ctx = withTasks(tasks, { projects })
    expect(ids('#Root', ctx)).toEqual(['t-root'])
    expect(ids('##Root', ctx)).toEqual(['t-root', 't-child', 't-grand', 't-great'])
    expect(ids('##Child', ctx)).toEqual(['t-child', 't-grand', 't-great'])
    expect(ids('##Sibling', ctx)).toEqual(['t-sibling'])
  })

  it('survives a parent cycle in project data', () => {
    const projects = [
      makeProject({ id: 'a', name: 'A', parentId: 'b' }),
      makeProject({ id: 'b', name: 'B', parentId: 'a' }),
    ]
    const tasks = projects.map((p) => makeTask({ id: `t-${p.id}`, projectId: p.id }))
    expect(ids('##A', withTasks(tasks, { projects }))).toEqual(['t-a', 't-b'])
  })

  it('ignores deleted projects when resolving names and subprojects', () => {
    const projects = [
      makeProject({ id: 'root', name: 'Root' }),
      makeProject({ id: 'gone', name: 'Root', deletedAt: 1 }),
      makeProject({ id: 'child', name: 'Child', parentId: 'root', deletedAt: 1 }),
    ]
    const tasks = [
      makeTask({ id: 'a', projectId: 'root' }),
      makeTask({ id: 'b', projectId: 'gone' }),
      makeTask({ id: 'c', projectId: 'child' }),
    ]
    const ctx = withTasks(tasks, { projects })
    expect(ids('#Root', ctx)).toEqual(['a'])
    expect(ids('##Root', ctx)).toEqual(['a'])
  })

  it('matches the inbox by its well-known names', () => {
    const task = makeTask({ id: 'a', projectId: INBOX_ID })
    const ctx = withTasks([task])
    expect(ids('#inbox', ctx)).toEqual(['a'])
    expect(ids('#받은편지함', ctx)).toEqual(['a'])
    expect(ids('##Inbox', ctx)).toEqual(['a'])
  })

  it('filters sections by name', () => {
    const sections = [
      makeSection({ id: 's1', name: 'Planning' }),
      makeSection({ id: 's2', name: '기획 회의' }),
    ]
    const tasks = [
      makeTask({ id: 'a', sectionId: 's1' }),
      makeTask({ id: 'b', sectionId: 's2' }),
      makeTask({ id: 'c' }),
    ]
    const ctx = withTasks(tasks, { sections })
    expect(ids('/planning', ctx)).toEqual(['a'])
    expect(ids('/기획*', ctx)).toEqual(['b'])
    expect(ids('/기획\\ 회의', ctx)).toEqual(['b'])
    expect(ids('/*', ctx)).toEqual(['a', 'b'])
  })

  it('filters labels with both prefixes and wildcards', () => {
    const labels = [
      makeLabel({ id: 'l1', name: 'work' }),
      makeLabel({ id: 'l2', name: 'work-home' }),
      makeLabel({ id: 'l3', name: 'urgent' }),
    ]
    const tasks = [
      makeTask({ id: 'a', labelIds: ['l1'] }),
      makeTask({ id: 'b', labelIds: ['l2', 'l3'] }),
      makeTask({ id: 'c' }),
    ]
    const ctx = withTasks(tasks, { labels })
    expect(ids('@work', ctx)).toEqual(['a'])
    expect(ids('%work', ctx)).toEqual(['a'])
    expect(ids('%WORK*', ctx)).toEqual(['a', 'b'])
    expect(ids('%urgent & %work*', ctx)).toEqual(['b'])
    expect(ids('no labels', ctx)).toEqual(['c'])
    expect(ids('라벨없음', ctx)).toEqual(['c'])
    expect(ids('!no labels', ctx)).toEqual(['a', 'b'])
    expect(ids('%nonexistent', ctx)).toEqual([])
  })

  it('handles recurring and subtask flags', () => {
    const recurrence = {
      freq: 'daily' as const,
      interval: 1,
      anchor: 'due' as const,
      end: { type: 'never' as const },
      resetSubtasks: false,
    }
    const tasks = [
      makeTask({ id: 'rec', recurrence }),
      makeTask({ id: 'sub', parentId: 'rec' }),
      makeTask({ id: 'top' }),
    ]
    const ctx = withTasks(tasks)
    expect(ids('recurring', ctx)).toEqual(['rec'])
    expect(ids('반복', ctx)).toEqual(['rec'])
    expect(ids('!recurring', ctx)).toEqual(['sub', 'top'])
    expect(ids('subtask', ctx)).toEqual(['sub'])
    expect(ids('하위작업', ctx)).toEqual(['sub'])
    expect(ids('!subtask', ctx)).toEqual(['rec', 'top'])
  })

  it('treats a task as blocked only while a blocker is unresolved', () => {
    const tasks = [
      makeTask({ id: 'open' }),
      makeTask({ id: 'finished', status: 'done' }),
      makeTask({ id: 'binned', deletedAt: 1 }),
      makeTask({ id: 'b1', blockedBy: ['open'] }),
      makeTask({ id: 'b2', blockedBy: ['finished'] }),
      makeTask({ id: 'b3', blockedBy: ['binned', 'open'] }),
      makeTask({ id: 'b4', blockedBy: ['ghost'] }),
      makeTask({ id: 'free' }),
    ]
    const ctx = withTasks(tasks)
    expect(ids('blocked', ctx)).toEqual(['b1', 'b3'])
    expect(ids('막힘', ctx)).toEqual(['b1', 'b3'])
    expect(ids('!blocked & p4', ctx)).toEqual(['open', 'b2', 'b4', 'free'])
  })

  it('handles hold, someday and pinned', () => {
    const tasks = [
      makeTask({ id: 'h', onHold: true }),
      makeTask({ id: 's', someday: true }),
      makeTask({ id: 'p', pinned: true }),
    ]
    const ctx = withTasks(tasks)
    expect(ids('hold', ctx)).toEqual(['h'])
    expect(ids('보류', ctx)).toEqual(['h'])
    expect(ids('someday', ctx)).toEqual(['s'])
    expect(ids('언젠가', ctx)).toEqual(['s'])
    expect(ids('pinned', ctx)).toEqual(['p'])
    expect(ids('고정', ctx)).toEqual(['p'])
  })

  it('compares postponed counts', () => {
    const tasks = [
      makeTask({ id: 'a', postponeCount: 0 }),
      makeTask({ id: 'b', postponeCount: 1 }),
      makeTask({ id: 'c', postponeCount: 3 }),
      makeTask({ id: 'd', postponeCount: 5 }),
    ]
    const ctx = withTasks(tasks)
    expect(ids('postponed', ctx)).toEqual(['b', 'c', 'd'])
    expect(ids('미룸', ctx)).toEqual(['b', 'c', 'd'])
    expect(ids('postponed >= 3', ctx)).toEqual(['c', 'd'])
    expect(ids('postponed > 3', ctx)).toEqual(['d'])
    expect(ids('postponed < 1', ctx)).toEqual(['a'])
    expect(ids('postponed <= 1', ctx)).toEqual(['a', 'b'])
    expect(ids('postponed = 3', ctx)).toEqual(['c'])
  })

  it('compares estimates and never matches tasks without one', () => {
    const tasks = [
      makeTask({ id: 'none' }),
      makeTask({ id: 'short', estimateMin: 15 }),
      makeTask({ id: 'exact', estimateMin: 30 }),
      makeTask({ id: 'long', estimateMin: 90 }),
    ]
    const ctx = withTasks(tasks)
    expect(ids('estimate > 30m', ctx)).toEqual(['long'])
    expect(ids('예상 > 30분', ctx)).toEqual(['long'])
    expect(ids('estimate >= 30m', ctx)).toEqual(['exact', 'long'])
    expect(ids('estimate < 30m', ctx)).toEqual(['short'])
    expect(ids('estimate <= 1h', ctx)).toEqual(['short', 'exact'])
    expect(ids('estimate = 1h30m', ctx)).toEqual(['long'])
  })

  it('searches title and description case-insensitively', () => {
    const tasks = [
      makeTask({ id: 'a', title: 'Team Meeting' }),
      makeTask({ id: 'b', title: 'x', description: 'notes from the MEETING' }),
      makeTask({ id: 'c', title: 'Send email to Bob' }),
      makeTask({ id: 'd', title: '회의 준비' }),
      makeTask({ id: 'e', title: 'a&b' }),
    ]
    const ctx = withTasks(tasks)
    expect(ids('search: meeting', ctx)).toEqual(['a', 'b'])
    expect(ids('검색: 회의', ctx)).toEqual(['d'])
    expect(ids('search: "send email"', ctx)).toEqual(['c'])
    expect(ids('search: "email send"', ctx)).toEqual([])
    expect(ids('search: a\\&b', ctx)).toEqual(['e'])
    expect(ids('search: meeting | search: email', ctx)).toEqual(['a', 'b', 'c'])
  })
})

describe('boolean logic', () => {
  const tasks = [
    makeTask({ id: 'a', priority: 1, startDate: TODAY }),
    makeTask({ id: 'b', priority: 1 }),
    makeTask({ id: 'c', priority: 2, startDate: TODAY }),
    makeTask({ id: 'd', priority: 2, startDate: '2026-10-01' }),
  ]
  const ctx = withTasks(tasks)

  it('evaluates and, or and precedence', () => {
    expect(ids('p1 & today', ctx)).toEqual(['a'])
    expect(ids('p1 | today', ctx)).toEqual(['a', 'b', 'c'])
    expect(ids('p2 | p1 & today', ctx)).toEqual(['a', 'c', 'd'])
    expect(ids('(p2 | p1) & today', ctx)).toEqual(['a', 'c'])
  })

  it('evaluates negation and deep negation', () => {
    expect(ids('!p1', ctx)).toEqual(['c', 'd'])
    expect(ids('!!p1', ctx)).toEqual(['a', 'b'])
    expect(ids('!(p1 | today)', ctx)).toEqual(['d'])
    expect(ids('!(p1 | !(today & p2))', ctx)).toEqual(['c'])
    expect(ids('!!!p1', ctx)).toEqual(['c', 'd'])
  })

  it('obeys De Morgan across the sample data', () => {
    const left = ids('!(p1 & today)', ctx)
    const right = ids('!p1 | !today', ctx)
    expect(left).toEqual(right)
  })

  it('returns every group as its own list in input order', () => {
    const result = runFilter('p1 & today, p2, today', ctx)
    expect(result.ok && result.groups.map((g) => g.map((t) => t.id))).toEqual([
      ['a'],
      ['c', 'd'],
      ['a', 'c'],
    ])
  })

  it('does not mutate the context or the tasks', () => {
    const before = JSON.stringify(ctx)
    runFilter('(p1 | p2) & !today, overdue', ctx)
    expect(JSON.stringify(ctx)).toBe(before)
  })
})

describe('runFilter errors and matchesFilter', () => {
  it('passes parse errors through', () => {
    const result = runFilter('meeting', makeCtx())
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error.position).toBe(0)
  })

  it('returns one empty group for an empty task list', () => {
    expect(runFilter('today', makeCtx())).toEqual({ ok: true, groups: [[]] })
  })

  it('applies the status gate inside matchesFilter', () => {
    const parsed = parseFilter('p1 | completed')
    if (!parsed.ok) throw new Error('parse')
    const node = parsed.ast[0]
    const ctx = makeCtx()
    expect(matchesFilter(node, makeTask({ priority: 1 }), ctx)).toBe(true)
    expect(matchesFilter(node, makeTask({ priority: 1, deletedAt: 1 }), ctx)).toBe(false)
    expect(matchesFilter(node, makeTask({ priority: 1, status: 'canceled' }), ctx)).toBe(false)
    expect(matchesFilter(node, makeTask({ priority: 4, status: 'done' }), ctx)).toBe(true)
    expect(matchesFilter(node, makeTask({ priority: 4 }), ctx)).toBe(false)
  })

  it('reflects context changes between matchesFilter calls', () => {
    const parsed = parseFilter('#Work')
    if (!parsed.ok) throw new Error('parse')
    const node = parsed.ast[0]
    const task = makeTask({ projectId: 'w' })
    const none = makeCtx()
    const withWork = makeCtx({ projects: [makeProject({ id: 'w', name: 'Work' })] })
    expect(matchesFilter(node, task, none)).toBe(false)
    expect(matchesFilter(node, task, withWork)).toBe(true)
    expect(matchesFilter(node, task, withWork)).toBe(true)
    expect(matchesFilter(node, task, { ...withWork, today: '2030-01-01' })).toBe(true)
  })
})

describe('performance', () => {
  it('evaluates a compound query over 10,000 tasks within 50ms', () => {
    const projects = Array.from({ length: 40 }, (_, i) =>
      makeProject({
        id: `proj${i}`,
        name: i % 10 === 0 ? `Work ${i}` : `Project ${i}`,
        parentId: i % 10 === 0 || i === 0 ? null : `proj${Math.floor(i / 10) * 10}`,
      }),
    )
    const labels = Array.from({ length: 20 }, (_, i) => makeLabel({ id: `lab${i}`, name: `tag${i}` }))
    const tasks = Array.from({ length: 10_000 }, (_, i) =>
      makeTask({
        id: `perf${i}`,
        title: `Task number ${i}`,
        projectId: `proj${i % 40}`,
        labelIds: [`lab${i % 20}`],
        priority: ((i % 4) + 1) as 1 | 2 | 3 | 4,
        startDate: i % 3 === 0 ? `2026-10-${String(1 + (i % 28)).padStart(2, '0')}` : null,
        dueDate: i % 5 === 0 ? '2026-11-02' : null,
        postponeCount: i % 7,
        estimateMin: i % 2 === 0 ? 20 + (i % 90) : null,
        blockedBy: i % 11 === 0 ? [`perf${i + 1}`] : [],
        createdAt: new Date(2026, i % 12, 1 + (i % 28)).getTime(),
      }),
    )
    const ctx = makeCtx({ projects, labels, tasks })
    const query =
      '(today | overdue | 7 days) & ##Work* & (%tag1* | @tag2) & !subtask & p1 | ' +
      '(blocked & postponed >= 3 & estimate > 30m) | (created before: 2026-06-01 & search: 99)'

    const first = runFilter(query, ctx)
    expect(first.ok).toBe(true)
    const timings = [0, 1, 2].map(() => {
      const start = performance.now()
      runFilter(query, ctx)
      return performance.now() - start
    })
    // 병렬·커버리지 실행에서도 흔들리지 않도록 넉넉히 잡는다(O(n²)로 퇴행하면 수 초가 걸려 여전히 잡힌다).
    expect(Math.min(...timings)).toBeLessThan(500)
  })
})
