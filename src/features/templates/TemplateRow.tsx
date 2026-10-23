import { Download, Pencil, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { paths } from '../../app/nav'
import { INBOX_ID } from '../../domain/types'
import type { ISODate, Project, Template } from '../../domain/types'
import { useToday } from '../../hooks/data'
import { projectOptions } from '../settings/options'
import type { SelectOption } from '../settings/options'
import { parseTemplatePayload } from './model'
import { describeTemplate } from './summary'
import type { TemplateActions } from './useTemplateActions'

interface TemplateRowProps {
  template: Template
  projects: readonly Project[]
  actions: TemplateActions
}

const KIND_LABEL: Record<Template['kind'], string> = { task: '할 일', project: '프로젝트' }

function formatCreated(ms: number): string {
  return new Date(ms).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

interface LoadFormState {
  projectId: string
  name: string
  baseDate: ISODate
}

function LoadFields({ kind, choices, value, onChange }: { kind: Template['kind']; choices: readonly SelectOption[]; value: LoadFormState; onChange: (next: LoadFormState) => void }) {
  return (
    <>
      {kind === 'task' ? (
        <label className="tp-field">
          <span>넣을 프로젝트</span>
          <select className="st-select" value={value.projectId} onChange={(e) => onChange({ ...value, projectId: e.target.value })}>
            {choices.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="tp-field">
          <span>새 프로젝트 이름</span>
          <input className="st-input st-input--text" value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} />
        </label>
      )}
      <label className="tp-field">
        <span>기준일</span>
        <input className="st-input" type="date" value={value.baseDate} required onChange={(e) => e.target.value && onChange({ ...value, baseDate: e.target.value })} />
      </label>
    </>
  )
}

function LoadPanel({ template, projects, actions, onDone }: TemplateRowProps & { onDone: () => void }) {
  const navigate = useNavigate()
  const today = useToday()
  const choices = useMemo(() => projectOptions(projects, INBOX_ID), [projects])
  const [form, setForm] = useState<LoadFormState>({ projectId: choices[0]?.value ?? INBOX_ID, name: template.name, baseDate: today })

  const submit = (): void => {
    if (template.kind === 'task') {
      if (actions.createTasks(template.id, { projectId: form.projectId, baseDate: form.baseDate }) === 0) return
      navigate(form.projectId === INBOX_ID ? paths.inbox : paths.project(form.projectId))
    } else {
      const created = actions.createProject(template.id, { name: form.name, baseDate: form.baseDate })
      if (created === null) return
      navigate(paths.project(created))
    }
    onDone()
  }

  return (
    <form
      className="tp-load"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <LoadFields kind={template.kind} choices={choices} value={form} onChange={setForm} />
      <p className="tp-load__hint">템플릿에 담긴 날짜는 이 날을 기준으로 맞춰서 만들어요.</p>
      <div className="tp-load__actions">
        <button type="button" className="st-btn" onClick={onDone}>
          닫기
        </button>
        <button type="submit" className="st-btn st-btn--primary" disabled={template.kind === 'project' && form.name.trim() === ''}>
          {template.kind === 'task' ? '할 일 만들기' : '프로젝트 만들기'}
        </button>
      </div>
    </form>
  )
}

function RenameForm({ template, actions, onDone }: Pick<TemplateRowProps, 'template' | 'actions'> & { onDone: () => void }) {
  const [name, setName] = useState(template.name)
  return (
    <form
      className="tp-rename"
      onSubmit={(e) => {
        e.preventDefault()
        actions.rename(template.id, name)
        onDone()
      }}
    >
      <input className="st-input st-input--text" aria-label={`${template.name}의 새 이름`} value={name} autoFocus onChange={(e) => setName(e.target.value)} />
      <button type="submit" className="st-btn st-btn--primary" disabled={name.trim() === ''}>
        저장
      </button>
      <button type="button" className="st-btn" onClick={onDone}>
        취소
      </button>
    </form>
  )
}

export function TemplateRow(props: TemplateRowProps) {
  const { template, actions } = props
  const [loading, setLoading] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const readable = useMemo(() => parseTemplatePayload(template).ok, [template])

  return (
    <li className="tp-item">
      <div className="tp-item__head">
        <div className="tp-item__text">
          {renaming ? (
            <RenameForm template={template} actions={actions} onDone={() => setRenaming(false)} />
          ) : (
            <p className="tp-item__name">
              <span className="tp-item__kind">{KIND_LABEL[template.kind]}</span> {template.name}
            </p>
          )}
          <p className="tp-item__meta">
            {describeTemplate(template)} · {formatCreated(template.createdAt)}에 저장
          </p>
        </div>
        <div className="tp-item__actions">
          <button
            type="button"
            className="st-btn"
            disabled={!readable}
            aria-expanded={loading}
            aria-label={`${template.name} 불러오기`}
            onClick={() => setLoading((on) => !on)}
          >
            <Download size={14} aria-hidden="true" /> 불러오기
          </button>
          <button type="button" className="st-icon" aria-label={`${template.name} 이름 바꾸기`} title="이름 바꾸기" onClick={() => setRenaming(true)}>
            <Pencil size={15} aria-hidden="true" />
          </button>
          <button type="button" className="st-icon" aria-label={`${template.name} 삭제`} title="삭제" onClick={() => actions.remove(template.id)}>
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
      {loading ? <LoadPanel {...props} onDone={() => setLoading(false)} /> : null}
    </li>
  )
}
