import { makeLabel, makeProject, makeSection, makeTask } from '../../test/factories'
import { INBOX_ID } from '../types'
import type { EngineContext } from '../types'
import { groupTasks } from './group'
import { formatGroupDate } from './groupTitles'

// 2026-10-23 은 금요일
function makeCtx(overrides: Partial<EngineContext> = {}): EngineContext {
  return {
    today: '2026-10-23',
    now: new Date(2026, 9, 23, 12),
    weekStartsOn: 1,
    projects: [],
    sections: [],
    labels: [],
    tasks: [],
    ...overrides,
  }
}

const titles = (groups: readonly { title: string }[]): string[] => groups.map((g) => g.title)
const idsOf = (groups: readonly { tasks: readonly { id: string }[] }[]): string[][] =>
  groups.map((g) => g.tasks.map((t) => t.id))

describe('formatGroupDate', () => {
  const today = '2026-10-23'

  test('uses relative words around today', () => {
    expect(formatGroupDate('2026-10-22', today)).toBe('어제')
    expect(formatGroupDate('2026-10-23', today)).toBe('오늘')
    expect(formatGroupDate('2026-10-24', today)).toBe('내일')
  })

  test('uses month, day and weekday otherwise', () => {
    expect(formatGroupDate('2026-10-26', today)).toBe('10월 26일 월요일')
    expect(formatGroupDate('2026-11-01', today)).toBe('11월 1일 일요일')
  })

  test('adds the year when it differs from today', () => {
    expect(formatGroupDate('2025-10-25', today)).toBe('2025년 10월 25일 토요일')
    expect(formatGroupDate('2027-01-01', today)).toBe('2027년 1월 1일 금요일')
  })

  test('relative words win across a year boundary', () => {
    expect(formatGroupDate('2027-01-01', '2026-12-31')).toBe('내일')
  })
})

