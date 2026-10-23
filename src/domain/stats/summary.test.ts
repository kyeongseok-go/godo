import { makeProject, makeTask } from '../../test/factories'
import { INBOX_ID } from '../types'
import type { EngineContext, Project, Task } from '../types'
import { buildSummaryMarkdown } from './summary'
import type { SummaryOptions } from './summary'

const at = (month: number, day: number, hour = 12): number => new Date(2026, month - 1, day, hour).getTime()

const inbox = makeProject({ id: INBOX_ID, name: '받은편지함', order: 0 })
const work = makeProject({ id: 'work', name: '업무', order: 1 })

function makeCtx(tasks: readonly Task[], projects: readonly Project[] = [inbox, work]): EngineContext {
  return {
    today: '2026-10-23',
    now: new Date(2026, 9, 23, 12),
    weekStartsOn: 1,
    projects,
    sections: [],
    labels: [],
    tasks,
  }
}

const week: SummaryOptions = { from: '2026-10-19', to: '2026-10-25', projectIds: null, status: 'all' }

describe('buildSummaryMarkdown', () => {
  test('writes the header, project headings, checkboxes and nested subtasks', () => {
    const tasks = [
      makeTask({ id: 't1', title: '장보기', projectId: INBOX_ID, status: 'done', completedAt: at(10, 22) }),
      makeTask({ id: 't2', title: '보고서 작성', projectId: 'work', status: 'done', completedAt: at(10, 21), order: 1 }),
      makeTask({ id: 'c1', title: '초안', projectId: 'work', parentId: 't2', status: 'done', completedAt: at(10, 21) }),
      makeTask({ id: 't3', title: '리뷰', projectId: 'work', startDate: '2026-10-25', order: 2 }),
      makeTask({ id: 't4', title: '범위 밖 마감', projectId: INBOX_ID, dueDate: '2026-10-30' }),
      makeTask({ id: 't5', title: '오래전 완료', status: 'done', completedAt: at(10, 10) }),
    ]
    expect(buildSummaryMarkdown(makeCtx(tasks), week)).toBe(
      [
        '기간: 2026-10-19 ~ 2026-10-25 · 완료 3건 · 미완료 1건',
        '',
        '## 받은편지함',
        '- [x] 장보기 (10/22)',
        '',
        '## 업무',
        '- [x] 보고서 작성 (10/21)',
        '  - [x] 초안 (10/21)',
        '- [ ] 리뷰 (10/25)',
      ].join('\n'),
    )
  })

  test('uses the completion date in local time for the range edges', () => {
    const justBefore = makeTask({ title: '전날', status: 'done', completedAt: new Date(2026, 9, 18, 23, 59).getTime() })
    const first = makeTask({ title: '첫날', status: 'done', completedAt: new Date(2026, 9, 19, 0, 0).getTime() })
    const last = makeTask({ title: '끝날', status: 'done', completedAt: new Date(2026, 9, 25, 23, 59).getTime() })
    const after = makeTask({ title: '다음날', status: 'done', completedAt: new Date(2026, 9, 26, 0, 0).getTime() })
    const md = buildSummaryMarkdown(makeCtx([justBefore, first, last, after]), week)
    expect(md).toContain('완료 2건')
    expect(md).toContain('첫날')
    expect(md).toContain('끝날')
    expect(md).not.toContain('전날')
    expect(md).not.toContain('다음날')
  })

  test('pending tasks use startDate first, then dueDate, and need one of them in range', () => {
    const tasks = [
      makeTask({ title: '시작일 우선', startDate: '2026-10-20', dueDate: '2026-11-30' }),
      makeTask({ title: '마감만', dueDate: '2026-10-24' }),
      makeTask({ title: '날짜 없음' }),
      makeTask({ title: '시작일이 범위 밖', startDate: '2026-11-01', dueDate: '2026-10-21' }),
    ]
    const md = buildSummaryMarkdown(makeCtx(tasks), week)
    expect(md).toContain('- [ ] 시작일 우선 (10/20)')
    expect(md).toContain('- [ ] 마감만 (10/24)')
    expect(md).not.toContain('날짜 없음')
    expect(md).not.toContain('시작일이 범위 밖')
    expect(md).toContain('미완료 2건')
  })

  test('status filter keeps only the requested kind', () => {
    const tasks = [
      makeTask({ title: '끝남', status: 'done', completedAt: at(10, 22) }),
      makeTask({ title: '남음', startDate: '2026-10-22' }),
    ]
    const completed = buildSummaryMarkdown(makeCtx(tasks), { ...week, status: 'completed' })
    expect(completed).toContain('끝남')
    expect(completed).not.toContain('남음')
    expect(completed).toContain('완료 1건 · 미완료 0건')
    const pending = buildSummaryMarkdown(makeCtx(tasks), { ...week, status: 'pending' })
    expect(pending).toContain('남음')
    expect(pending).not.toContain('끝남')
    expect(pending).toContain('완료 0건 · 미완료 1건')
  })

  test('project filter limits the report to the chosen projects', () => {
    const tasks = [
      makeTask({ title: '집안일', projectId: INBOX_ID, status: 'done', completedAt: at(10, 22) }),
      makeTask({ title: '회의', projectId: 'work', status: 'done', completedAt: at(10, 22) }),
    ]
    const md = buildSummaryMarkdown(makeCtx(tasks), { ...week, projectIds: ['work'] })
    expect(md).toContain('## 업무')
    expect(md).not.toContain('받은편지함')
    expect(md).not.toContain('집안일')
    expect(buildSummaryMarkdown(makeCtx(tasks), { ...week, projectIds: [] })).toContain('해당하는 작업이 없습니다.')
  })

  test('skips canceled, trashed and completion-less tasks', () => {
    const tasks = [
      makeTask({ title: '취소', status: 'canceled', completedAt: at(10, 22), startDate: '2026-10-22' }),
      makeTask({ title: '휴지통', status: 'done', completedAt: at(10, 22), deletedAt: 5 }),
      makeTask({ title: '시각 없음', status: 'done', completedAt: null }),
    ]
    const md = buildSummaryMarkdown(makeCtx(tasks), week)
    expect(md).toBe('기간: 2026-10-19 ~ 2026-10-25 · 완료 0건 · 미완료 0건\n\n해당하는 작업이 없습니다.')
  })

  test('a subtask whose parent is not in the report is listed at the top level', () => {
    const tasks = [
      makeTask({ id: 'p', title: '부모', startDate: '2026-12-01' }),
      makeTask({ id: 'k', title: '자식', parentId: 'p', startDate: '2026-10-22' }),
    ]
    const md = buildSummaryMarkdown(makeCtx(tasks), week)
    expect(md).toContain('\n- [ ] 자식 (10/22)')
    expect(md).not.toContain('부모')
  })

  test('swaps a reversed range and normalises multi-line titles', () => {
    const t = makeTask({ title: '  줄바꿈\n있는   제목  ', status: 'done', completedAt: at(10, 22) })
    const md = buildSummaryMarkdown(makeCtx([t]), { ...week, from: '2026-10-25', to: '2026-10-19' })
    expect(md.split('\n')[0]).toBe('기간: 2026-10-19 ~ 2026-10-25 · 완료 1건 · 미완료 0건')
    expect(md).toContain('- [x] 줄바꿈 있는 제목 (10/22)')
  })

  test('falls back for blank titles and unknown projects', () => {
    const tasks = [
      makeTask({ title: '   ', projectId: INBOX_ID, status: 'done', completedAt: at(10, 22) }),
      makeTask({ title: '길 잃음', projectId: 'gone', status: 'done', completedAt: at(10, 22) }),
    ]
    const md = buildSummaryMarkdown(makeCtx(tasks, []), week)
    expect(md).toContain('## 받은편지함\n- [x] (제목 없음) (10/22)')
    expect(md).toContain('## 프로젝트 없음\n- [x] 길 잃음 (10/22)')
  })

  test('formats single-digit months and days without padding', () => {
    const t = makeTask({ title: '새해', status: 'done', completedAt: new Date(2027, 0, 5, 9).getTime() })
    const md = buildSummaryMarkdown(makeCtx([t]), { ...week, from: '2027-01-01', to: '2027-01-07' })
    expect(md).toContain('- [x] 새해 (1/5)')
  })

  test('reports an empty period', () => {
    expect(buildSummaryMarkdown(makeCtx([]), week)).toBe(
      '기간: 2026-10-19 ~ 2026-10-25 · 완료 0건 · 미완료 0건\n\n해당하는 작업이 없습니다.',
    )
  })

  test('does not mutate the context tasks', () => {
    const tasks = [makeTask({ id: 'a', status: 'done', completedAt: at(10, 22) })]
    const snapshot = JSON.stringify(tasks)
    buildSummaryMarkdown(makeCtx(tasks), week)
    expect(JSON.stringify(tasks)).toBe(snapshot)
  })
})
