import { Plus, Settings2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { BoardView } from '../../features/board/BoardView'
import { CalendarView } from '../../features/calendar/CalendarView'
import { ViewOptionsBar } from '../../features/lists/ViewOptionsBar'
import { applyOptions, readOptions } from '../../features/lists/viewOptions'
import { MatrixView } from '../../features/matrix/MatrixView'
import { SectionHeader } from '../../features/projects/SectionHeader'
import { useProjectView, ViewSwitcher } from '../../features/projects/ViewSwitcher'
import { SelectionBar } from '../../features/tasks/SelectionBar'
import { TaskList } from '../../features/tasks/TaskList'
import { TimelineView } from '../../features/timeline/TimelineView'
import { useEngineContext, useSettings, useTable } from '../../hooks/data'
import { isHiddenUntilStart } from '../../domain/planning'
import { useApp } from '../../store/app'
import { createSection } from '../../store/commands/entityCommands'
import { useUI } from '../../store/ui'
import { PageHeader } from '../PageHeader'
import { paths } from '../nav'

export function ProjectPage() {
  const { id = '' } = useParams()
  const ctx = useEngineContext()
  const projects = useTable('projects')
  const project = projects.find((p) => p.id === id && p.deletedAt === null)
  const [params] = useSearchParams()
  const view = useProjectView(project?.defaultView ?? 'list')
  const openEntityDialog = useUI((s) => s.openEntityDialog)

  const opts = readOptions(params)
  const tasks = useMemo(() => ctx.tasks.filter((t) => t.projectId === id && t.deletedAt === null), [ctx.tasks, id])
  const sections = useMemo(
    () => ctx.sections.filter((s) => s.projectId === id).sort((a, b) => a.order - b.order),
    [ctx.sections, id],
  )
  const openCount = tasks.filter((t) => t.status === 'todo' || t.status === 'active').length

  if (!project) return <Navigate to={paths.inbox} replace />

  return (
    <>
      <PageHeader
        title={project.name}
        eyebrow={project.isFolder ? '폴더' : '프로젝트'}
        count={openCount}
        actions={
          <>
            <ViewSwitcher current={view} fallback={project.defaultView} />
            <button type="button" className="icon-btn" aria-label="프로젝트 설정" onClick={() => openEntityDialog({ kind: 'project', id: project.id })}>
              <Settings2 size={18} aria-hidden="true" />
            </button>
          </>
        }
      />
      {view === 'list' ? <ProjectList projectId={id} tasks={tasks} sections={sections} opts={opts} /> : null}
      {view === 'board' ? <BoardView projectId={id} tasks={tasks} sections={sections} /> : null}
      {view === 'calendar' ? <CalendarView tasks={tasks} defaults={{ projectId: id }} /> : null}
      {view === 'timeline' ? <TimelineView tasks={tasks} /> : null}
      {view === 'matrix' ? <MatrixView tasks={tasks} /> : null}
      <SelectionBar />
    </>
  )
}

interface ProjectListProps {
  projectId: string
  tasks: ReturnType<typeof useEngineContext>['tasks']
  sections: ReturnType<typeof useEngineContext>['sections']
  opts: ReturnType<typeof readOptions>
}

function ProjectList({ projectId, tasks, sections, opts }: ProjectListProps) {
  const ctx = useEngineContext()
  const { hideFutureTasks } = useSettings()
  const commit = useApp((s) => s.commit)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  // 직접 정렬 + 그룹 없음일 때만 섹션 구조를 그대로 보여준다. 다른 정렬·그룹을 고르면 평면으로 바뀐다.
  const bySection = opts.group === 'none' && opts.sort === 'manual'
  // "시작 전 할 일 숨기기" 설정이 켜져 있으면 시작일이 아직 안 된 할 일은 프로젝트 목록에서 뺀다.
  const started = hideFutureTasks ? tasks.filter((t) => !isHiddenUntilStart(t, ctx.today)) : tasks
  const visible = opts.showDone ? started : started.filter((t) => t.status !== 'done' && t.status !== 'canceled')

  const addSection = () => {
    const title = name.trim()
    setAdding(false)
    setName('')
    if (!title) return
    commit(createSection(useApp.getState().entities, { projectId, name: title }).changes, '섹션 추가')
  }

  return (
    <>
      <ViewOptionsBar hideGroups={['project']} />
      {bySection ? (
        <>
          <TaskList
            groups={[{ key: 'none', title: '', tasks: visible.filter((t) => !t.sectionId || !sections.some((s) => s.id === t.sectionId)) }]}
            empty={sections.length === 0 && visible.length === 0 ? '이 프로젝트에는 아직 할 일이 없어요.' : undefined}
            addDefaults={{ projectId }}
            sortable
          />
          {sections.map((s) => {
            const inSection = visible.filter((t) => t.sectionId === s.id)
            return (
              <section key={s.id} aria-label={s.name}>
                <SectionHeader section={s} count={inSection.length} />
                <TaskList groups={[{ key: s.id, title: '', tasks: inSection }]} addDefaults={{ projectId, sectionId: s.id }} sortable />
              </section>
            )
          })}
          <div className="add-section">
            {adding ? (
              <input
                autoFocus
                value={name}
                placeholder="섹션 이름"
                aria-label="새 섹션 이름"
                onChange={(e) => setName(e.target.value)}
                onBlur={addSection}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) addSection()
                  if (e.key === 'Escape') {
                    setName('')
                    setAdding(false)
                  }
                }}
              />
            ) : (
              <button type="button" onClick={() => setAdding(true)}>
                <Plus size={14} aria-hidden="true" /> 섹션 추가
              </button>
            )}
          </div>
        </>
      ) : (
        <TaskList groups={applyOptions(started, opts, ctx)} nested={opts.group === 'none'} addDefaults={{ projectId }} empty="조건에 맞는 할 일이 없어요." />
      )}
    </>
  )
}
