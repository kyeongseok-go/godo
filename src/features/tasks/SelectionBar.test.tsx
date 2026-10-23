import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react'
import { useApp } from '../../store/app'
import { useUI } from '../../store/ui'
import { useToasts } from '../../ui/toast'
import { makeTask } from '../../test/factories'
import { renderApp, resetApp } from '../../test/render'
import { SelectionBar } from './SelectionBar'

// 오늘은 2026-10-23(금), 한 주는 월요일에 시작한다.
beforeEach(async () => {
  await resetApp()
  useToasts.setState({ toasts: [] })
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-23T09:00:00'))
})

afterEach(() => {
  vi.useRealTimers()
})

const task = (id: string) => useApp.getState().entities.tasks[id]
const selected = () => useUI.getState().selectedIds

function setup(selection: string[] = ['a', 'b']) {
  useApp.getState().commit(
    {
      puts: {
        tasks: [
          makeTask({ id: 'a', title: '가', startDate: '2026-10-30', startTime: '10:00', dayPart: null }),
          makeTask({ id: 'b', title: '나', priority: 2 }),
          makeTask({ id: 'c', title: '다' }),
        ],
      },
      deletes: {},
    },
    'seed',
    { history: false },
  )
  act(() => useUI.getState().selectRange(selection))
  return renderApp(<SelectionBar />)
}

describe('SelectionBar', () => {
  test('renders nothing while no task is selected', () => {
    setup([])
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
  })

  test('shows how many tasks are selected and clears the selection with the x button', async () => {
    const user = userEvent.setup()
    setup()
    expect(screen.getByRole('toolbar', { name: '선택한 할 일 작업' })).toHaveTextContent('2개 선택')

    await user.click(screen.getByRole('button', { name: '선택 해제' }))

    expect(selected()).toEqual([])
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
  })

  describe('complete', () => {
    test('completes every selected task and clears the selection', async () => {
      const user = userEvent.setup()
      setup()

      await user.click(screen.getByRole('button', { name: '완료' }))

      expect([task('a').status, task('b').status, task('c').status]).toEqual(['done', 'done', 'todo'])
      expect(selected()).toEqual([])
    })

    test('is one undo step and says how many were completed', async () => {
      const user = userEvent.setup()
      setup()

      await user.click(screen.getByRole('button', { name: '완료' }))

      expect(useApp.getState().undoStack).toHaveLength(1)
      expect(useToasts.getState().toasts.at(-1)).toMatchObject({ message: '2개를 완료했어요', actionLabel: '되돌리기' })

      useApp.getState().undo()
      expect([task('a').status, task('b').status]).toEqual(['todo', 'todo'])
    })
  })

  describe('date', () => {
    test.each([
      ['오늘', '2026-10-23'],
      ['내일', '2026-10-24'],
      ['다음 주', '2026-10-26'],
    ])('“%s” schedules all selected tasks on %s', async (label, date) => {
      const user = userEvent.setup()
      setup()

      await user.click(screen.getByRole('button', { name: '날짜' }))
      await user.click(await screen.findByRole('menuitem', { name: label }))

      expect([task('a').startDate, task('b').startDate, task('c').startDate]).toEqual([date, date, null])
      expect(task('a').startTime).toBe('10:00')
      expect(selected()).toEqual([])
      expect(useApp.getState().undoStack).toHaveLength(1)
    })

    test('“날짜 지우기” also removes the time and part of the day', async () => {
      const user = userEvent.setup()
      setup()

      await user.click(screen.getByRole('button', { name: '날짜' }))
      await user.click(await screen.findByRole('menuitem', { name: '날짜 지우기' }))

      expect(task('a')).toMatchObject({ startDate: null, startTime: null, dayPart: null })
    })
  })

  describe('priority', () => {
    test('offers all four levels and applies the chosen one to every selected task', async () => {
      const user = userEvent.setup()
      setup()

      await user.click(screen.getByRole('button', { name: '우선순위' }))
      const menu = await screen.findByRole('menu')
      expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['우선순위 1', '우선순위 2', '우선순위 3', '우선순위 없음'])
      await user.click(within(menu).getByRole('menuitem', { name: '우선순위 1' }))

      expect([task('a').priority, task('b').priority, task('c').priority]).toEqual([1, 1, 4])
      expect(selected()).toEqual([])
    })

    test('“우선순위 없음” resets the priority', async () => {
      const user = userEvent.setup()
      setup()

      await user.click(screen.getByRole('button', { name: '우선순위' }))
      await user.click(await screen.findByRole('menuitem', { name: '우선순위 없음' }))

      expect(task('b').priority).toBe(4)
    })
  })

  test('delete moves the selected tasks to the trash and can be undone', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: '삭제' }))

    expect([task('a').deletedAt !== null, task('b').deletedAt !== null, task('c').deletedAt]).toEqual([true, true, null])
    expect(selected()).toEqual([])
    expect(useToasts.getState().toasts.at(-1)?.message).toBe('2개를 휴지통으로 옮겼어요')

    useApp.getState().undo()
    expect([task('a').deletedAt, task('b').deletedAt]).toEqual([null, null])
  })
})
