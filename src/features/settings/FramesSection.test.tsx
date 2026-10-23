import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useApp } from '../../store/app'
import { makeLabel } from '../../test/factories'
import { resetApp } from '../../test/render'
import { renderSettings } from './testKit'

beforeEach(async () => {
  await resetApp()
})

const frames = () => useApp.getState().settings.frames

const seedLabel = (): void => {
  useApp.getState().commit({ puts: { labels: [makeLabel({ id: 'L1', name: '딥워크' })] }, deletes: {} }, 'seed', {
    history: false,
  })
}

describe('시간대 템플릿 설정(F12)', () => {
  test('처음에는 추천 조합으로 시작할 수 있다', async () => {
    const user = userEvent.setup()
    renderSettings('general')

    await user.click(await screen.findByRole('button', { name: '딥워크·잡무로 시작하기' }))

    await waitFor(() => expect(frames().map((f) => f.name)).toEqual(['딥워크', '잡무']))
    expect(frames()[0]?.match.minMinutes).toBe(60)
    expect(frames()[1]?.match.priorities).toEqual([3, 4])
  })

  test('시간대를 더하고 이름·시각을 바꾸면 바로 저장된다', async () => {
    const user = userEvent.setup()
    renderSettings('general')

    await user.click(await screen.findByRole('button', { name: /시간대 추가/ }))
    await waitFor(() => expect(frames()).toHaveLength(1))

    const nameField = screen.getByLabelText('시간대 이름')
    await user.clear(nameField)
    await user.type(nameField, '새벽')

    await waitFor(() => expect(frames()[0]?.name).toBe('새벽'))
  })

  test('요일과 조건을 켜고 끌 수 있다', async () => {
    const user = userEvent.setup()
    seedLabel()
    renderSettings('general')

    await user.click(await screen.findByRole('button', { name: /시간대 추가/ }))
    await waitFor(() => expect(frames()).toHaveLength(1))

    await user.click(screen.getByRole('button', { name: 'P1' }))
    await waitFor(() => expect(frames()[0]?.match.priorities).toEqual([1]))

    await user.click(screen.getByRole('button', { name: '@딥워크' }))
    await waitFor(() => expect(frames()[0]?.match.labelIds).toEqual(['L1']))

    const days = screen.getByRole('group', { name: /요일/ })
    await user.click(within(days).getByRole('button', { name: '월' }))
    await waitFor(() => expect(frames()[0]?.days).toEqual([2, 3, 4, 5]))
  })

  test('조건 요약을 사람 말로 보여 준다', async () => {
    const user = userEvent.setup()
    renderSettings('general')

    await user.click(await screen.findByRole('button', { name: /시간대 추가/ }))

    expect(await screen.findByText(/여기에 넣을 일: 모든 일/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'P2' }))
    expect(await screen.findByText(/여기에 넣을 일: P2/)).toBeInTheDocument()
  })

  test('쓸모 없는 시간대는 이유를 알려 준다', async () => {
    const user = userEvent.setup()
    renderSettings('general')

    await user.click(await screen.findByRole('button', { name: /시간대 추가/ }))
    await waitFor(() => expect(frames()).toHaveLength(1))

    const days = screen.getByRole('group', { name: /요일/ })
    for (const label of ['월', '화', '수', '목', '금']) {
      await user.click(within(days).getByRole('button', { name: label }))
    }

    expect(await screen.findByText(/쓰는 요일이 없어서/)).toBeInTheDocument()
  })

  test('시간대를 지울 수 있다', async () => {
    const user = userEvent.setup()
    renderSettings('general')

    await user.click(await screen.findByRole('button', { name: /시간대 추가/ }))
    await waitFor(() => expect(frames()).toHaveLength(1))

    await user.click(screen.getByRole('button', { name: /새 시간대 삭제/ }))

    await waitFor(() => expect(frames()).toEqual([]))
  })
})
