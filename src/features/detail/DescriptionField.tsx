import { Eye, Pencil } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Markdown } from '../../ui/Markdown'

interface DescriptionFieldProps {
  value: string
  onCommit: (next: string) => void
}

/** 마크다운 설명. 보기 모드가 기본이고, 눌러서 편집한다. 포커스를 잃으면 저장한다. */
export function DescriptionField({ value, onCommit }: DescriptionFieldProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  const finish = () => {
    setEditing(false)
    if (draft !== value) onCommit(draft)
  }

  if (editing) {
    return (
      <div className="desc">
        <textarea
          autoFocus
          className="desc__input"
          rows={6}
          value={draft}
          placeholder="마크다운으로 메모를 남겨요. - [ ] 체크리스트, **굵게**, [링크](https://…)"
          aria-label="설명"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={finish}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation()
              setDraft(value)
              setEditing(false)
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) finish()
          }}
        />
        <p className="desc__hint">
          <Eye size={12} aria-hidden="true" /> 바깥을 누르거나 ⌘Enter로 저장
        </p>
      </div>
    )
  }

  return (
    <button type="button" className="desc desc--view" onClick={() => setEditing(true)} title="눌러서 편집">
      {value.trim() ? (
        <Markdown source={value} />
      ) : (
        <span className="desc__empty">
          <Pencil size={13} aria-hidden="true" /> 설명 추가
        </span>
      )}
    </button>
  )
}
