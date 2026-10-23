import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { installHiddenPanelFocusShim } from '../test/focusShim'
import { focusInsidePanel, Popover } from './Popover'

installHiddenPanelFocusShim()

function Harness({ children, label = '시험 팝오버' }: { children: ReactNode; label?: string }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  return (
    <>
      <button ref={ref} type="button" onClick={() => setOpen(true)}>
        열기
      </button>
      <Popover open={open} anchorRef={ref} onClose={() => setOpen(false)} label={label}>
        {children}
      </Popover>
    </>
  )
}

const openIt = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: '열기' }))
  return screen.findByRole('dialog', { name: '시험 팝오버' })
}

describe('focusInsidePanel', () => {
  function panelWith(html: string): HTMLElement {
    const panel = document.createElement('div')
    panel.tabIndex = -1
    panel.innerHTML = html
    document.body.append(panel)
    return panel
  }

  test('prefers the element marked data-autofocus', () => {
    const panel = panelWith('<button>먼저</button><input data-autofocus aria-label="고른 칸" />')

    const moved = focusInsidePanel(panel)

    expect(moved).toBe(panel.querySelector('input'))
    expect(panel.querySelector('input')).toHaveFocus()
  })

  test('falls back to the first element that can take focus', () => {
    const panel = panelWith('<span>글자</span><button>첫 버튼</button><button>둘째</button>')

    focusInsidePanel(panel)

    expect(screen.getByRole('button', { name: '첫 버튼' })).toHaveFocus()
  })

  test('falls back to the panel itself when nothing inside can take focus', () => {
    const panel = panelWith('<p>읽을 것만 있어요</p>')

    expect(focusInsidePanel(panel)).toBe(panel)
    expect(panel).toHaveFocus()
  })

  test('does nothing without a panel', () => {
    expect(focusInsidePanel(null)).toBeNull()
  })
})

describe('Popover focus', () => {
  test('moves focus into the panel once it is positioned and visible', async () => {
    const user = userEvent.setup()
    render(
      <Harness>
        <input data-autofocus aria-label="검색" />
      </Harness>,
    )

    await openIt(user)

    expect(screen.getByLabelText('검색')).toHaveFocus()
  })

  test('focuses the first focusable child when nothing is marked', async () => {
    const user = userEvent.setup()
    render(
      <Harness>
        <button type="button">첫 항목</button>
        <button type="button">둘째 항목</button>
      </Harness>,
    )

    await openIt(user)

    expect(screen.getByRole('button', { name: '첫 항목' })).toHaveFocus()
  })

  test('focuses the panel itself when it holds nothing focusable', async () => {
    const user = userEvent.setup()
    render(
      <Harness>
        <p>안내문</p>
      </Harness>,
    )

    const panel = await openIt(user)

    expect(panel).toHaveFocus()
  })

  test('Escape closes the popover and gives focus back to the anchor', async () => {
    const user = userEvent.setup()
    render(
      <Harness>
        <input data-autofocus aria-label="검색" />
      </Harness>,
    )
    await openIt(user)

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: '시험 팝오버' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '열기' })).toHaveFocus()
  })

  test('still portals into the dialog the anchor lives in', async () => {
    const user = userEvent.setup()
    render(
      <dialog open aria-label="바깥 대화상자">
        <Harness>
          <button type="button">항목</button>
        </Harness>
      </dialog>,
    )

    const panel = await openIt(user)

    expect(panel.closest('dialog')).toBe(screen.getByRole('dialog', { name: '바깥 대화상자' }))
  })
})
