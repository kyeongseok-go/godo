import {
  Archive,
  BarChart3,
  Brain,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  ClipboardList,
  Filter as FilterIcon,
  FolderClosed,
  CircleHelp,
  Gauge,
  Hash,
  Inbox,
  LayoutGrid,
  Moon,
  Plus,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  Star,
  Sun,
  Timer,
  Trash2,
  Waypoints,
  Zap,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useEngineContext, useSettings, useTable } from '../hooks/data'
import { smartListCounts, projectOpenCount } from '../features/lists/smartLists'
import { buildProjectTree } from '../features/projects/projectTree'
import type { ProjectNode } from '../features/projects/projectTree'
import { useUI } from '../store/ui'
import { paths } from './nav'
import './sidebar.css'

interface NavItemProps {
  to: string
  icon: ReactNode
  label: string
  count?: number
  color?: string
  end?: boolean
}

function NavItem({ to, icon, label, count, color, end }: NavItemProps) {
  const closeSidebar = useUI((s) => s.setSidebarOpen)
  return (
    <NavLink
      to={to}
      end={end}
      className="nav-item"
      onClick={() => closeSidebar(false)}
      style={color ? { ['--item-color' as string]: color } : undefined}
    >
      <span className="nav-item__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="nav-item__label">{label}</span>
      {count !== undefined && count > 0 ? <span className="nav-item__count">{count}</span> : null}
    </NavLink>
  )
}

interface SectionProps {
  title: string
  onAdd?: () => void
  addLabel?: string
  children: ReactNode
  defaultOpen?: boolean
}

