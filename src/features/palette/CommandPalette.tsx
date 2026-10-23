import { BookmarkPlus, CheckSquare, CornerDownLeft, Filter, FolderClosed, Hash, Plus, Terminal } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { paths } from '../../app/nav'
import { useTable } from '../../hooks/data'
import { useApp } from '../../store/app'
import { useUI } from '../../store/ui'
import { useTemplateActions } from '../templates'
import { Dialog } from '../../ui/Dialog'
import { formatKeys } from '../shortcuts/keymap'
import { effectiveKeys, useCommands } from '../shortcuts/useCommands'
import { rankBy } from './search'
import './palette.css'

interface Entry {
  id: string
  group: string
  label: string
  detail?: string
  hint?: string
  icon: ReactNode
  run: () => void
}

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

export function CommandPalette() {
  const open = useUI((s) => s.paletteOpen)
  const setOpen = useUI((s) => s.setPalette)
  return (
    <Dialog open={open} onClose={() => setOpen(false)} label="명령 팔레트" placement="top" width="min(40rem, calc(100vw - 2rem))">
      <PaletteBody onClose={() => setOpen(false)} />
    </Dialog>
  )
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const commands = useCommands()
  const overrides = useApp((s) => s.settings.shortcuts)
  const tasks = useTable('tasks')
  const projects = useTable('projects')
  const labels = useTable('labels')
  const filters = useTable('filters')
  const templateList = useTable('templates')
  const templateActions = useTemplateActions()
  const openQuickAdd = useUI((s) => s.openQuickAdd)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = []
    const q = query.trim()
    for (const c of rankBy(commands, q, (c) => `${c.title} ${c.aliases ?? ''}`, q ? 6 : 12)) {
      const keys = effectiveKeys(c, overrides)
      out.push({ id: c.id, group: '명령', label: c.title, hint: keys ? formatKeys(keys, IS_MAC) : undefined, icon: <Terminal size={15} />, run: c.run })
    }
    if (q) {
      const live = tasks.filter((t) => t.deletedAt === null)
      for (const t of rankBy(live, q, (t) => `${t.title} ${t.description}`, 8)) {
        out.push({
          id: `t-${t.id}`,
          group: '할 일',
          label: t.title,
          detail: projects.find((p) => p.id === t.projectId)?.name,
          icon: <CheckSquare size={15} />,
          run: () => navigate(`${paths.search(q)}&task=${t.id}`),
        })
      }
      for (const p of rankBy(projects.filter((p) => p.deletedAt === null && p.id !== 'inbox'), q, (p) => p.name, 4)) {
        out.push({ id: `p-${p.id}`, group: '프로젝트', label: p.name, icon: <FolderClosed size={15} style={{ color: p.color }} />, run: () => navigate(paths.project(p.id)) })
      }
      for (const l of rankBy(labels, q, (l) => l.name, 4)) {
        out.push({ id: `l-${l.id}`, group: '라벨', label: l.name, icon: <Hash size={15} style={{ color: l.color }} />, run: () => navigate(paths.label(l.id)) })
      }
      for (const tpl of rankBy(templateList, q, (t) => t.name, 3)) {
        out.push({
          id: `tpl-${tpl.id}`,
          group: '템플릿',
          label: `"${tpl.name}" 템플릿으로 만들기`,
          icon: <BookmarkPlus size={15} />,
          run: () => {
            if (tpl.kind === 'project') templateActions.createProject(tpl.id, {})
            else templateActions.createTasks(tpl.id, { projectId: 'inbox' })
          },
        })
      }
      for (const f of rankBy(filters, q, (f) => `${f.name} ${f.query}`, 4)) {
        out.push({ id: `f-${f.id}`, group: '필터', label: f.name, detail: f.query, icon: <Filter size={15} style={{ color: f.color }} />, run: () => navigate(paths.filter(f.id)) })
      }
      out.push({ id: 'create', group: '만들기', label: `"${q}" 작업으로 추가`, icon: <Plus size={15} />, run: () => openQuickAdd({ text: q }) })
      out.push({ id: 'search-all', group: '검색', label: `"${q}" 전체 검색 결과 보기`, icon: <CornerDownLeft size={15} />, run: () => navigate(paths.search(q)) })
    }
    return out
  }, [query, commands, overrides, tasks, projects, labels, filters, templateList, templateActions, navigate, openQuickAdd])

  useEffect(() => setActive(0), [query])
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const choose = (i: number) => {
    const entry = entries[i]
    if (!entry) return
    onClose()
    // 대화상자가 닫힌 뒤에 실행해야 새 대화상자(빠른 추가 등)가 포커스를 가져간다.
    queueMicrotask(entry.run)
  }

  let lastGroup = ''
  return (
    <div className="palette">
      <input
        autoFocus
        data-autofocus
        className="palette__input"
        role="combobox"
        aria-expanded="true"
        aria-controls="palette-list"
        aria-label="명령 또는 검색어 입력"
        placeholder="명령을 찾거나 할 일을 검색하세요"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((i) => Math.min(entries.length - 1, i + 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((i) => Math.max(0, i - 1))
          } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault()
            choose(active)
          }
        }}
      />
      <ul id="palette-list" className="palette__list" role="listbox" ref={listRef}>
        {entries.map((entry, i) => {
          const header = entry.group !== lastGroup
          lastGroup = entry.group
          return (
            <li key={entry.id} role="presentation">
              {header ? <div className="palette__group">{entry.group}</div> : null}
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                data-active={i === active}
                className="palette__item"
                onMouseMove={() => setActive(i)}
                onClick={() => choose(i)}
              >
                <span className="palette__icon">{entry.icon}</span>
                <span className="palette__label">{entry.label}</span>
                {entry.detail ? <span className="palette__detail">{entry.detail}</span> : null}
                {entry.hint ? <kbd>{entry.hint}</kbd> : null}
              </button>
            </li>
          )
        })}
        {entries.length === 0 ? <li className="palette__empty">맞는 항목이 없어요</li> : null}
      </ul>
    </div>
  )
}
