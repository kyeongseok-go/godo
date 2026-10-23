import { Bell, BellRing, X } from 'lucide-react'
import { useRef, useState } from 'react'
import type { Reminder, Task } from '../../domain/types'
import { newId } from '../../store/id'
import { Menu } from '../../ui/Menu'
import type { MenuEntry } from '../../ui/Menu'

const OFFSETS: ReadonlyArray<{ min: number; label: string }> = [
  { min: 0, label: '정각에' },
  { min: 5, label: '5분 전' },
  { min: 15, label: '15분 전' },
  { min: 30, label: '30분 전' },
  { min: 60, label: '1시간 전' },
  { min: 180, label: '3시간 전' },
  { min: 1440, label: '하루 전' },
  { min: 2880, label: '이틀 전' },
]

export const reminderLabel = (r: Reminder): string =>
  r.kind === 'relative'
    ? OFFSETS.find((o) => o.min === r.offsetMin)?.label ?? `${r.offsetMin}분 전`
    : new Date(r.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

interface ReminderSectionProps {
  task: Task
  onChange: (patch: Partial<Task>) => void
}

export function ReminderSection({ task, onChange }: ReminderSectionProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const hasTime = Boolean(task.startDate)
  const taken = new Set(task.reminders.flatMap((r) => (r.kind === 'relative' ? [r.offsetMin] : [])))

  const entries: MenuEntry[] = OFFSETS.filter((o) => !taken.has(o.min)).map((o) => ({
    kind: 'item',
    id: `o${o.min}`,
    label: o.label,
    onSelect: () => onChange({ reminders: [...task.reminders, { id: newId(), kind: 'relative', offsetMin: o.min }] }),
  }))

  return (
    <section className="detail-block" aria-label="알림">
      <h3 className="detail-block__title">알림</h3>
      <ul className="chips">
        {task.reminders.map((r) => (
          <li key={r.id} className="chip">
            <Bell size={12} aria-hidden="true" />
            {reminderLabel(r)}
            <button
              type="button"
              aria-label={`${reminderLabel(r)} 알림 삭제`}
              onClick={() => onChange({ reminders: task.reminders.filter((x) => x.id !== r.id) })}
            >
              <X size={12} aria-hidden="true" />
            </button>
          </li>
        ))}
        <li>
          <button
            ref={ref}
            type="button"
            className="chip chip--add"
            disabled={!hasTime || entries.length === 0}
            title={hasTime ? undefined : '날짜를 먼저 정해 주세요'}
            onClick={() => setOpen((v) => !v)}
          >
            + 알림 추가
          </button>
        </li>
      </ul>
      <Menu open={open} anchorRef={ref} onClose={() => setOpen(false)} entries={entries} label="알림 시점" />
      {task.reminders.length > 0 ? (
        <label className="switch">
          <input
            type="checkbox"
            checked={task.persistentReminder}
            onChange={(e) => onChange({ persistentReminder: e.target.checked })}
          />
          <BellRing size={13} aria-hidden="true" />
          확인할 때까지 계속 알리기
        </label>
      ) : null}
    </section>
  )
}
