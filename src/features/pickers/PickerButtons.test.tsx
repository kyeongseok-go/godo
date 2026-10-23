import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import type { ID, Priority } from '../../domain/types'
import { useApp } from '../../store/app'
import { makeLabel, makeProject, makeSection } from '../../test/factories'
import { renderApp, resetApp } from '../../test/render'
import { LabelButton, PriorityButton, ProjectButton } from './PickerButtons'

beforeEach(async () => {
  await resetApp()
})

const seed = (puts: Parameters<ReturnType<typeof useApp.getState>['commit']>[0]['puts']) =>
  useApp.getState().commit({ puts, deletes: {} }, 'seed', { history: false })
const labels = () => Object.values(useApp.getState().entities.labels)

describe('PriorityButton', () => {
  function Harness({ variant }: { variant?: 'chip' | 'field' }) {
    const [value, setValue] = useState<Priority>(4)
    return <PriorityButton value={value} variant={variant} onChange={setValue} />
  }

  test('shows a short label while unset and the chosen priority afterwards', async () => {
    const user = userEvent.setup()
    renderApp(<Harness />)
    expect(screen.getByRole('button', { name: '우선순위' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '우선순위' }))
    await user.click(await screen.findByRole('menuitem', { name: /우선순위 2/ }))

    expect(screen.getByRole('button', { name: '우선순위 2' })).toHaveAttribute('data-set', 'true')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  test('the field variant always spells the priority out', () => {
    renderApp(<Harness variant="field" />)
    expect(screen.getByRole('button', { name: '우선순위 없음' })).toBeInTheDocument()
  })

  test('marks the current priority as selected in the menu', async () => {
    const user = userEvent.setup()
    renderApp(<PriorityButton value={1} onChange={() => {}} />)

    await user.click(screen.getByRole('button', { name: '우선순위 1' }))

    expect(await screen.findByRole('menuitem', { name: /우선순위 1/ })).toHaveAttribute('data-selected', 'true')
    expect(screen.getByRole('menuitem', { name: /우선순위 3/ })).not.toHaveAttribute('data-selected', 'true')
  })
})

describe('ProjectButton', () => {
  test('lists the inbox, nested projects without folders, and only the current project sections', async () => {
    const user = userEvent.setup()
    seed({
      projects: [
        makeProject({ id: 'f', name: '회사', isFolder: true, order: 1 }),
        makeProject({ id: 'w', name: '업무', parentId: 'f', order: 1 }),
        makeProject({ id: 'h', name: '집안일', order: 2 }),
      ],
      sections: [
        makeSection({ id: 's2', projectId: 'w', name: '다음 주', order: 2 }),
        makeSection({ id: 's1', projectId: 'w', name: '이번 주', order: 1 }),
        makeSection({ id: 's3', projectId: 'h', name: '청소', order: 1 }),
      ],
    })
    renderApp(<ProjectButton projectId="w" sectionId={null} onChange={() => {}} />)

    await user.click(screen.getByRole('button', { name: '업무' }))

    const labelsShown = (await screen.findAllByRole('menuitem')).map((i) => i.textContent)
    expect(labelsShown).toEqual(['받은편지함', '· 업무', '· · / 이번 주', '· · / 다음 주', '집안일'])
  })

  test('reports the project and section that were picked', async () => {
    const user = userEvent.setup()
    seed({
      projects: [makeProject({ id: 'w', name: '업무' })],
      sections: [makeSection({ id: 's1', projectId: 'w', name: '이번 주' })],
    })
    const onChange = vi.fn()
    renderApp(<ProjectButton projectId="w" sectionId={null} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '업무' }))
    await user.click(await screen.findByRole('menuitem', { name: /이번 주/ }))
    expect(onChange).toHaveBeenLastCalledWith('w', 's1')

    await user.click(screen.getByRole('button', { name: '업무' }))
    await user.click(await screen.findByRole('menuitem', { name: '받은편지함' }))
    expect(onChange).toHaveBeenLastCalledWith('inbox', null)
  })

  test('names the section next to the project', () => {
    seed({
      projects: [makeProject({ id: 'w', name: '업무' })],
      sections: [makeSection({ id: 's1', projectId: 'w', name: '이번 주' })],
    })
    renderApp(<ProjectButton projectId="w" sectionId="s1" onChange={() => {}} />)

    expect(screen.getByRole('button', { name: '업무 / 이번 주' })).toBeInTheDocument()
  })
})

