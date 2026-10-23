import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAutoSnapshots, usePurgeExpiredTrash } from '../features/data'
import { useApp } from '../store/app'
import { useBeforeUnloadGuard, useCrossTabSync, useStaleDb, useStorageGuard } from './appGuards'
import { homePath, paths } from './nav'
import { ProjectPage } from './pages/ProjectPage'
import { CalendarPage, FilterPage, LabelPage, MatrixPage, SearchPage, TimelinePage } from './pages/QueryPages'
import { SmartListPage } from './pages/SmartListPage'
import { Shell } from './Shell'

import { useAppliedSettings } from './useAppliedSettings'

// 자주 열지 않는 화면은 나눠서 불러온다(첫 로딩을 가볍게).
const lazyPage = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(async () => ({ default: (await load())[name] }))
const HabitsPage = lazyPage(() => import('./pages/HabitsPage'), 'HabitsPage')
const FocusPage = lazyPage(() => import('./pages/FocusPage'), 'FocusPage')
const CountdownPage = lazyPage(() => import('./pages/CountdownPage'), 'CountdownPage')
const ProductivityPage = lazyPage(() => import('./pages/ProductivityPage'), 'ProductivityPage')
const SummaryPage = lazyPage(() => import('./pages/SummaryPage'), 'SummaryPage')
const ReviewPage = lazyPage(() => import('./pages/ReviewPage'), 'ReviewPage')
const ReplanPage = lazyPage(() => import('./pages/ReplanPage'), 'ReplanPage')
const PlanPage = lazyPage(() => import('./pages/PlanPage'), 'PlanPage')
const HelpPage = lazyPage(() => import('./pages/HelpPage'), 'HelpPage')
const SettingsPage = lazyPage(() => import('./pages/SettingsPage'), 'SettingsPage')

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="boot" role="status">불러오는 중…</div>}>{children}</Suspense>
}

/** 데이터가 준비된 뒤에만 도는 백그라운드 작업: 자동 스냅샷, 만료된 휴지통 정리 */
function BackgroundTasks() {
  useAutoSnapshots()
  usePurgeExpiredTrash()
  return null
}

function Home() {
  const homeView = useApp((s) => s.settings.homeView)
  return <Navigate to={homePath(homeView)} replace />
}

function BootScreen({ loadError }: { loadError: string | null }) {
  const reload = useApp((s) => s.reload)
  if (!loadError) return <div className="boot" role="status">불러오는 중…</div>
  return (
    <div className="boot boot--error" role="alert">
      <h1>데이터를 불러오지 못했어요</h1>
      <p>{loadError}</p>
      <p className="boot__hint">시크릿 모드이거나 저장 공간이 막혀 있으면 이런 일이 생겨요. 다시 시도해도 안 되면 다른 탭을 모두 닫고 새로고침해 보세요. 데이터는 지워지지 않았어요.</p>
      <div>
        <button type="button" className="btn-accent" onClick={() => reload().catch(() => undefined)}>다시 시도</button>
        <button type="button" className="btn-ghost" onClick={() => location.reload()}>새로고침</button>
      </div>
    </div>
  )
}

function StaleNotice() {
  return (
    <div className="stale" role="alertdialog" aria-labelledby="stale-title">
      <h1 id="stale-title">다른 탭에서 앱을 업데이트했어요</h1>
      <p>이 탭은 낡은 상태라 더 저장하면 데이터가 꼬일 수 있어요. 새로고침해 주세요.</p>
      <button type="button" className="btn-accent" onClick={() => location.reload()}>새로고침</button>
    </div>
  )
}

export function App() {
  const ready = useApp((s) => s.ready)
  const loadError = useApp((s) => s.loadError)
  const load = useApp((s) => s.load)
  const stale = useStaleDb()

  useEffect(() => {
    // 실패는 loadError로 화면에 나오므로 여기서는 삼켜도 된다.
    load().catch(() => undefined)
  }, [load])
  useAppliedSettings()
  useBeforeUnloadGuard()
  useCrossTabSync()
  useStorageGuard()

  if (stale) return <StaleNotice />
  if (!ready) return <BootScreen loadError={loadError} />

  return (
    <HashRouter>
      <BackgroundTasks />
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Home />} />
          <Route path="inbox" element={<SmartListPage id="inbox" />} />
          <Route path="today" element={<SmartListPage id="today" />} />
          <Route path="upcoming" element={<SmartListPage id="upcoming" />} />
          <Route path="now" element={<SmartListPage id="now" />} />
          <Route path="all" element={<SmartListPage id="all" />} />
          <Route path="someday" element={<SmartListPage id="someday" />} />
          <Route path="completed" element={<SmartListPage id="completed" />} />
          <Route path="canceled" element={<SmartListPage id="canceled" />} />
          <Route path="trash" element={<SmartListPage id="trash" />} />
          <Route path="project/:id" element={<ProjectPage />} />
          <Route path="label/:id" element={<LabelPage />} />
          <Route path="filter/:id" element={<FilterPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="matrix" element={<MatrixPage />} />
          <Route path="timeline" element={<TimelinePage />} />
          <Route path="habits" element={<Lazy><HabitsPage /></Lazy>} />
          <Route path="focus" element={<Lazy><FocusPage /></Lazy>} />
          <Route path="countdown" element={<Lazy><CountdownPage /></Lazy>} />
          <Route path="productivity" element={<Lazy><ProductivityPage /></Lazy>} />
          <Route path="summary" element={<Lazy><SummaryPage /></Lazy>} />
          <Route path="review" element={<Lazy><ReviewPage /></Lazy>} />
          <Route path="replan" element={<Lazy><ReplanPage /></Lazy>} />
          <Route path="help" element={<Lazy><HelpPage /></Lazy>} />
          <Route path="plan" element={<Lazy><PlanPage /></Lazy>} />
          <Route path="settings" element={<Navigate to={paths.settings()} replace />} />
          <Route path="settings/:tab" element={<Lazy><SettingsPage /></Lazy>} />
          <Route path="*" element={<Navigate to={paths.today} replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