function NavSection({ title, onAdd, addLabel, children, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="nav-section">
      <div className="nav-section__head">
        <button
          type="button"
          className="nav-section__toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronRight size={12} data-open={open} aria-hidden="true" />
          {title}
        </button>
        {onAdd ? (
          <button type="button" className="nav-section__add" aria-label={addLabel ?? `${title} 추가`} onClick={onAdd}>
            <Plus size={14} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {open ? <div className="nav-section__body">{children}</div> : null}
    </section>
  )
}

function ProjectItems({ nodes, counts }: { nodes: readonly ProjectNode[]; counts: ReadonlyMap<string, number> }) {
  return (
    <>
      {nodes.map(({ project, children }) => (
        <div key={project.id}>
          <NavItem
            to={paths.project(project.id)}
            label={project.name}
            count={project.isFolder ? undefined : counts.get(project.id)}
            icon={
              project.isFolder ? (
                <FolderClosed size={15} />
              ) : (
                <i className="dot dot--lg" style={{ background: project.color }} />
              )
            }
          />
          {children.length > 0 ? (
            <div className="nav-children">
              <ProjectItems nodes={children} counts={counts} />
            </div>
          ) : null}
        </div>
      ))}
    </>
  )
}

export function Sidebar() {
  const ctx = useEngineContext()
  const settings = useSettings()
  const projects = useTable('projects')
  const labels = useTable('labels')
  const filters = useTable('filters')
  const openQuickAdd = useUI((s) => s.openQuickAdd)
  const setPalette = useUI((s) => s.setPalette)
  const openEntityDialog = useUI((s) => s.openEntityDialog)

  const counts = useMemo(() => smartListCounts(ctx), [ctx])
  const tree = useMemo(() => buildProjectTree(projects), [projects])
  const projectCounts = useMemo(
    () => new Map(projects.map((p) => [p.id, projectOpenCount(ctx, p.id)])),
    [projects, ctx],
  )
  const favorites = projects.filter((p) => p.favorite && !p.archived && p.deletedAt === null)
  const sortedLabels = [...labels].sort((a, b) => a.order - b.order)
  const sortedFilters = [...filters].sort((a, b) => a.order - b.order)
  const { sidebar, modules } = settings
  const showCount = (n: number): number | undefined => (sidebar.showCounts ? n : undefined)

  return (
    <nav className="sidebar" aria-label="주 메뉴">
      <div className="sidebar__brand">
        <span className="sidebar__logo">Pace</span>
        <span className="sidebar__tag">나만의 할 일</span>
      </div>

      <div className="sidebar__actions">
        <button type="button" className="btn-accent" onClick={() => openQuickAdd()}>
          <Plus size={16} aria-hidden="true" />
          작업 추가
          <kbd>Q</kbd>
        </button>
        <button type="button" className="btn-ghost" onClick={() => setPalette(true)} aria-label="검색 및 명령 ⌘K">
          <Search size={16} aria-hidden="true" />
          <kbd>⌘K</kbd>
        </button>
      </div>

      <div className="sidebar__scroll">
        <div className="nav-group">
          <NavItem to={paths.inbox} icon={<Inbox size={16} />} label="받은편지함" count={showCount(counts.inbox)} />
          {sidebar.showToday ? (
            <NavItem to={paths.today} icon={<Sun size={16} />} label="오늘" count={showCount(counts.today)} />
          ) : null}
          {sidebar.showUpcoming ? (
            <NavItem to={paths.upcoming} icon={<CalendarDays size={16} />} label="다음 7일" count={showCount(counts.upcoming)} />
          ) : null}
          {sidebar.showAnytime ? (
            <NavItem to={paths.now} icon={<Zap size={16} />} label="지금 할 수 있는 것" count={showCount(counts.now)} />
          ) : null}
        </div>

        <NavSection title="보기">
          {modules.calendar ? <NavItem to={paths.calendar} icon={<CalendarDays size={16} />} label="캘린더" /> : null}
          {modules.matrix ? <NavItem to={paths.matrix} icon={<LayoutGrid size={16} />} label="아이젠하워 매트릭스" /> : null}
          {modules.timeline ? <NavItem to={paths.timeline} icon={<Waypoints size={16} />} label="타임라인" /> : null}
          {modules.habits ? <NavItem to={paths.habits} icon={<Sparkles size={16} />} label="습관" /> : null}
          {modules.focus ? <NavItem to={paths.focus} icon={<Timer size={16} />} label="집중" /> : null}
          {modules.countdown ? <NavItem to={paths.countdown} icon={<Gauge size={16} />} label="디데이" /> : null}
        </NavSection>

        <NavSection title="하루 정리" defaultOpen={false}>
          <NavItem to={paths.plan} icon={<Brain size={16} />} label="오늘 계획하기" />
          <NavItem to={paths.replan} icon={<Moon size={16} />} label="미완료 정리" />
          <NavItem to={paths.review} icon={<ClipboardList size={16} />} label="주간 리뷰" />
          <NavItem to={paths.summary} icon={<BarChart3 size={16} />} label="요약 보고서" />
          <NavItem to={paths.productivity} icon={<Gauge size={16} />} label="생산성" />
        </NavSection>

        {favorites.length > 0 ? (
          <NavSection title="즐겨찾기">
            {favorites.map((p) => (
              <NavItem
                key={p.id}
                to={paths.project(p.id)}
                label={p.name}
                count={showCount(projectCounts.get(p.id) ?? 0)}
                icon={<Star size={14} fill={p.color} stroke={p.color} />}
              />
            ))}
          </NavSection>
        ) : null}

        <NavSection title="프로젝트" onAdd={() => openEntityDialog({ kind: 'project' })} addLabel="프로젝트 추가">
          {tree.length === 0 ? <p className="nav-empty">프로젝트를 만들어 할 일을 묶어 보세요.</p> : null}
          <ProjectItems nodes={tree} counts={sidebar.showCounts ? projectCounts : new Map()} />
        </NavSection>

        <NavSection title="라벨" onAdd={() => openEntityDialog({ kind: 'label' })} addLabel="라벨 추가">
          {sortedLabels.map((l) => (
            <NavItem key={l.id} to={paths.label(l.id)} label={l.name} icon={<Hash size={15} color={l.color} />} />
          ))}
        </NavSection>

        <NavSection title="필터" onAdd={() => openEntityDialog({ kind: 'filter' })} addLabel="필터 추가">
          {sortedFilters.map((f) => (
            <NavItem key={f.id} to={paths.filter(f.id)} label={f.name} icon={<FilterIcon size={15} color={f.color} />} />
          ))}
        </NavSection>
      </div>

      <div className="sidebar__foot">
        {sidebar.showSomeday ? <NavItem to={paths.someday} icon={<Archive size={16} />} label="언젠가" /> : null}
        {sidebar.showCompleted ? <NavItem to={paths.completed} icon={<CheckCheck size={16} />} label="완료" /> : null}
        <NavItem to={paths.trash} icon={<Trash2 size={16} />} label="휴지통" />
        <NavItem to={paths.help} icon={<CircleHelp size={16} />} label="사용 가이드" />
        <NavItem to={paths.settings()} icon={<SettingsIcon size={16} />} label="설정" />
      </div>
    </nav>
  )
}
