import { act, renderHook } from '@testing-library/react'
import { addDays, todayOf } from '../domain/date'
import type { RecurrenceRule, Task } from '../domain/types'
import { useApp } from '../store/app'
import { useUI } from '../store/ui'
import { makeTask } from '../test/factories'
import { resetApp } from '../test/render'
import { useToasts } from '../ui/toast'
import { useTaskActions } from './actions'

const daily: RecurrenceRule = { freq: 'daily', interval: 1, anchor: 'due', end: { type: 'never' }, resetSubtasks: false }
const today = () => todayOf(new Date(), 0)

beforeEach(async () => {
  await resetApp()
  useToasts.setState({ toasts: [] })
  useUI.setState({ lingering: {} })
  hooks = renderHook(() => useTaskActions()).result.current
})

function seed(...tasks: Partial<Task>[]): void {
  const made = tasks.map((t, i) => makeTask({ id: `t${i}`, title: `할 일 ${i}`, order: (i + 1) * 1000, ...t }))
  useApp.getState().commit({ puts: { tasks: made }, deletes: {} }, 'seed', { history: false })
}

let hooks: ReturnType<typeof useTaskActions>
const task = (id: string) => useApp.getState().entities.tasks[id]
const lastToast = () => useToasts.getState().toasts.at(-1)

describe('useTaskActions', () => {
  test('completeMany completes every task with one undo step and one toast', () => {
    seed({}, {}, {})
    const before = useApp.getState().undoStack.length

    act(() => hooks.completeMany(['t0', 't1', 't2']))

    expect(['t0', 't1', 't2'].map((id) => task(id).status)).toEqual(['done', 'done', 'done'])
    expect(useApp.getState().undoStack).toHaveLength(before + 1)
    expect(useToasts.getState().toasts).toHaveLength(1)
    expect(lastToast()).toMatchObject({ message: '3개를 완료했어요', actionLabel: '되돌리기' })

    act(() => lastToast()?.onAction?.())

    expect(['t0', 't1', 't2'].map((id) => task(id).status)).toEqual(['todo', 'todo', 'todo'])
  })

  test('completing a plain task toasts and keeps the row lingering, undo reopens it', () => {
    seed({})

    act(() => hooks.complete('t0'))

    expect(task('t0').status).toBe('done')
    expect(lastToast()?.message).toBe('완료했어요')
    expect(useUI.getState().lingering).toHaveProperty('t0')

    act(() => lastToast()?.onAction?.())
    expect(task('t0').status).toBe('todo')
  })

  test('completing a recurring task moves it to the next occurrence and says so', () => {
    seed({ startDate: today(), recurrence: daily })

    act(() => hooks.complete('t0'))

    expect(task('t0')).toMatchObject({ status: 'todo', startDate: addDays(today(), 1) })
    expect(lastToast()?.message).toBe('다음 회차로 넘겼어요')
    expect(useUI.getState().lingering).not.toHaveProperty('t0')
  })

  test('skip moves a recurring task past this occurrence', () => {
    seed({ startDate: today(), recurrence: daily })

    act(() => hooks.skip('t0'))

    expect(task('t0').startDate).toBe(addDays(today(), 1))
    expect(lastToast()?.message).toBe('이번 회차를 건너뛰었어요')
  })

  test('remove sends tasks to the trash and the undo toast brings them back', () => {
    seed({}, {})

    act(() => hooks.remove(['t0']))
    expect(task('t0').deletedAt).not.toBeNull()
    expect(lastToast()?.message).toBe('휴지통으로 옮겼어요')
    act(() => lastToast()?.onAction?.())
    expect(task('t0').deletedAt).toBeNull()

    act(() => hooks.remove(['t0', 't1']))
    expect(lastToast()?.message).toBe('2개를 휴지통으로 옮겼어요')
    expect(task('t1').deletedAt).not.toBeNull()
  })

  test('restore, purge and emptyTrash manage trashed tasks', () => {
    seed({}, {}, {})
    act(() => hooks.remove(['t0', 't1', 't2']))

    act(() => hooks.restore('t0'))
    expect(task('t0').deletedAt).toBeNull()

    act(() => hooks.purge(['t1']))
    expect(task('t1')).toBeUndefined()

    act(() => hooks.emptyTrash())
    expect(task('t2')).toBeUndefined()
    expect(task('t0')).toBeDefined()
  })

  test('cancel marks the plan canceled and reopen brings it back', () => {
    seed({})

    act(() => hooks.cancel('t0'))
    expect(task('t0').status).toBe('canceled')
    expect(lastToast()?.message).toBe('계획을 취소했어요')

    act(() => hooks.reopen('t0'))
    expect(task('t0').status).toBe('todo')
  })

  test('add, patch and patchMany write through the store with undo history', () => {
    seed({}, {})

    let added!: Task
    act(() => {
      added = hooks.add({ title: '새 일' })
    })
    expect(task(added.id).title).toBe('새 일')

    act(() => hooks.patch('t0', { priority: 1 }))
    act(() => hooks.patchMany(['t0', 't1'], { priority: 2 }, '우선순위 일괄'))
    expect([task('t0').priority, task('t1').priority]).toEqual([2, 2])
    expect(useApp.getState().undoStack.at(-1)?.label).toBe('우선순위 일괄')
  })

  test('duplicate, move, indent, outdent and postpone change the task tree and dates', () => {
    seed({}, {})

    const copy: { id: string | null } = { id: null }
    act(() => {
      copy.id = hooks.duplicate('t0')
    })
    expect(copy.id).not.toBeNull()
    expect(task(copy.id as string)).toBeDefined()

    act(() => hooks.indent('t1'))
    expect(task('t1').parentId).toBe('t0')
    act(() => hooks.outdent('t1'))
    expect(task('t1').parentId).toBeNull()

    act(() => hooks.move('t1', { projectId: 'inbox', sectionId: null, parentId: 't0' }))
    expect(task('t1').parentId).toBe('t0')

    act(() => hooks.postpone('t0', '2030-01-01'))
    expect(task('t0')).toMatchObject({ startDate: '2030-01-01', postponeCount: 1 })
  })
})
