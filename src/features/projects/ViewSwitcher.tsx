import { CalendarDays, Kanban, LayoutGrid, List, Waypoints } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import type { ProjectView } from '../../domain/types'
import { useSettings } from '../../hooks/data'
import './view-switcher.css'

const VIEWS: ReadonlyArray<{ id: ProjectView; label: string; icon: React.ReactNode; module?: 'calendar' | 'matrix' | 'timeline' }> = [
  { id: 'list', label: '목록', icon: <List size={15} /> },
  { id: 'board', label: '칸반', icon: <Kanban size={15} /> },
  { id: 'calendar', label: '캘린더', icon: <CalendarDays size={15} />, module: 'calendar' },
  { id: 'timeline', label: '타임라인', icon: <Waypoints size={15} />, module: 'timeline' },
  { id: 'matrix', label: '매트릭스', icon: <LayoutGrid size={15} />, module: 'matrix' },
]

export function useProjectView(fallback: ProjectView): ProjectView {
  const [params] = useSearchParams()
  const raw = params.get('view')
  return VIEWS.some((v) => v.id === raw) ? (raw as ProjectView) : fallback
}

/** 목록 / 칸반 / 캘린더 / 타임라인 / 매트릭스 전환. 설정에서 끈 모듈은 숨긴다. */
export function ViewSwitcher({ current, fallback }: { current: ProjectView; fallback: ProjectView }) {
  const [, setParams] = useSearchParams()
  const { modules } = useSettings()
  const visible = VIEWS.filter((v) => !v.module || modules[v.module])
  return (
    <div className="vswitch" role="tablist" aria-label="보기 방식">
      {visible.map((v) => (
        <button
          key={v.id}
          type="button"
          role="tab"
          aria-selected={current === v.id}
          title={v.label}
          onClick={() =>
            setParams(
              (p) => {
                const next = new URLSearchParams(p)
                if (v.id === fallback) next.delete('view')
                else next.set('view', v.id)
                return next
              },
              { replace: true },
            )
          }
        >
          {v.icon}
          <span>{v.label}</span>
        </button>
      ))}
    </div>
  )
}