describe('LabelButton', () => {
  function Harness({ initial = [] }: { initial?: ID[] }) {
    const [ids, setIds] = useState<ID[]>(initial)
    return (
      <>
        <LabelButton labelIds={ids} onChange={setIds} />
        <output aria-label="선택된 라벨 id">{ids.join(',')}</output>
      </>
    )
  }
  const chosen = () => screen.getByLabelText('선택된 라벨 id').textContent

  async function openPicker(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: '라벨' }))
    return screen.findByPlaceholderText('라벨 검색 또는 새로 만들기')
  }

  beforeEach(() => {
    seed({
      labels: [
        makeLabel({ id: 'l1', name: '집중', order: 1 }),
        makeLabel({ id: 'l2', name: '집안', order: 2 }),
        makeLabel({ id: 'l3', name: 'Work', order: 3 }),
      ],
    })
  })

  test('toggles labels with the checkboxes and names them on the button', async () => {
    const user = userEvent.setup()
    renderApp(<Harness />)
    await openPicker(user)

    await user.click(screen.getByRole('checkbox', { name: /집중/ }))
    await user.click(screen.getByRole('checkbox', { name: /Work/ }))
    expect(chosen()).toBe('l1,l3')
    expect(screen.getByRole('button', { name: '집중, Work' })).toHaveAttribute('data-set', 'true')

    await user.click(screen.getByRole('checkbox', { name: /집중/ }))
    expect(chosen()).toBe('l3')
  })

  test('filters by name ignoring case and a leading @ or #', async () => {
    const user = userEvent.setup()
    renderApp(<Harness />)
    const search = await openPicker(user)

    await user.type(search, '@work')
    expect(screen.getAllByRole('checkbox').map((c) => c.closest('label')?.textContent)).toEqual(['Work'])

    await user.clear(search)
    await user.type(search, '#집')
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
  })

  test('Enter toggles the first match instead of creating a new label', async () => {
    const user = userEvent.setup()
    renderApp(<Harness />)
    const search = await openPicker(user)

    await user.type(search, '집{Enter}')

    expect(chosen()).toBe('l1')
    expect(labels()).toHaveLength(3)
  })

  test('Enter on a name nobody has yet creates the label and selects it', async () => {
    const user = userEvent.setup()
    renderApp(<Harness />)
    const search = await openPicker(user)

    await user.type(search, '독서{Enter}')

    await waitFor(() => expect(labels().map((l) => l.name)).toContain('독서'))
    const created = labels().find((l) => l.name === '독서')
    expect(chosen()).toBe(created?.id)
    expect(search).toHaveValue('')
  })

  test('ignores Enter while a Korean syllable is still being composed', async () => {
    const user = userEvent.setup()
    renderApp(<Harness />)
    const search = await openPicker(user)
    await user.type(search, '독서')

    fireEvent.keyDown(search, { key: 'Enter', isComposing: true })

    expect(labels()).toHaveLength(3)
    expect(chosen()).toBe('')
  })

  test('offers “만들기” for a partial match but not for an exact one', async () => {
    const user = userEvent.setup()
    renderApp(<Harness />)
    const search = await openPicker(user)

    await user.type(search, '집')
    await user.click(screen.getByRole('button', { name: /“집” 만들기/ }))
    await waitFor(() => expect(labels().map((l) => l.name)).toContain('집'))
    expect(chosen()).toBe(labels().find((l) => l.name === '집')?.id)

    expect(search).toHaveValue('')
    await user.type(search, '집중')
    expect(screen.queryByRole('button', { name: /만들기/ })).not.toBeInTheDocument()
  })

  test('shows labels that are already attached', async () => {
    const user = userEvent.setup()
    renderApp(<Harness initial={['l2']} />)

    await user.click(screen.getByRole('button', { name: '집안' }))

    const popover = await screen.findByRole('dialog', { name: '라벨 선택' })
    expect(within(popover).getByRole('checkbox', { name: /집안/ })).toBeChecked()
  })
})
