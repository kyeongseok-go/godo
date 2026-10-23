import { makeTask } from '../../test/factories'
import { pickableTasks } from './taskPick'

const TODAY = '2026-03-05'

describe('pickableTasks', () => {
  test('keeps only open tasks that are not in the trash', () => {
    const tasks = [
      makeTask({ id: 'a', title: '열림' }),
      makeTask({ id: 'b', title: '진행', status: 'active' }),
      makeTask({ id: 'c', title: '완료', status: 'done' }),
      makeTask({ id: 'd', title: '취소', status: 'canceled' }),
      makeTask({ id: 'e', title: '휴지통', deletedAt: 1 }),
    ]
    expect(pickableTasks(tasks, '', TODAY).map((t) => t.id)).toEqual(['a', 'b'])
  })

  test('filters by title ignoring case and surrounding spaces', () => {
    const tasks = [makeTask({ id: 'a', title: 'Write Report' }), makeTask({ id: 'b', title: '운동' })]
    expect(pickableTasks(tasks, '  report ', TODAY).map((t) => t.id)).toEqual(['a'])
    expect(pickableTasks(tasks, '없음', TODAY)).toEqual([])
  })

  test("puts today's tasks first, then higher priority, then manual order", () => {
    const tasks = [
      makeTask({ id: 'late', priority: 1, order: 1 }),
      makeTask({ id: 'todayLow', priority: 4, startDate: TODAY, order: 9 }),
      makeTask({ id: 'todayHigh', priority: 2, dueDate: TODAY, order: 5 }),
      makeTask({ id: 'plain', priority: 4, order: 0 }),
    ]
    expect(pickableTasks(tasks, '', TODAY).map((t) => t.id)).toEqual(['todayHigh', 'todayLow', 'late', 'plain'])
  })

  test('limits the result and does not change the input array', () => {
    const tasks = Array.from({ length: 12 }, (_, i) => makeTask({ id: `t${i}`, order: 12 - i }))
    const copy = [...tasks]
    expect(pickableTasks(tasks, '', TODAY, 5)).toHaveLength(5)
    expect(pickableTasks(tasks, '', TODAY, 0)).toEqual([])
    expect(tasks).toEqual(copy)
  })
})
