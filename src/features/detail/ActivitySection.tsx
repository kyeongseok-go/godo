import { useMemo, useState } from 'react'
import type { ID } from '../../domain/types'
import { useTable } from '../../hooks/data'

export function ActivitySection({ taskId }: { taskId: ID }) {
  const all = useTable('activity')
  const [open, setOpen] = useState(false)
  const items = useMemo(
    () => all.filter((a) => a.taskId === taskId).sort((a, b) => b.at - a.at),
    [all, taskId],
  )
  if (items.length === 0) return null
  return (
    <section className="detail-block" aria-label="활동 기록">
      <button type="button" className="detail-block__toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        활동 기록 <span>{items.length}</span>
      </button>
      {open ? (
        <ul className="activity">
          {items.slice(0, 30).map((a) => (
            <li key={a.id}>
              <time dateTime={new Date(a.at).toISOString()}>
                {new Date(a.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </time>
              {a.summary}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
