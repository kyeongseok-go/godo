import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTaskActions } from '../../hooks/actions'
import { useOpenTask } from '../../hooks/openTask'
import type { Task } from '../../domain/types'
import { Checkbox } from '../../ui/Checkbox'

interface SubtaskSectionProps {
  parent: Task
  allTasks: readonly Task[]
}

/** 바로 아래 하위 작업만 보여준다. 더 깊은 단계는 해당 작업을 열어서 본다. */
export function SubtaskSection({ parent, allTasks }: SubtaskSectionProps) {
  const actions = useTaskActions()
  const { open } = useOpenTask()
  const [text, setText] = useState('')

  const children = useMemo(
    () =>
      allTasks
        .filter((t) => t.parentId === parent.id && t.deletedAt === null)
        .sort((a, b) => a.order - b.order),
    [allTasks, parent.id],
  )
  const done = children.filter((c) => c.status === 'done').length

  const add = () => {
    const title = text.trim()
    if (!title) return
    actions.add({ title, parentId: parent.id, projectId: parent.projectId, sectionId: parent.sectionId })
    setText('')
  }

  return (
    <section className="detail-block" aria-label="하위 작업">
      <h3 className="detail-block__title">
        하위 작업
        {children.length > 0 ? <span>{done}/{children.length}</span> : null}
      </h3>
      <ul className="subtasks">
        {children.map((c) => (
          <li key={c.id} data-done={c.status === 'done'}>
            <Checkbox
              checked={c.status === 'done'}
              priority={c.priority}
              label={`"${c.title}" 완료`}
              onChange={(next) => (next ? actions.complete(c.id) : actions.reopen(c.id))}
            />
            <button type="button" className="subtasks__title" onClick={() => open(c.id)}>
              {c.title}
            </button>
          </li>
        ))}
      </ul>
      <div className="inline-add">
        <Plus size={14} aria-hidden="true" />
        <input
          value={text}
          placeholder="하위 작업 추가"
          aria-label="하위 작업 추가"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              add()
            }
            // 쓰던 하위 작업이 있으면 Esc 는 그 글만 버린다. 상세 패널까지 닫히면 쓴 내용이 통째로 사라진다.
            if (e.key === 'Escape' && text !== '') {
              e.stopPropagation()
              setText('')
            }
          }}
        />
      </div>
    </section>
  )
}
