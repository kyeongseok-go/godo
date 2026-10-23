import { Link2, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useToday, useTable } from '../../hooks/data'
import type { ID } from '../../domain/types'
import { Popover } from '../../ui/Popover'
import { pickableTasks } from './taskPick'

interface TaskPickerProps {
  taskId: ID | null
  onChange: (taskId: ID | null) => void
}

/** 집중에 연결할 열린 할 일을 검색해서 고른다. 연결하지 않아도 세션은 기록된다. */
export function TaskPicker({ taskId, onChange }: TaskPickerProps) {
  const tasks = useTable('tasks')
  const projects = useTable('projects')
  const today = useToday()
  const anchorRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const linked = taskId ? tasks.find((t) => t.id === taskId) : undefined
  const projectName = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects])
  const candidates = useMemo(() => pickableTasks(tasks, query, today), [tasks, query, today])

  const close = (): void => {
    setOpen(false)
    setQuery('')
  }
  const choose = (id: ID): void => {
    onChange(id)
    close()
    anchorRef.current?.focus()
  }
  const submit = (event: FormEvent): void => {
    event.preventDefault()
    const first = candidates[0]
    if (first) choose(first.id)
  }

  return (
    <div className="focus-picker">
      {taskId ? (
        <p className="focus-picker__linked">
          <Link2 size={14} aria-hidden="true" />
          <span className="focus-picker__title" data-missing={!linked}>
            {linked?.title ?? '삭제된 할 일'}
          </span>
          <button type="button" className="focus-picker__clear" aria-label="할 일 연결 해제" onClick={() => onChange(null)}>
            <X size={14} aria-hidden="true" />
          </button>
        </p>
      ) : null}
      <button
        ref={anchorRef}
        type="button"
        className="focus-picker__open"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {taskId ? '다른 할 일로 바꾸기' : '할 일 연결하기'}
      </button>
      {taskId ? null : <p className="focus-picker__hint">연결하지 않아도 이름 없는 세션으로 기록돼요.</p>}
      <Popover open={open} anchorRef={anchorRef} onClose={close} label="집중할 할 일 선택">
        <form className="focus-picker__pop" onSubmit={submit}>
          <input
            autoFocus
            type="search"
            aria-label="할 일 검색"
            placeholder="할 일 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul>
            {candidates.map((task) => (
              <li key={task.id}>
                <button type="button" className="menu__item focus-picker__option" onClick={() => choose(task.id)}>
                  <span className="focus-picker__option-title">{task.title}</span>
                  <span className="focus-picker__option-meta">{projectName.get(task.projectId) ?? ''}</span>
                </button>
              </li>
            ))}
            {candidates.length === 0 ? (
              <li className="focus-picker__empty">{query.trim() ? '찾는 할 일이 없어요' : '열린 할 일이 없어요'}</li>
            ) : null}
          </ul>
        </form>
      </Popover>
    </div>
  )
}
