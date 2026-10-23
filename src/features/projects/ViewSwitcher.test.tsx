import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'
import type { ProjectView } from '../../domain/types'
import { useApp } from '../../store/app'
import { renderApp, resetApp } from '../../test/render'
import { useProjectView, ViewSwitcher } from './ViewSwitcher'

beforeEach(async () => {
  await resetApp()
})

function Page({ fallback = 'list' }: { fallback?: ProjectView }) {
  const current = useProjectView(fallback)
  const { search } = useLocation()
  return (
    <>
      <ViewSwitcher current={current} fallback={fallback} />
      <output aria-label="주소 검색어">{search}</output>
      <output aria-label="현재 보기">{current}</output>
    </>
  )
}

const search = () => screen.getByLabelText('주소 검색어').textContent
const current = () => screen.getByLabelText('현재 보기').textContent
const tabs = () => screen.getAllByRole('tab').map((t) => t.textContent)

describe('ViewSwitcher', () => {
  test('lists every view and marks the current one', () => {
    renderApp(<Page />)

    expect(tabs()).toEqual(['목록', '칸반', '캘린더', '타임라인', '매트릭스'])
    expect(screen.getByRole('tab', { name: '목록' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '칸반' })).toHaveAttribute('aria-selected', 'false')
  })

  test('hides the views whose module is switched off in settings', () => {
    const { settings } = useApp.getState()
    useApp.setState({ settings: { ...settings, modules: { ...settings.modules, calendar: false, timeline: false } } })

    renderApp(<Page />)

    expect(tabs()).toEqual(['목록', '칸반', '매트릭스'])
  })

  test('switching puts the view in the address and keeps the other parameters', async () => {
    const user = userEvent.setup()
    renderApp(<Page />, '/project/p1?task=a')

    await user.click(screen.getByRole('tab', { name: '칸반' }))

    expect(search()).toBe('?task=a&view=board')
    expect(current()).toBe('board')
    expect(screen.getByRole('tab', { name: '칸반' })).toHaveAttribute('aria-selected', 'true')
  })

  test('going back to the default view removes the parameter again', async () => {
    const user = userEvent.setup()
    renderApp(<Page />, '/project/p1?view=calendar')
    expect(current()).toBe('calendar')

    await user.click(screen.getByRole('tab', { name: '목록' }))

    expect(search()).toBe('')
    expect(current()).toBe('list')
  })

  test('the default view depends on the fallback the page passes in', async () => {
    const user = userEvent.setup()
    renderApp(<Page fallback="board" />, '/project/p1')
    expect(current()).toBe('board')

    await user.click(screen.getByRole('tab', { name: '목록' }))
    expect(search()).toBe('?view=list')

    await user.click(screen.getByRole('tab', { name: '칸반' }))
    expect(search()).toBe('')
  })

  test('an unknown view in the address falls back to the default', () => {
    renderApp(<Page />, '/project/p1?view=gantt')
    expect(current()).toBe('list')
  })
})