describe('groupTasks', () => {
  test('returns no groups for empty input in every mode', () => {
    const ctx = makeCtx()
    const modes = ['none', 'date', 'createdAt', 'dueDate', 'priority', 'label', 'project', 'section'] as const
    modes.forEach((mode) => expect(groupTasks([], mode, ctx)).toEqual([]))
  })

  test('none puts everything into one group in input order', () => {
    const a = makeTask({ id: 'a' })
    const b = makeTask({ id: 'b' })
    const groups = groupTasks([b, a], 'none', makeCtx())
    expect(groups).toHaveLength(1)
    expect(groups[0].key).toBe('none')
    expect(idsOf(groups)).toEqual([['b', 'a']])
  })

  test('date groups ascend by date, with relative titles and no-date last', () => {
    const none = makeTask({ id: 'none' })
    const later = makeTask({ id: 'later', startDate: '2026-10-26' })
    const today = makeTask({ id: 'today', startDate: '2026-10-23' })
    const tomorrow = makeTask({ id: 'tomorrow', dueDate: '2026-10-24' })
    const today2 = makeTask({ id: 'today2', startDate: '2026-10-23' })
    const groups = groupTasks([none, later, today, tomorrow, today2], 'date', makeCtx())
    expect(titles(groups)).toEqual(['오늘', '내일', '10월 26일 월요일', '날짜 없음'])
    expect(idsOf(groups)).toEqual([['today', 'today2'], ['tomorrow'], ['later'], ['none']])
    expect(new Set(groups.map((g) => g.key)).size).toBe(4)
  })

  test('dueDate groups only look at the due date', () => {
    const a = makeTask({ id: 'a', startDate: '2026-10-01', dueDate: '2026-10-25' })
    const b = makeTask({ id: 'b', startDate: '2026-10-01' })
    const groups = groupTasks([b, a], 'dueDate', makeCtx())
    expect(titles(groups)).toEqual(['10월 25일 일요일', '마감 없음'])
    expect(idsOf(groups)).toEqual([['a'], ['b']])
  })

  test('createdAt groups by local creation day, ascending', () => {
    const day1 = makeTask({ id: 'day1', createdAt: new Date(2026, 9, 22, 23, 59).getTime() })
    const day2 = makeTask({ id: 'day2', createdAt: new Date(2026, 9, 23, 0, 1).getTime() })
    const day2b = makeTask({ id: 'day2b', createdAt: new Date(2026, 9, 23, 18, 0).getTime() })
    const groups = groupTasks([day2b, day2, day1], 'createdAt', makeCtx())
    expect(titles(groups)).toEqual(['어제', '오늘'])
    expect(idsOf(groups)).toEqual([['day1'], ['day2b', 'day2']])
  })

  test('priority groups run P1 to P4 and skip empty ones', () => {
    const p4 = makeTask({ id: 'p4', priority: 4 })
    const p1 = makeTask({ id: 'p1', priority: 1 })
    const p1b = makeTask({ id: 'p1b', priority: 1 })
    const groups = groupTasks([p4, p1, p1b], 'priority', makeCtx())
    expect(titles(groups)).toEqual(['우선순위 1', '우선순위 4'])
    expect(idsOf(groups)).toEqual([['p1', 'p1b'], ['p4']])
  })

  test('label groups follow label order, duplicate multi-label tasks, and put unlabeled last', () => {
    const work = makeLabel({ id: 'work', name: '업무', order: 2 })
    const home = makeLabel({ id: 'home', name: '집', order: 1 })
    const both = makeTask({ id: 'both', labelIds: ['work', 'home'] })
    const workOnly = makeTask({ id: 'workOnly', labelIds: ['work'] })
    const none = makeTask({ id: 'none' })
    const ghost = makeTask({ id: 'ghost', labelIds: ['deleted-label'] })
    const groups = groupTasks([both, workOnly, none, ghost], 'label', makeCtx({ labels: [work, home] }))
    expect(titles(groups)).toEqual(['집', '업무', '라벨 없음'])
    expect(idsOf(groups)).toEqual([['both'], ['both', 'workOnly'], ['none', 'ghost']])
  })

  test('project groups follow project order and name the inbox when it is not listed', () => {
    const b = makeProject({ id: 'b', name: '나', order: 2 })
    const a = makeProject({ id: 'a', name: '가', order: 1 })
    const inA = makeTask({ id: 'inA', projectId: 'a' })
    const inB = makeTask({ id: 'inB', projectId: 'b' })
    const inbox = makeTask({ id: 'inbox', projectId: INBOX_ID })
    const lost = makeTask({ id: 'lost', projectId: 'gone' })
    const groups = groupTasks([inB, inbox, lost, inA], 'project', makeCtx({ projects: [b, a] }))
    expect(titles(groups)).toEqual(['가', '나', '받은편지함', '프로젝트 없음'])
    expect(idsOf(groups)).toEqual([['inA'], ['inB'], ['inbox'], ['lost']])
  })

  test('project order ties fall back to the name', () => {
    const z = makeProject({ id: 'z', name: '하', order: 0 })
    const g = makeProject({ id: 'g', name: '가', order: 0 })
    const groups = groupTasks(
      [makeTask({ projectId: 'z' }), makeTask({ projectId: 'g' })],
      'project',
      makeCtx({ projects: [z, g] }),
    )
    expect(titles(groups)).toEqual(['가', '하'])
  })

  test('section groups follow section order and put sectionless tasks last', () => {
    const p = makeProject({ id: 'p' })
    const s2 = makeSection({ id: 's2', projectId: 'p', name: '진행', order: 2 })
    const s1 = makeSection({ id: 's1', projectId: 'p', name: '대기', order: 1 })
    const t1 = makeTask({ id: 't1', projectId: 'p', sectionId: 's2' })
    const t2 = makeTask({ id: 't2', projectId: 'p', sectionId: 's1' })
    const t3 = makeTask({ id: 't3', projectId: 'p' })
    const t4 = makeTask({ id: 't4', projectId: 'p', sectionId: 'vanished' })
    const groups = groupTasks([t1, t3, t2, t4], 'section', makeCtx({ projects: [p], sections: [s2, s1] }))
    expect(titles(groups)).toEqual(['대기', '진행', '섹션 없음'])
    expect(idsOf(groups)).toEqual([['t2'], ['t1'], ['t3', 't4']])
  })

  test('section groups add the project name when tasks span several projects', () => {
    const p1 = makeProject({ id: 'p1', name: '업무', order: 1 })
    const p2 = makeProject({ id: 'p2', name: '집', order: 2 })
    const s1 = makeSection({ id: 's1', projectId: 'p1', name: '할 일', order: 1 })
    const s2 = makeSection({ id: 's2', projectId: 'p2', name: '할 일', order: 1 })
    const a = makeTask({ id: 'a', projectId: 'p1', sectionId: 's1' })
    const b = makeTask({ id: 'b', projectId: 'p2', sectionId: 's2' })
    const groups = groupTasks([b, a], 'section', makeCtx({ projects: [p2, p1], sections: [s2, s1] }))
    expect(titles(groups)).toEqual(['업무 · 할 일', '집 · 할 일'])
  })

  test('does not mutate the input tasks or array', () => {
    const a = makeTask({ id: 'a', priority: 2 })
    const b = makeTask({ id: 'b', priority: 1 })
    const input = [a, b]
    groupTasks(input, 'priority', makeCtx())
    expect(input.map((t) => t.id)).toEqual(['a', 'b'])
  })
})
