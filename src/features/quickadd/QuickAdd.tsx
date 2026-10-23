import { CornerDownLeft } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { parseQuickAdd } from '../../domain/nlp'
import type { ParsedToken } from '../../domain/nlp'
import type { Priority } from '../../domain/types'
import { useApp } from '../../store/app'
import { useSettings, useTable, useToday } from '../../hooks/data'
import { createLabel, findLabelByName } from '../../store/commands/entityCommands'
import { createTask } from '../../store/commands/taskCommands'
import { applyChangeSet, mergeChangeSets } from '../../store/changes'
import type { ChangeSet } from '../../store/changes'
import { useUI } from '../../store/ui'
import { Dialog } from '../../ui/Dialog'
import { useToasts } from '../../ui/toast'
import { DateButton, LabelButton, PriorityButton, ProjectButton } from '../pickers/PickerButtons'
import { splitBulkLines } from './bulk'
import { composeTask } from './compose'
import type { ManualOverrides } from './compose'
import './quickadd.css'

export function QuickAdd() {
  const { open, defaults } = useUI((s) => s.quickAdd)
  const close = useUI((s) => s.closeQuickAdd)
  return (
    <Dialog open={open} onClose={close} label="빠른 추가" placement="top" width="min(40rem, calc(100vw - 2rem))">
      <QuickAddForm key={String(open)} defaults={defaults} onClose={close} />
    </Dialog>
  )
}

function highlight(text: string, tokens: readonly ParsedToken[]): React.ReactNode[] {
  const out: React.ReactNode[] = []
  let cursor = 0
  for (const t of [...tokens].sort((a, b) => a.start - b.start)) {
    if (t.start < cursor) continue
    out.push(text.slice(cursor, t.start))
    out.push(
      <mark key={`${t.start}-${t.kind}`} data-kind={t.kind}>
        {text.slice(t.start, t.end)}
      </mark>,
    )
    cursor = t.end
  }
  out.push(text.slice(cursor))
  return out
}

interface FormProps {
  defaults: ReturnType<typeof useUI.getState>['quickAdd']['defaults']
  onClose: () => void
}

