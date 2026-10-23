import { CalendarClock, Flag, FolderClosed, Hash, Plus, Repeat2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { Priority } from '../../domain/types'
import { describeDate, formatTime } from '../../domain/format'
import { describeRule } from '../../domain/recurrence'
import type { ID, ISODate, Label } from '../../domain/types'
import { INBOX_ID } from '../../domain/types'
import { useSettings, useTable, useToday } from '../../hooks/data'
import { useApp } from '../../store/app'
import { createLabel, findLabelByName } from '../../store/commands/entityCommands'
import { Menu } from '../../ui/Menu'
import type { MenuEntry } from '../../ui/Menu'
import { Popover } from '../../ui/Popover'
import { buildProjectTree, flattenProjectTree } from '../projects/projectTree'
import { DatePopover } from './DatePopover'
import type { SchedulePatch } from './DatePopover'
import './pickers.css'

const PRIORITY_LABEL: Record<Priority, string> = { 1: '우선순위 1', 2: '우선순위 2', 3: '우선순위 3', 4: '우선순위 없음' }

interface PriorityButtonProps {
  value: Priority
  onChange: (p: Priority) => void
  variant?: 'chip' | 'field'
}

export function PriorityButton({ value, onChange, variant = 'chip' }: PriorityButtonProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const entries: MenuEntry[] = ([1, 2, 3, 4] as const).map((p) => ({
    kind: 'item',
    id: `p${p}`,
    label: PRIORITY_LABEL[p],
    icon: <Flag size={14} style={{ color: `var(--p${p})` }} fill={p === 4 ? 'none' : `var(--p${p})`} />,
    hint: `P${p}`,
    selected: p === value,
    onSelect: () => onChange(p),
  }))
  return (
    <>
      <button ref={ref} type="button" className="pick-btn" data-variant={variant} data-set={value !== 4} onClick={() => setOpen((v) => !v)} aria-haspopup="menu">
        <Flag size={14} aria-hidden="true" style={{ color: `var(--p${value})` }} fill={value === 4 ? 'none' : `var(--p${value})`} />
        <span>{variant === 'field' || value !== 4 ? PRIORITY_LABEL[value] : '우선순위'}</span>
      </button>
      <Menu open={open} anchorRef={ref} onClose={() => setOpen(false)} entries={entries} label="우선순위" />
    </>
  )
}

interface ProjectButtonProps {
  projectId: ID
  sectionId: ID | null
  onChange: (projectId: ID, sectionId: ID | null) => void
  variant?: 'chip' | 'field'
}

export function ProjectButton({ projectId, sectionId, onChange, variant = 'chip' }: ProjectButtonProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const projects = useTable('projects')
  const sections = useTable('sections')
  const tree = useMemo(() => flattenProjectTree(buildProjectTree(projects)), [projects])
  const current = projects.find((p) => p.id === projectId)
  const section = sections.find((s) => s.id === sectionId)

  const entries: MenuEntry[] = [
    { kind: 'item', id: INBOX_ID, label: '받은편지함', icon: <FolderClosed size={14} />, selected: projectId === INBOX_ID, onSelect: () => onChange(INBOX_ID, null) },
  ]
  for (const { project, depth } of tree) {
    if (project.isFolder) continue
    entries.push({
      kind: 'item',
      id: project.id,
      label: `${'· '.repeat(depth)}${project.name}`,
      icon: <i className="dot dot--lg" style={{ background: project.color }} />,
      selected: project.id === projectId && !sectionId,
      onSelect: () => onChange(project.id, null),
    })
    if (project.id === projectId) {
      for (const s of sections.filter((x) => x.projectId === project.id).sort((a, b) => a.order - b.order)) {
        entries.push({
          kind: 'item',
          id: s.id,
          label: `${'· '.repeat(depth + 1)}/ ${s.name}`,
          selected: s.id === sectionId,
          onSelect: () => onChange(project.id, s.id),
        })
      }
    }
  }

  return (
    <>
      <button ref={ref} type="button" className="pick-btn" data-variant={variant} onClick={() => setOpen((v) => !v)} aria-haspopup="menu">
        <i className="dot dot--lg" style={{ background: current?.color ?? 'var(--muted)' }} aria-hidden="true" />
        <span>{current ? current.name : '받은편지함'}{section ? ` / ${section.name}` : ''}</span>
      </button>
      <Menu open={open} anchorRef={ref} onClose={() => setOpen(false)} entries={entries} label="프로젝트" />
    </>
  )
}

interface LabelButtonProps {
  labelIds: readonly ID[]
  onChange: (ids: ID[]) => void
  variant?: 'chip' | 'field'
}

export function LabelButton({ labelIds, onChange, variant = 'chip' }: LabelButtonProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const labels = useTable('labels')
  const commit = useApp((s) => s.commit)

  const sorted = useMemo(() => [...labels].sort((a, b) => a.order - b.order), [labels])
  const needle = query.trim().replace(/^[@%#]+/, '').toLowerCase()
  const shown = needle ? sorted.filter((l) => l.name.toLowerCase().includes(needle)) : sorted
  const exact = sorted.some((l) => l.name.toLowerCase() === needle)

  const toggle = (id: ID) => onChange(labelIds.includes(id) ? labelIds.filter((x) => x !== id) : [...labelIds, id])
  const create = () => {
    const state = useApp.getState().entities
    const existing = findLabelByName(state, needle)
    if (existing) return toggle(existing.id)
    const { label, changes } = createLabel(state, { name: needle })
    commit(changes, '라벨 추가')
    onChange([...labelIds, label.id])
    setQuery('')
  }
  const selectedLabels = labelIds.flatMap((id) => labels.find((l) => l.id === id) ?? [])

  return (
    <>
      <button ref={ref} type="button" className="pick-btn" data-variant={variant} data-set={labelIds.length > 0} onClick={() => setOpen((v) => !v)} aria-haspopup="dialog">
        <Hash size={14} aria-hidden="true" />
        <span>{selectedLabels.length > 0 ? selectedLabels.map((l) => l.name).join(', ') : '라벨'}</span>
      </button>
      <Popover open={open} anchorRef={ref} onClose={() => setOpen(false)} label="라벨 선택">
        <div className="label-pop">
          <input
            // 팝오버가 보이게 된 뒤 포커스를 받는다(autoFocus 는 그 전에 불려 무시된다).
            data-autofocus
            placeholder="라벨 검색 또는 새로 만들기"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing && needle) {
                e.preventDefault()
                if (!exact && shown.length === 0) create()
                else if (shown[0]) toggle(shown[0].id)
              }
            }}
          />
          <ul>
            {shown.map((l: Label) => (
              <li key={l.id}>
                <label>
                  <input type="checkbox" checked={labelIds.includes(l.id)} onChange={() => toggle(l.id)} />
                  <Hash size={13} style={{ color: l.color }} aria-hidden="true" />
                  {l.name}
                </label>
              </li>
            ))}
          </ul>
          {needle && !exact ? (
            <button type="button" className="label-pop__create" onClick={create}>
              <Plus size={14} aria-hidden="true" />“{needle}” 만들기
            </button>
          ) : null}
        </div>
      </Popover>
    </>
  )
}

