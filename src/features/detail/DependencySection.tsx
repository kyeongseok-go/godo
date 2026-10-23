import { Lock, PauseCircle, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { Task } from '../../domain/types'
import { Popover } from '../../ui/Popover'

interface DependencySectionProps {
  task: Task
  allTasks: readonly Task[]
  onChange: (patch: Partial<Task>) => void
}

/** "이 일이 끝나야 시작할 수 있다"는 관계와 보류 토글 */
export function DependencySection({ task, allTasks, onChange }: DependencySectionProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const byId = useMemo(() => new Map(allTasks.map((t) => [t.id, t])), [allTasks])
  const blockers = task.blockedBy.flatMap((id) => byId.get(id) ?? [])
  const needle = query.trim().toLowerCase()
  const candidates = allTasks
    .filter(
      (t) =>
        t.id !== task.id &&
        t.deletedAt === null &&
        (t.status === 'todo' || t.status === 'active') &&
        !task.blockedBy.includes(t.id) &&
        // 서로가 서로를 막으면 영영 시작할 수 없으니 반대 방향 관계는 제외한다.
        !t.blockedBy.includes(task.id) &&
        (needle === '' || t.title.toLowerCase().includes(needle)),
    )
    .slice(0, 8)

  return (
    <section className="detail-block" aria-label="의존 관계">
      <h3 className="detail-block__title">시작 조건</h3>
      <ul className="chips">
        {blockers.map((b) => (
          <li key={b.id} className="chip" data-done={b.status === 'done'}>
            <Lock size={12} aria-hidden="true" />
            {b.title}
            <button
              type="button"
              aria-label={`"${b.title}" 조건 해제`}
              onClick={() => onChange({ blockedBy: task.blockedBy.filter((x) => x !== b.id) })}
            >
              <X size={12} aria-hidden="true" />
            </button>
          </li>
        ))}
        <li>
          <button ref={ref} type="button" className="chip chip--add" onClick={() => setOpen((v) => !v)}>
            + 먼저 끝나야 할 일
          </button>
        </li>
      </ul>
      <Popover open={open} anchorRef={ref} onClose={() => setOpen(false)} label="먼저 끝나야 할 일 선택">
        <div className="label-pop">
          <input autoFocus placeholder="할 일 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
          <ul>
            {candidates.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="menu__item"
                  onClick={() => {
                    onChange({ blockedBy: [...task.blockedBy, c.id] })
                    setOpen(false)
                    setQuery('')
                  }}
                >
                  {c.title}
                </button>
              </li>
            ))}
            {candidates.length === 0 ? <li className="nav-empty">찾는 할 일이 없어요</li> : null}
          </ul>
        </div>
      </Popover>
      <label className="switch">
        <input type="checkbox" checked={task.onHold} onChange={(e) => onChange({ onHold: e.target.checked })} />
        <PauseCircle size={13} aria-hidden="true" />
        보류 (지금은 목록에서 숨김)
      </label>
    </section>
  )
}
