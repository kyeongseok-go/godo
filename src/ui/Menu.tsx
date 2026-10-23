import { useEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { Popover } from './Popover'

export type MenuEntry =
  | { kind: 'item'; id: string; label: string; icon?: ReactNode; hint?: string; danger?: boolean; selected?: boolean; disabled?: boolean; onSelect: () => void }
  | { kind: 'separator'; id: string }
  | { kind: 'heading'; id: string; label: string }

interface MenuProps {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
  entries: readonly MenuEntry[]
  label: string
  align?: 'start' | 'end'
}

/** 방향키로 이동하고 Enter로 고르는 메뉴 팝오버 */
export function Menu({ open, anchorRef, onClose, entries, label, align }: MenuProps) {
  const items = entries.filter((e) => e.kind === 'item' && !e.disabled)
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) setActive(0)
  }, [open])

  useEffect(() => {
    if (!open) return
    listRef.current?.focus()
  }, [open])

  const choose = (index: number) => {
    const entry = items[index]
    if (entry?.kind !== 'item') return
    onClose()
    entry.onSelect()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % Math.max(1, items.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i - 1 + items.length) % Math.max(1, items.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(active)
    }
  }

  let itemIndex = -1
  return (
    <Popover open={open} anchorRef={anchorRef} onClose={onClose} label={label} align={align}>
      <div className="menu" role="menu" tabIndex={-1} ref={listRef} onKeyDown={onKeyDown}>
        {entries.map((entry) => {
          if (entry.kind === 'separator') return <div key={entry.id} className="menu__sep" role="separator" />
          if (entry.kind === 'heading') return <div key={entry.id} className="menu__heading">{entry.label}</div>
          if (!entry.disabled) itemIndex += 1
          const myIndex = itemIndex
          return (
            <button
              key={entry.id}
              type="button"
              role="menuitem"
              className="menu__item"
              data-active={!entry.disabled && myIndex === active}
              data-selected={entry.selected}
              data-danger={entry.danger}
              disabled={entry.disabled}
              onMouseEnter={() => !entry.disabled && setActive(myIndex)}
              onClick={() => choose(myIndex)}
            >
              {entry.icon}
              <span>{entry.label}</span>
              {entry.hint ? <span className="menu__hint">{entry.hint}</span> : null}
            </button>
          )
        })}
      </div>
    </Popover>
  )
}
