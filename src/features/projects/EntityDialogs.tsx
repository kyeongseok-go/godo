import { Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { paths } from '../../app/nav'
import { describeFilter, parseFilter, runFilter } from '../../domain/filter'
import type { ID, ProjectView } from '../../domain/types'
import { INBOX_ID } from '../../domain/types'
import { useEngineContext, useTable } from '../../hooks/data'
import { useApp } from '../../store/app'
import {
  createFilter,
  createLabel,
  createProject,
  deleteFilter,
  deleteLabel,
  deleteProject,
  patchFilter,
  patchLabel,
  patchProject,
} from '../../store/commands/entityCommands'
import { PALETTE } from '../../store/defaults'
import { useUI } from '../../store/ui'
import type { EntityDialogTarget } from '../../store/ui'
import { Dialog } from '../../ui/Dialog'
import { useToasts } from '../../ui/toast'
import { buildProjectTree, flattenProjectTree, projectSubtreeIds } from './projectTree'
import './entity-dialogs.css'

export function EntityDialogs() {
  const target = useUI((s) => s.entityDialog)
  const close = useUI((s) => s.closeEntityDialog)
  const titles = { project: '프로젝트', label: '라벨', filter: '필터' } as const
  return (
    <Dialog open={target !== null} onClose={close} label={target ? `${titles[target.kind]} 편집` : '편집'}>
      {target?.kind === 'project' ? <ProjectForm target={target} onClose={close} /> : null}
      {target?.kind === 'label' ? <LabelForm target={target} onClose={close} /> : null}
      {target?.kind === 'filter' ? <FilterForm target={target} onClose={close} /> : null}
    </Dialog>
  )
}

function Swatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="swatches" role="radiogroup" aria-label="색">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          className="swatch"
          style={{ background: c }}
          data-active={value === c}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  )
}

function FormShell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="ed">
      <header className="ed__head">
        <h2>{title}</h2>
        <button type="button" className="icon-btn" aria-label="닫기" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      {children}
    </div>
  )
}

const VIEWS: ReadonlyArray<{ id: ProjectView; label: string }> = [
  { id: 'list', label: '목록' },
  { id: 'board', label: '칸반' },
  { id: 'calendar', label: '캘린더' },
  { id: 'timeline', label: '타임라인' },
  { id: 'matrix', label: '매트릭스' },
]

