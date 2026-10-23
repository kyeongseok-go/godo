import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { installHiddenPanelFocusShim } from '../test/focusShim'
import { Menu } from './Menu'
import type { MenuEntry } from './Menu'

installHiddenPanelFocusShim()

function Harness({ onPick }: { onPick: (id: string) => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const entries: MenuEntry[] = [
    { kind: 'heading', id: 'h', label: '묶음' },
    { kind: 'item', id: 'one', label: '첫째', onSelect: () => onPick('one') },
    { kind: 'item', id: 'two', label: '둘째', onSelect: () => onPick('two') },
    { kind: 'separator', id: 'sep' },
    { kind: 'item', id: 'three', label: '셋째', onSelect: () => onPick('three') },
  ]
  return (
    <>
      <button ref={ref} type="button" aria-haspopup="menu" onClick={() => setOpen((v) => !v)}>
        더 보기
      </button>
      <Menu open={open} anchorRef={ref} onClose={() => setOpen(false)} entries={entries} label="시험 메뉴" />
    </>
  )
}

async function openMenu() {
  const user = userEvent.setup()
  const onPick = vi.fn()
  render(<Harness onPick={onPick} />)
  await user.click(screen.getByRole('button', { name: '더 보기' }))
  await screen.findByRole('menu')
  return { user, onPick }
}

describe('Menu keyboard', () => {
  test('hands focus to the item list when it opens', async () => {
    await openMenu()

    expect(screen.getByRole('menu')).toHaveFocus()
  })

  test('asks the popover to focus the list by marking it', async () => {
    await openMenu()

    expect(screen.getByRole('menu')).toHaveAttribute('data-autofocus')
  })

  test('arrow keys move the active item and Enter picks it', async () => {
    const { user, onPick } = await openMenu()
    expect(screen.getByRole('menuitem', { name: '첫째' })).toHaveAttribute('data-active', 'true')

    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: '둘째' })).toHaveAttribute('data-active', 'true')

    await user.keyboard('{Enter}')
    expect(onPick).toHaveBeenCalledWith('two')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  test('ArrowUp wraps around to the last item', async () => {
    const { user, onPick } = await openMenu()

    await user.keyboard('{ArrowUp}{Enter}')

    expect(onPick).toHaveBeenCalledWith('three')
  })

  test('Escape closes the menu and puts focus back on the button', async () => {
    const { user } = await openMenu()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '더 보기' })).toHaveFocus()
  })
})
