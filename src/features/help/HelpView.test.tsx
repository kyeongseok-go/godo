import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'
import guide from '../../../docs/GUIDE.md?raw'
import { renderApp } from '../../test/render'
import { HelpView } from './HelpView'
import { splitGuide } from './sections'

const sections = splitGuide(guide)

function Help() {
  const { search } = useLocation()
  return (
    <>
      <p data-testid="search">{search}</p>
      <HelpView />
    </>
  )
}

const toc = () => screen.getByRole('navigation', { name: '가이드 목차' })
const article = () => screen.getByRole('heading', { level: 2 })
const search = () => screen.getByTestId('search').textContent
const pager = () => article().closest('article')?.querySelector('footer') as HTMLElement

describe('HelpView', () => {
  test('opens on the first chapter with every chapter in the table of contents', () => {
    renderApp(<Help />, '/help')

    expect(article()).toHaveTextContent(sections[0].title)
    expect(within(toc()).getAllByRole('button')).toHaveLength(sections.length)
    expect(within(toc()).getByRole('button', { name: sections[0].title })).toHaveAttribute('aria-current', 'page')
  })

  test('shows the chapter named in the address', () => {
    renderApp(<Help />, '/help?ch=2')

    expect(article()).toHaveTextContent(sections[2].title)
    expect(within(toc()).getByRole('button', { name: sections[2].title })).toHaveAttribute('aria-current', 'page')
  })

  test('falls back to the first chapter for an unknown chapter id', () => {
    renderApp(<Help />, '/help?ch=999')

    expect(article()).toHaveTextContent(sections[0].title)
  })

  test('choosing a chapter from the table of contents puts it in the address', async () => {
    const user = userEvent.setup()
    renderApp(<Help />, '/help')

    await user.click(within(toc()).getByRole('button', { name: sections[3].title }))

    expect(search()).toBe('?ch=3')
    expect(article()).toHaveTextContent(sections[3].title)
  })

  test('the chapter select works the same way and going back to the first chapter clears the address', async () => {
    const user = userEvent.setup()
    renderApp(<Help />, '/help?ch=2')

    await user.selectOptions(screen.getByRole('combobox', { name: '장 선택' }), sections[4].id)
    expect(search()).toBe('?ch=4')

    await user.selectOptions(screen.getByRole('combobox', { name: '장 선택' }), '0')
    expect(search()).toBe('')
    expect(article()).toHaveTextContent(sections[0].title)
  })

  test('the pager moves to the neighbouring chapters', async () => {
    const user = userEvent.setup()
    renderApp(<Help />, '/help?ch=2')

    await user.click(within(pager()).getByRole('button', { name: sections[3].title }))
    expect(article()).toHaveTextContent(sections[3].title)

    await user.click(within(pager()).getByRole('button', { name: sections[2].title }))
    expect(article()).toHaveTextContent(sections[2].title)
  })

  test('has no previous button on the first chapter and no next button on the last', () => {
    const first = renderApp(<Help />, '/help')
    expect(within(pager()).getAllByRole('button')).toHaveLength(1)
    first.unmount()

    renderApp(<Help />, `/help?ch=${sections.length - 1}`)
    expect(within(pager()).getAllByRole('button')).toHaveLength(1)
    expect(within(pager()).getByRole('button')).toHaveTextContent(sections[sections.length - 2].title)
  })

  test('renders the chapter body as formatted text', () => {
    renderApp(<Help />, '/help')

    expect(article().closest('article')?.textContent?.length).toBeGreaterThan(sections[0].title.length + 20)
  })
})