function QuickAddForm({ defaults, onClose }: FormProps) {
  const settings = useSettings()
  const today = useToday()
  const projects = useTable('projects')
  const labels = useTable('labels')
  const sections = useTable('sections')
  const commit = useApp((s) => s.commit)
  const [text, setText] = useState(defaults.text ?? '')
  const [manual, setManual] = useState<ManualOverrides>({})
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const firstLine = text.split('\n')[0]
  const multi = splitBulkLines(text).length > 1

  const parsed = useMemo(
    () =>
      parseQuickAdd(firstLine, {
        today,
        now: new Date(),
        weekStartsOn: settings.weekStartsOn,
        projects,
        labels,
        sections,
        parseDates: settings.smartParsing,
      }),
    [firstLine, today, settings.weekStartsOn, settings.smartParsing, projects, labels, sections],
  )

  const composed = useMemo(
    () => composeTask({ parsed, manual, defaults, settings, today }),
    [parsed, manual, defaults, settings, today],
  )
  const { input } = composed

  const submit = (keepOpen: boolean) => {
    const lines = splitBulkLines(text)
    if (lines.length === 0) return
    const stateOf = () => useApp.getState().entities
    const parentStack: string[] = []
    const sets: ChangeSet[] = []
    let working = stateOf()
    let created = 0
    let skipped = 0

    lines.forEach((line, index) => {
      const p = index === 0 ? parsed : parseQuickAdd(line.text, {
        today, now: new Date(), weekStartsOn: settings.weekStartsOn, projects, labels, sections, parseDates: settings.smartParsing,
      })
      const c = composeTask({ parsed: p, manual: index === 0 ? manual : {}, defaults, settings, today })
      if (!c.input.title.trim()) {
        skipped += 1 // 날짜나 #프로젝트만 쓴 줄처럼 제목이 비는 줄
        return
      }
      const labelIds = [...(c.input.labelIds ?? [])]
      for (const name of c.newLabelNames) {
        const existing = findLabelByName(working, name)
        if (existing) {
          labelIds.push(existing.id)
          continue
        }
        const made = createLabel(working, { name })
        sets.push(made.changes)
        working = applyChangeSet(working, made.changes).next
        labelIds.push(made.label.id)
      }
      const parentId = line.depth > 0 ? (parentStack[line.depth - 1] ?? null) : (c.input.parentId ?? null)
      const made = createTask(working, { ...c.input, labelIds, parentId, projectId: c.input.projectId }, Date.now())
      sets.push(made.changes)
      working = applyChangeSet(working, made.changes).next
      created += 1
      parentStack[line.depth] = made.task.id
      parentStack.length = line.depth + 1
    })

    if (created === 0) {
      useToasts.getState().push('제목이 비어 있어서 추가하지 못했어요', { tone: 'error' })
      return
    }
    commit(mergeChangeSets(...sets), created > 1 ? `할 일 ${created}개 추가` : '할 일 추가')
    const skippedNote = skipped > 0 ? ` (제목이 없는 ${skipped}줄은 건너뛰었어요)` : ''
    useToasts.getState().push(created > 1 ? `${created}개를 추가했어요${skippedNote}` : `추가했어요${skippedNote}`)
    if (keepOpen) {
      setText('')
      setManual({})
      inputRef.current?.focus()
    } else onClose()
  }

  const canSubmit = splitBulkLines(text).length > 0 && (multi || input.title.trim().length > 0)
  const dateValue = {
    startDate: input.startDate ?? null,
    startTime: input.startTime ?? null,
    durationMin: input.durationMin ?? null,
    dayPart: input.dayPart ?? null,
    recurrence: input.recurrence ?? null,
    someday: input.someday ?? false,
  }

  return (
    <form
      className="qa"
      onSubmit={(e) => {
        e.preventDefault()
        if (canSubmit) submit(false)
      }}
    >
      <div className="qa__field">
        <div className="qa__mirror" aria-hidden="true">
          {highlight(text, parsed.tokens)}
          {'​'}
        </div>
        <textarea
          ref={inputRef}
          data-autofocus
          className="qa__input"
          rows={Math.min(8, Math.max(1, text.split('\n').length))}
          value={text}
          placeholder="무엇을 할까요?  예) 내일 오후 3시 팀 회의 #업무 p1 ~1h"
          aria-label="새 할 일"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              if (e.shiftKey) return // 줄바꿈: 여러 줄 입력
              e.preventDefault()
              if (canSubmit) submit(e.metaKey || e.ctrlKey)
            }
          }}
        />
      </div>

      {parsed.tokens.length > 0 && !multi ? (
        <ul className="qa__tokens" aria-label="인식한 항목">
          {parsed.tokens.map((t) => (
            <li key={`${t.start}-${t.kind}`} data-kind={t.kind}>
              {t.label}
            </li>
          ))}
        </ul>
      ) : null}
      {multi ? <p className="qa__note">여러 줄이에요. 들여쓴 줄은 바로 위 줄의 하위 작업이 됩니다.</p> : null}

      <div className="qa__bar">
        <div className="qa__pickers">
          <DateButton value={dateValue} onChange={(p) => setManual((m) => ({ ...m, schedule: { ...m.schedule, ...p } }))} />
          <PriorityButton value={(input.priority ?? 4) as Priority} onChange={(priority) => setManual((m) => ({ ...m, priority }))} />
          <LabelButton labelIds={input.labelIds ?? []} onChange={(labelIds) => setManual((m) => ({ ...m, labelIds }))} />
        </div>
        <div className="qa__actions">
          <ProjectButton
            projectId={input.projectId ?? 'inbox'}
            sectionId={input.sectionId ?? null}
            onChange={(projectId, sectionId) => setManual((m) => ({ ...m, projectId, sectionId }))}
          />
          <button type="button" className="qa__cancel" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="qa__submit" disabled={!canSubmit}>
            추가 <CornerDownLeft size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
      <p className="qa__hint">
        <kbd>Enter</kbd> 추가 · <kbd>⌘Enter</kbd> 추가하고 계속 · <kbd>Shift Enter</kbd> 줄바꿈 · <kbd>Esc</kbd> 닫기
      </p>
    </form>
  )
}
