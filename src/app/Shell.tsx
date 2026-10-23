import { CalendarDays, Inbox, Menu as MenuIcon, Plus, Sun } from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useUI } from '../store/ui'
import { DetailPanel } from '../features/detail/DetailPanel'
import { QuickAdd } from '../features/quickadd/QuickAdd'
import { CommandPalette } from '../features/palette/CommandPalette'
import { ShortcutsHelp } from '../features/shortcuts/ShortcutsHelp'
import { EntityDialogs } from '../features/projects/EntityDialogs'
import { useGlobalShortcuts } from '../features/shortcuts/useGlobalShortcuts'
import { FocusMini } from '../features/focus/FocusMini'
import { ReminderToasts, useReminders } from '../features/notifications'
import { ToastHost } from '../ui/ToastHost'
import { paths } from './nav'
import { Sidebar } from './Sidebar'
import './shell.css'

export function Shell() {
  const sidebarOpen = useUI((s) => s.sidebarOpen)
  const setSidebarOpen = useUI((s) => s.setSidebarOpen)
  const openQuickAdd = useUI((s) => s.openQuickAdd)
  const { pathname } = useLocation()
  const clearSelection = useUI((s) => s.clearSelection)
  // 다른 화면으로 가면 선택을 비운다. 안 보이는 선택이 남아 있다가 엉뚱한 작업에 적용되는 것을 막는다.
  useEffect(() => {
    clearSelection()
  }, [pathname, clearSelection])
  useGlobalShortcuts()
  useReminders()

  return (
    <div className="shell">
      {/* href="#main"은 해시 라우터와 충돌하므로 버튼으로 포커스만 옮긴다. */}
      <button type="button" className="skip-link" onClick={() => document.getElementById('main')?.focus()}>
        본문으로 건너뛰기
      </button>
      <aside className="shell__sidebar" data-open={sidebarOpen}>
        <Sidebar />
      </aside>
      <button
        type="button"
        className="shell__scrim"
        data-open={sidebarOpen}
        aria-label="메뉴 닫기"
        tabIndex={-1}
        onClick={() => setSidebarOpen(false)}
      />
      <main id="main" className="shell__main" tabIndex={-1}>
        <Outlet />
      </main>
      <DetailPanel />

      <nav className="tabbar" aria-label="빠른 이동">
        <NavLink to={paths.today} className="tabbar__item">
          <Sun size={20} aria-hidden="true" />
          <span>오늘</span>
        </NavLink>
        <NavLink to={paths.upcoming} className="tabbar__item">
          <CalendarDays size={20} aria-hidden="true" />
          <span>다음 7일</span>
        </NavLink>
        <button type="button" className="tabbar__add" aria-label="작업 추가" onClick={() => openQuickAdd()}>
          <Plus size={24} aria-hidden="true" />
        </button>
        <NavLink to={paths.inbox} className="tabbar__item">
          <Inbox size={20} aria-hidden="true" />
          <span>받은편지함</span>
        </NavLink>
        <button type="button" className="tabbar__item" onClick={() => setSidebarOpen(true)}>
          <MenuIcon size={20} aria-hidden="true" />
          <span>메뉴</span>
        </button>
      </nav>

      <QuickAdd />
      <CommandPalette />
      <ShortcutsHelp />
      <EntityDialogs />
      <FocusMini />
      <ReminderToasts />
      <ToastHost />
    </div>
  )
}