function ProjectForm({ target, onClose }: { target: EntityDialogTarget; onClose: () => void }) {
  const navigate = useNavigate()
  const projects = useTable('projects')
  const commit = useApp((s) => s.commit)
  const existing = projects.find((p) => p.id === target.id)
  const [name, setName] = useState(existing?.name ?? '')
  const [color, setColor] = useState(existing?.color ?? PALETTE[projects.length % PALETTE.length])
  const [parentId, setParentId] = useState<ID | ''>(existing?.parentId ?? target.parentId ?? '')
  const [isFolder, setIsFolder] = useState(existing?.isFolder ?? false)
  const [favorite, setFavorite] = useState(existing?.favorite ?? false)
  const [view, setView] = useState<ProjectView>(existing?.defaultView ?? 'list')

  const folders = useMemo(() => {
    const banned = existing ? new Set(projectSubtreeIds(projects, existing.id)) : new Set<ID>()
    return flattenProjectTree(buildProjectTree(projects)).filter((n) => n.project.isFolder && !banned.has(n.project.id))
  }, [projects, existing])

  const save = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const state = useApp.getState().entities
    if (existing) {
      commit(patchProject(state, existing.id, { name: trimmed, color, parentId: parentId || null, isFolder, favorite, defaultView: view }), '프로젝트 수정')
      onClose()
      return
    }
    const { project, changes } = createProject(state, { name: trimmed, color, parentId: parentId || null, isFolder }, Date.now())
    commit(changes, '프로젝트 추가')
    if (favorite || view !== 'list') commit(patchProject(useApp.getState().entities, project.id, { favorite, defaultView: view }), '프로젝트 설정', { history: false })
    onClose()
    if (!isFolder) navigate(paths.project(project.id))
  }

  const remove = () => {
    if (!existing) return
    commit(deleteProject(useApp.getState().entities, existing.id, Date.now()), '프로젝트 삭제')
    useToasts.getState().push('프로젝트를 지웠어요. 안의 할 일은 휴지통에 있어요', {
      actionLabel: '되돌리기',
      onAction: () => useApp.getState().undo(),
    })
    onClose()
    navigate(paths.inbox)
  }

  return (
    <FormShell title={existing ? '프로젝트 편집' : '프로젝트 추가'} onClose={onClose}>
      <form
        className="ed__form"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <label className="ed__field">
          <span>이름</span>
          <input autoFocus data-autofocus value={name} onChange={(e) => setName(e.target.value)} placeholder="예) 사이드 프로젝트" />
        </label>
        <div className="ed__field">
          <span>색</span>
          <Swatches value={color} onChange={setColor} />
        </div>
        <label className="ed__field">
          <span>상위 폴더</span>
          <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">없음</option>
            {folders.map((n) => (
              <option key={n.project.id} value={n.project.id}>
                {'· '.repeat(n.depth)}
                {n.project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="ed__field">
          <span>기본 보기</span>
          <select value={view} onChange={(e) => setView(e.target.value as ProjectView)}>
            {VIEWS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <label className="ed__check">
          <input type="checkbox" checked={isFolder} onChange={(e) => setIsFolder(e.target.checked)} />
          폴더로 만들기 (다른 프로젝트를 담는 용도)
        </label>
        <label className="ed__check">
          <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
          즐겨찾기
        </label>
        <footer className="ed__foot">
          {existing && existing.id !== INBOX_ID ? (
            <button type="button" className="ed__danger" onClick={remove}>
              <Trash2 size={14} aria-hidden="true" /> 삭제
            </button>
          ) : null}
          <span className="ed__spacer" />
          <button type="button" className="qa__cancel" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="qa__submit" disabled={!name.trim()}>
            {existing ? '저장' : '추가'}
          </button>
        </footer>
      </form>
    </FormShell>
  )
}

function LabelForm({ target, onClose }: { target: EntityDialogTarget; onClose: () => void }) {
  const labels = useTable('labels')
  const commit = useApp((s) => s.commit)
  const navigate = useNavigate()
  const existing = labels.find((l) => l.id === target.id)
  const [name, setName] = useState(existing?.name ?? '')
  const [color, setColor] = useState(existing?.color ?? PALETTE[(labels.length + 1) % PALETTE.length])
  const clean = name.trim().replace(/^[@%#]+/, '')
  const duplicate = labels.some((l) => l.id !== existing?.id && l.name.toLowerCase() === clean.toLowerCase())

  const save = () => {
    if (!clean || duplicate) return
    const state = useApp.getState().entities
    if (existing) commit(patchLabel(state, existing.id, { name: clean, color }), '라벨 수정')
    else commit(createLabel(state, { name: clean, color }).changes, '라벨 추가')
    onClose()
  }

  return (
    <FormShell title={existing ? '라벨 편집' : '라벨 추가'} onClose={onClose}>
      <form className="ed__form" onSubmit={(e) => { e.preventDefault(); save() }}>
        <label className="ed__field">
          <span>이름</span>
          <input autoFocus data-autofocus value={name} onChange={(e) => setName(e.target.value)} placeholder="예) 집중필요" />
        </label>
        {duplicate ? <p className="ed__error">같은 이름의 라벨이 있어요</p> : null}
        <div className="ed__field">
          <span>색</span>
          <Swatches value={color} onChange={setColor} />
        </div>
        <footer className="ed__foot">
          {existing ? (
            <button
              type="button"
              className="ed__danger"
              onClick={() => {
                commit(deleteLabel(useApp.getState().entities, existing.id, Date.now()), '라벨 삭제')
                onClose()
                navigate(paths.inbox)
              }}
            >
              <Trash2 size={14} aria-hidden="true" /> 삭제
            </button>
          ) : null}
          <span className="ed__spacer" />
          <button type="button" className="qa__cancel" onClick={onClose}>취소</button>
          <button type="submit" className="qa__submit" disabled={!clean || duplicate}>{existing ? '저장' : '추가'}</button>
        </footer>
      </form>
    </FormShell>
  )
}

function FilterForm({ target, onClose }: { target: EntityDialogTarget; onClose: () => void }) {
  const filters = useTable('filters')
  const commit = useApp((s) => s.commit)
  const navigate = useNavigate()
  const ctx = useEngineContext()
  const existing = filters.find((f) => f.id === target.id)
  const [name, setName] = useState(existing?.name ?? '')
  const [query, setQuery] = useState(existing?.query ?? target.query ?? '')
  const [color, setColor] = useState(existing?.color ?? PALETTE[(filters.length + 2) % PALETTE.length])

  const result = useMemo(() => (query.trim() ? runFilter(query, ctx) : null), [query, ctx])
  const parsed = useMemo(() => (query.trim() ? parseFilter(query) : null), [query])
  const count = result?.ok ? result.groups.reduce((n, g) => n + g.length, 0) : null

  const save = () => {
    if (!name.trim() || !parsed?.ok) return
    const state = useApp.getState().entities
    if (existing) commit(patchFilter(state, existing.id, { name: name.trim(), query: query.trim(), color }), '필터 수정')
    else {
      const { filter, changes } = createFilter(state, { name, query, color })
      commit(changes, '필터 추가')
      navigate(paths.filter(filter.id))
    }
    onClose()
  }

  return (
    <FormShell title={existing ? '필터 편집' : '필터 추가'} onClose={onClose}>
      <form className="ed__form" onSubmit={(e) => { e.preventDefault(); save() }}>
        <label className="ed__field">
          <span>이름</span>
          <input autoFocus data-autofocus value={name} onChange={(e) => setName(e.target.value)} placeholder="예) 이번 주 급한 일" />
        </label>
        <label className="ed__field">
          <span>조건</span>
          <textarea rows={2} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="(오늘 | 기한초과) & p1  /  7 days & #업무  /  @집중필요 & !반복" spellCheck={false} />
        </label>
        {parsed && !parsed.ok ? (
          <p className="ed__error" role="alert">
            {parsed.error.message} <small>(위치 {parsed.error.position + 1})</small>
          </p>
        ) : null}
        {parsed?.ok ? (
          <p className="ed__preview">
            {describeFilter(query)} — <strong>{count}개</strong>가 해당돼요
          </p>
        ) : (
          <details className="ed__syntax">
            <summary>조건 문법 보기</summary>
            <ul>
              <li><code>today</code> <code>tomorrow</code> <code>overdue</code> <code>no date</code> <code>7 days</code> / 한글: 오늘 내일 기한초과 날짜없음</li>
              <li><code>p1</code>~<code>p4</code> · <code>#프로젝트</code> · <code>##하위포함</code> · <code>/섹션</code> · <code>@라벨</code></li>
              <li><code>&amp;</code> 그리고 · <code>|</code> 또는 · <code>!</code> 아님 · <code>( )</code> 묶음 · <code>,</code> 목록 나누기</li>
              <li><code>search: 단어</code> · <code>deadline: 날짜</code> · <code>recurring</code> · <code>subtask</code> · <code>estimate &gt; 30m</code></li>
            </ul>
          </details>
        )}
        <div className="ed__field">
          <span>색</span>
          <Swatches value={color} onChange={setColor} />
        </div>
        <footer className="ed__foot">
          {existing ? (
            <button
              type="button"
              className="ed__danger"
              onClick={() => {
                commit(deleteFilter(useApp.getState().entities, existing.id), '필터 삭제')
                onClose()
                navigate(paths.inbox)
              }}
            >
              <Trash2 size={14} aria-hidden="true" /> 삭제
            </button>
          ) : null}
          <span className="ed__spacer" />
          <button type="button" className="qa__cancel" onClick={onClose}>취소</button>
          <button type="submit" className="qa__submit" disabled={!name.trim() || !parsed?.ok}>{existing ? '저장' : '추가'}</button>
        </footer>
      </form>
    </FormShell>
  )
}
