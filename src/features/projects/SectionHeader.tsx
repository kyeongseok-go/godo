import { MoreHorizontal } from 'lucide-react'
import { useRef, useState } from 'react'
import type { Section, StatusCategory } from '../../domain/types'
import { useApp } from '../../store/app'
import { deleteSection, patchSection } from '../../store/commands/entityCommands'
import { Menu } from '../../ui/Menu'
import type { MenuEntry } from '../../ui/Menu'
import './section-header.css'

const CATEGORY_LABEL: Record<StatusCategory, string> = { todo: '대기', active: '진행 중', done: '완료', canceled: '취소' }

interface SectionHeaderProps {
  section: Section
  count: number
}

/** 섹션 제목. 더블클릭으로 이름을 바꾸고, 메뉴에서 상태 범주를 지정하거나 지운다. */
export function SectionHeader({ section, count }: SectionHeaderProps) {
  const commit = useApp((s) => s.commit)
  const moreRef = useRef<HTMLButtonElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(section.name)

  const save = () => {
    setEditing(false)
    const next = name.trim()
    if (next && next !== section.name) commit(patchSection(useApp.getState().entities, section.id, { name: next }), '섹션 이름 수정')
    else setName(section.name)
  }

  const categoryEntries: MenuEntry[] = (['todo', 'active', 'done', 'canceled'] as StatusCategory[]).map((c) => ({
    kind: 'item',
    id: `cat-${c}`,
    label: `이 섹션으로 옮기면 "${CATEGORY_LABEL[c]}"`,
    selected: section.category === c,
    onSelect: () => commit(patchSection(useApp.getState().entities, section.id, { category: section.category === c ? null : c }), '섹션 상태 범주 수정'),
  }))

  return (
    <div className="sechead">
      {editing ? (
        <input
          autoFocus
          aria-label="섹션 이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) save()
            if (e.key === 'Escape') {
              setName(section.name)
              setEditing(false)
            }
          }}
        />
      ) : (
        <h2 onDoubleClick={() => setEditing(true)} title="더블클릭해서 이름 바꾸기">
          {section.name}
          <span>{count}</span>
          {section.category ? <em>{CATEGORY_LABEL[section.category]}</em> : null}
        </h2>
      )}
      <button ref={moreRef} type="button" className="icon-btn" aria-label={`${section.name} 섹션 메뉴`} aria-haspopup="menu" onClick={() => setMenuOpen((v) => !v)}>
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      <Menu
        open={menuOpen}
        anchorRef={moreRef}
        onClose={() => setMenuOpen(false)}
        label="섹션 메뉴"
        align="end"
        entries={[
          { kind: 'item', id: 'rename', label: '이름 바꾸기', onSelect: () => setEditing(true) },
          { kind: 'separator', id: 's1' },
          { kind: 'heading', id: 'h', label: '칸반 열 상태' },
          ...categoryEntries,
          { kind: 'separator', id: 's2' },
          { kind: 'item', id: 'del', label: '섹션 삭제 (할 일은 남겨요)', danger: true, onSelect: () => commit(deleteSection(useApp.getState().entities, section.id, Date.now()), '섹션 삭제') },
        ]}
      />
    </div>
  )
}
