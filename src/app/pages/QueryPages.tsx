import { Pencil, Search as SearchIcon } from 'lucide-react'
import { useMemo } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { describeFilter, runFilter } from '../../domain/filter'
import type { Task } from '../../domain/types'
import { CalendarView } from '../../features/calendar/CalendarView'
import { ViewOptionsBar } from '../../features/lists/ViewOptionsBar'
import { applyOptions, readOptions } from '../../features/lists/viewOptions'
import { MatrixView } from '../../features/matrix/MatrixView'
import { SelectionBar } from '../../features/tasks/SelectionBar'
import { TaskList } from '../../features/tasks/TaskList'
import { TimelineView } from '../../features/timeline/TimelineView'
import { useEngineContext, useTable } from '../../hooks/data'
import { matchScore } from '../../features/palette/search'
import { useUI } from '../../store/ui'
import { PageHeader } from '../PageHeader'
import { paths } from '../nav'

const isOpen = (t: Task): boolean => t.deletedAt === null && (t.status === 'todo' || t.status === 'active')

export function LabelPage() {
  const { id = '' } = useParams()
  const ctx = useEngineContext()
  const labels = useTable('labels')
  const [params] = useSearchParams()
  const label = labels.find((l) => l.id === id)
  const opts = readOptions(params)
  const openEntityDialog = useUI((s) => s.openEntityDialog)
  const tasks = useMemo(() => ctx.tasks.filter((t) => t.deletedAt === null && t.labelIds.includes(id)), [ctx.tasks, id])
  if (!label) return <Navigate to={paths.inbox} replace />
  const groups = applyOptions(tasks, opts, ctx)
  return (
    <>
      <PageHeader
        title={`# ${label.name}`}
        eyebrow="라벨"
        count={tasks.filter(isOpen).length}
        actions={
          <button type="button" className="icon-btn" aria-label="라벨 편집" onClick={() => openEntityDialog({ kind: 'label', id })}>
            <Pencil size={17} aria-hidden="true" />
          </button>
        }
      />
      <ViewOptionsBar />
      <TaskList groups={groups} showProject nested={false} empty="이 라벨이 붙은 할 일이 없어요." />
      <SelectionBar />
    </>
  )
}

export function FilterPage() {
  const { id = '' } = useParams()
  const ctx = useEngineContext()
  const filters = useTable('filters')
  const openEntityDialog = useUI((s) => s.openEntityDialog)
  const filter = filters.find((f) => f.id === id)
  const result = useMemo(() => (filter ? runFilter(filter.query, ctx) : null), [filter, ctx])
  if (!filter) return <Navigate to={paths.inbox} replace />

  // 쉼표로 나눈 묶음은 각각 제목 없는 그룹으로 이어서 보여준다.
  const groups = result?.ok
    ? result.groups.map((tasks, i) => ({ key: `g${i}`, title: result.groups.length > 1 ? `묶음 ${i + 1}` : '', tasks }))
    : []
  const count = groups.reduce((n, g) => n + g.tasks.length, 0)

  return (
    <>
      <PageHeader
        title={filter.name}
        eyebrow="필터"
        count={result?.ok ? count : undefined}
        description={result?.ok ? <code>{filter.query}</code> : undefined}
        actions={
          <button type="button" className="icon-btn" aria-label="필터 편집" onClick={() => openEntityDialog({ kind: 'filter', id })}>
            <Pencil size={17} aria-hidden="true" />
          </button>
        }
      />
      {result && !result.ok ? (
        <p className="page-error" role="alert">
          조건을 해석하지 못했어요: {result.error.message} (위치 {result.error.position + 1})
        </p>
      ) : (
        <>
          <p className="page-note">{describeFilter(filter.query)}</p>
          <TaskList groups={groups} showProject nested={false} empty="조건에 맞는 할 일이 없어요." />
        </>
      )}
      <SelectionBar />
    </>
  )
}

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const ctx = useEngineContext()
  const comments = useTable('comments')
  const q = params.get('q') ?? ''
  const showDone = params.get('done') !== '0'
  const openEntityDialog = useUI((s) => s.openEntityDialog)

  const groups = useMemo(() => {
    if (!q.trim()) return []
    const commentText = new Map<string, string>()
    for (const c of comments) commentText.set(c.taskId, `${commentText.get(c.taskId) ?? ''} ${c.body}`)
    // 제목에서 맞으면 설명·댓글에서만 맞은 것보다 위로 올린다.
    const hits = ctx.tasks
      .filter((t) => t.deletedAt === null && (showDone || isOpen(t)))
      .map((t) => {
        const inTitle = matchScore(t.title, q)
        const inBody = matchScore(`${t.title} ${t.description} ${commentText.get(t.id) ?? ''}`, q)
        return { t, score: inBody === 0 ? 0 : inBody + (inTitle > 0 ? 10 + inTitle : 0) }
      })
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((h) => h.t)
    return [{ key: 'hits', title: '', tasks: hits }]
  }, [q, ctx.tasks, comments, showDone])

  const count = groups[0]?.tasks.length ?? 0
  return (
    <>
      <PageHeader title="검색" eyebrow="제목 · 설명 · 댓글" count={q.trim() ? count : undefined} />
      <div className="searchbar">
        <SearchIcon size={18} aria-hidden="true" />
        <input
          autoFocus
          type="search"
          value={q}
          placeholder="찾을 말을 입력하세요"
          aria-label="검색어"
          onChange={(e) => setParams((p) => { const n = new URLSearchParams(p); if (e.target.value) n.set('q', e.target.value); else n.delete('q'); return n }, { replace: true })}
        />
        <label>
          <input type="checkbox" checked={showDone} onChange={(e) => setParams((p) => { const n = new URLSearchParams(p); if (e.target.checked) n.delete('done'); else n.set('done', '0'); return n }, { replace: true })} />
          완료 포함
        </label>
        {q.trim() && count > 0 ? (
          <button type="button" className="btn-ghost" onClick={() => openEntityDialog({ kind: 'filter', query: `search: ${/\s/.test(q) ? `"${q.replaceAll('"', '')}"` : q}` })}>
            필터로 저장
          </button>
        ) : null}
      </div>
      <TaskList groups={groups} showProject nested={false} empty={q.trim() ? '검색 결과가 없어요.' : '검색어를 입력하면 결과가 여기에 나와요.'} />
    </>
  )
}

function useOpenTasks(): Task[] {
  const ctx = useEngineContext()
  return useMemo(() => ctx.tasks.filter((t) => t.deletedAt === null), [ctx.tasks])
}

export function CalendarPage() {
  const tasks = useOpenTasks()
  return (
    <>
      <PageHeader title="캘린더" eyebrow="시간으로 보기" />
      <CalendarView tasks={tasks} />
    </>
  )
}

export function MatrixPage() {
  const tasks = useOpenTasks()
  return (
    <>
      <PageHeader title="아이젠하워 매트릭스" eyebrow="중요도로 보기" description="우선순위가 4분면을 정해요. 카드를 끌어 옮기면 우선순위가 바뀝니다." />
      <MatrixView tasks={tasks} />
    </>
  )
}

export function TimelinePage() {
  const tasks = useOpenTasks()
  return (
    <>
      <PageHeader title="타임라인" eyebrow="기간으로 보기" description="시작일부터 마감일까지를 막대로 보여줘요." />
      <TimelineView tasks={tasks} />
    </>
  )
}
