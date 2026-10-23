import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useApp } from '../../store/app'
import { makeLabel, makeProject, makeSection, makeTask } from '../../test/factories'
import { renderApp, resetApp } from '../../test/render'
import { DetailPanel } from './DetailPanel'

// 상세 패널의 필드(우선순위·마감·예상 시간·프로젝트·라벨·날짜·설명)를 사용자가 바꾸는 흐름

beforeEach(async () => {
  await resetApp()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-23T09:00:00'))
})

afterEach(() => {
  vi.useRealTimers()
})

const stored = () => useApp.getState().entities.tasks.a

function openPanel(overrides: Parameters<typeof makeTask>[0] = {}) {
  const { entities } = useApp.getState()
  useApp.getState().commit(
    {
      puts: {
        tasks: [makeTask({ id: 'a', title: '보고서 쓰기', ...overrides })],
        projects: [makeProject({ id: 'w', name: '업무' })],
        sections: [makeSection({ id: 's1', projectId: 'w', name: '이번 주', order: 1 })],
        labels: [makeLabel({ id: 'l1', name: '집중', order: 1 }), ...Object.values(entities.labels)],
      },
      deletes: {},
    },
    'seed',
    { history: false },
  )
  return renderApp(<DetailPanel />, '/inbox?task=a')
}

describe('DetailPanel fields', () => {
  test('changes the priority from the field menu', async () => {
    const user = userEvent.setup()
    openPanel()

    await user.click(screen.getByRole('button', { name: '우선순위 없음' }))
    await user.click(await screen.findByRole('menuitem', { name: /우선순위 1/ }))

    expect(stored().priority).toBe(1)
    expect(screen.getByRole('button', { name: '우선순위 1' })).toBeInTheDocument()
  })

  test('sets and clears the due date', async () => {
    const user = userEvent.setup()
    openPanel()

    fireEvent.change(screen.getByLabelText('마감일'), { target: { value: '2026-11-01' } })
    await waitFor(() => expect(stored().dueDate).toBe('2026-11-01'))

    await user.click(screen.getByRole('button', { name: '마감일 지우기' }))
    await waitFor(() => expect(stored().dueDate).toBeNull())
    expect(screen.queryByRole('button', { name: '마감일 지우기' })).not.toBeInTheDocument()
  })

  describe('estimate', () => {
    test('a preset chip toggles the estimate on and off', async () => {
      const user = userEvent.setup()
      openPanel()

      await user.click(screen.getByRole('button', { name: '30분' }))
      expect(stored().estimateMin).toBe(30)
      expect(screen.getByLabelText('예상 시간(분)')).toHaveValue(30)

      await user.click(screen.getByRole('button', { name: '30분' }))
      expect(stored().estimateMin).toBeNull()
    })

    test('typing minutes sets the estimate and emptying the field clears it', async () => {
      const user = userEvent.setup()
      openPanel()
      const input = screen.getByLabelText('예상 시간(분)')

      await user.type(input, '45')
      expect(stored().estimateMin).toBe(45)

      await user.clear(input)
      expect(stored().estimateMin).toBeNull()
    })
  })

  test('moves the task to another project and then into one of its sections', async () => {
    const user = userEvent.setup()
    openPanel()

    await user.click(screen.getByRole('button', { name: '받은편지함' }))
    await user.click(await screen.findByRole('menuitem', { name: '업무' }))
    expect(stored().projectId).toBe('w')

    await user.click(screen.getByRole('button', { name: '업무' }))
    await user.click(await screen.findByRole('menuitem', { name: /이번 주/ }))
    expect(stored()).toMatchObject({ projectId: 'w', sectionId: 's1' })
    expect(screen.getByRole('button', { name: '업무 / 이번 주' })).toBeInTheDocument()
  })

  test('attaches an existing label', async () => {
    const user = userEvent.setup()
    openPanel()

    await user.click(screen.getByRole('button', { name: '라벨' }))
    await user.click(await screen.findByRole('checkbox', { name: /집중/ }))

    expect(stored().labelIds).toEqual(['l1'])
    expect(screen.getByRole('button', { name: '집중' })).toBeInTheDocument()
  })

  test('schedules the task from the date popover', async () => {
    const user = userEvent.setup()
    openPanel()

    await user.click(screen.getByRole('button', { name: '날짜 없음' }))
    await user.click(await screen.findByRole('button', { name: '내일' }))

    expect(stored()).toMatchObject({ startDate: '2026-10-24', someday: false })
  })

  describe('description', () => {
    test('clicking the placeholder opens an editor and leaving the field saves the text', async () => {
      const user = userEvent.setup()
      openPanel()

      await user.click(screen.getByRole('button', { name: /설명 추가/ }))
      await user.type(screen.getByLabelText('설명'), '**중요** 메모')
      await user.click(screen.getByLabelText('제목'))

      await waitFor(() => expect(stored().description).toBe('**중요** 메모'))
      expect(screen.getByText('중요').tagName).toBe('STRONG')
    })
  })
})