interface DateButtonProps {
  value: SchedulePatch
  onChange: (patch: Partial<SchedulePatch>) => void
  variant?: 'chip' | 'field'
  placeholder?: string
}

export function DateButton({ value, onChange, variant = 'chip', placeholder = '날짜' }: DateButtonProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const today = useToday()
  const settings = useSettings()
  const text = scheduleText(value, today, settings.timeFormat)
  return (
    <>
      <button ref={ref} type="button" className="pick-btn" data-variant={variant} data-set={Boolean(text)} onClick={() => setOpen((v) => !v)} aria-haspopup="dialog">
        {value.recurrence ? <Repeat2 size={14} aria-hidden="true" /> : <CalendarClock size={14} aria-hidden="true" />}
        <span>{text || placeholder}</span>
      </button>
      <DatePopover open={open} anchorRef={ref} onClose={() => setOpen(false)} value={value} today={today} weekStartsOn={settings.weekStartsOn} onChange={onChange} />
    </>
  )
}

function scheduleText(v: SchedulePatch, today: ISODate, fmt: '12h' | '24h'): string {
  if (v.someday) return '언젠가'
  const parts: string[] = []
  if (v.startDate) parts.push(describeDate(v.startDate, today))
  if (v.startTime) parts.push(formatTime(v.startTime, fmt))
  else if (v.dayPart) parts.push({ morning: '오전', afternoon: '오후', evening: '저녁' }[v.dayPart])
  if (v.recurrence) parts.push(describeRule(v.recurrence, v.startDate ?? today))
  return parts.join(' · ')
}
