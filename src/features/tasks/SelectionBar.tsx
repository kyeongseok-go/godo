import { CalendarClock, CheckCheck, Flag, Trash2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { addDays } from '../../domain/date'
import { nextWeekStart } from '../../domain/calendarGrid'
import type { Priority } from '../../domain/types'
import { useSettings, useToday } from '../../hooks/data'
import { useTaskActions } from '../../hooks/actions'
import { useUI } from '../../store/ui'
import { Menu } from '../../ui/Menu'
import type { MenuEntry } from '../../ui/Menu'
import './selection-bar.css'

/** 여러 개를 골랐을 때 하단에 뜨는 일괄 작업 바 */
export function SelectionBar() {
  const ids = useUI((s) => s.selectedIds)
  const clear = useUI((s) => s.clearSelection)
  const actions = useTaskActions()
  const today = useToday()
  const { weekStartsOn } = useSettings()
  const dateRef = useRef<HTMLButtonElement>(null)
  const prioRef = useRef<HTMLButtonElement>(null)
  const [dateOpen, setDateOpen] = useState(false)
  const [prioOpen, setPrioOpen] = useState(false)

  if (ids.length === 0) return null

  const setDate = (startDate: string | null) => {
    actions.patchMany(ids, { startDate, ...(startDate === null ? { startTime: null, dayPart: null } : {}) }, '일괄 일정 수정')
    clear()
  }
  const dateEntries: MenuEntry[] = [
    { kind: 'item', id: 'today', label: '오늘', onSelect: () => setDate(today) },
    { kind: 'item', id: 'tomorrow', label: '내일', onSelect: () => setDate(addDays(today, 1)) },
    { kind: 'item', id: 'week', label: '다음 주', onSelect: () => setDate(nextWeekStart(today, weekStartsOn)) },
    { kind: 'item', id: 'none', label: '날짜 지우기', onSelect: () => setDate(null) },
  ]
  const prioEntries: MenuEntry[] = ([1, 2, 3, 4] as Priority[]).map((p) => ({
    kind: 'item',
    id: `p${p}`,
    label: p === 4 ? '우선순위 없음' : `우선순위 ${p}`,
    icon: <Flag size={14} style={{ color: `var(--p${p})` }} />,
    onSelect: () => {
      actions.patchMany(ids, { priority: p }, '일괄 우선순위 수정')
      clear()
    },
  }))

  return (
    <div className="selbar" role="toolbar" aria-label="선택한 할 일 작업">
      <span className="selbar__count">
        <strong>{ids.length}</strong>개 선택
      </span>
      <button type="button" onClick={() => { actions.completeMany(ids); clear() }}>
        <CheckCheck size={15} aria-hidden="true" /> 완료
      </button>
      <button ref={dateRef} type="button" onClick={() => setDateOpen((v) => !v)} aria-haspopup="menu">
        <CalendarClock size={15} aria-hidden="true" /> 날짜
      </button>
      <button ref={prioRef} type="button" onClick={() => setPrioOpen((v) => !v)} aria-haspopup="menu">
        <Flag size={15} aria-hidden="true" /> 우선순위
      </button>
      <button type="button" className="selbar__danger" onClick={() => { actions.remove(ids); clear() }}>
        <Trash2 size={15} aria-hidden="true" /> 삭제
      </button>
      <button type="button" className="selbar__close" aria-label="선택 해제" onClick={clear}>
        <X size={16} aria-hidden="true" />
      </button>
      <Menu open={dateOpen} anchorRef={dateRef} onClose={() => setDateOpen(false)} entries={dateEntries} label="날짜 일괄 변경" />
      <Menu open={prioOpen} anchorRef={prioRef} onClose={() => setPrioOpen(false)} entries={prioEntries} label="우선순위 일괄 변경" />
    </div>
  )
}
