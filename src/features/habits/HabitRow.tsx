import { Flame, MoreHorizontal } from 'lucide-react'
import { useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { habitStreak } from '../../domain/stats'
import type { Habit, ISODate } from '../../domain/types'
import { Menu } from '../../ui/Menu'
import type { MenuEntry } from '../../ui/Menu'
import { habitMeta } from './habitView'
import type { HabitActions } from './useHabitActions'
import { WeekGrid } from './WeekGrid'

interface HabitRowProps {
  habit: Habit
  today: ISODate
  weekStart: ISODate
  selected: boolean
  detailId: string
  onSelect: () => void
  onEdit: () => void
  onEditValue: (date: ISODate, anchor: HTMLElement) => void
  actions: HabitActions
  /** 좁은 화면에서 선택한 습관 바로 아래에 펼쳐 보이는 상세 */
  expansion?: ReactNode
}

export function HabitRow({ habit, today, weekStart, selected, detailId, onSelect, onEdit, onEditValue, actions, expansion }: HabitRowProps) {
  const moreRef = useRef<HTMLButtonElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const { current } = habitStreak(habit, today)

  const entries: MenuEntry[] = [
    ...(habit.goal.kind === 'count'
      ? ([{ kind: 'item', id: 'value', label: '오늘 값 입력', onSelect: () => moreRef.current && onEditValue(today, moreRef.current) }] as MenuEntry[])
      : []),
    { kind: 'item', id: 'edit', label: '편집', onSelect: onEdit },
    { kind: 'item', id: 'archive', label: '보관', onSelect: () => actions.archive(habit.id, true) },
  ]

  return (
    <li className="hrow" data-selected={selected} style={{ '--habit': habit.color } as CSSProperties}>
      <div className="hrow__main">
        <div className="hrow__info">
          <span className="hrow__dot" aria-hidden="true" />
          <div className="hrow__text">
            <button type="button" className="hrow__name" aria-expanded={selected} aria-controls={detailId} onClick={onSelect}>
              {habit.name}
            </button>
            <span className="hrow__meta">{habitMeta(habit, weekStart)}</span>
          </div>
        </div>
        <span className="hrow__streak" role="img" aria-label={`현재 연속 ${current}일`} data-active={current > 0}>
          <Flame size={14} aria-hidden="true" />
          <b>{current}</b>
          <small>일</small>
        </span>
        <WeekGrid
          habit={habit}
          weekStart={weekStart}
          today={today}
          onToggle={(date) => actions.toggle(habit.id, date)}
          onEditValue={onEditValue}
        />
        <button ref={moreRef} type="button" className="icon-btn hrow__more" aria-label={`${habit.name} 메뉴`} aria-haspopup="menu" onClick={() => setMenuOpen((v) => !v)}>
          <MoreHorizontal size={18} aria-hidden="true" />
        </button>
        <Menu open={menuOpen} anchorRef={moreRef} onClose={() => setMenuOpen(false)} entries={entries} label={`${habit.name} 메뉴`} align="end" />
      </div>
      {expansion}
    </li>
  )
}
