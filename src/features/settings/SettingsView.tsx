import { lazy, Suspense } from 'react'
import { Navigate, NavLink, useParams } from 'react-router-dom'
import { paths } from '../../app/nav'
import { PageHeader } from '../../app/PageHeader'
import { AboutTab } from './AboutTab'
import { AppearanceTab } from './AppearanceTab'
import { GeneralTab } from './GeneralTab'
import { ModulesTab } from './ModulesTab'
import { NotificationsTab } from './NotificationsTab'
import { ShortcutsTab } from './ShortcutsTab'
import { parseTabId, SETTINGS_TABS } from './tabs'
import type { SettingsTabId } from './tabs'
import './settings.css'

// 데이터·템플릿 탭은 백업/검증 코드(zod 등)를 끌고 오므로 열 때만 불러온다.
const DataTab = lazy(async () => ({ default: (await import('../data/DataTab')).DataTab }))
const TemplatesTab = lazy(async () => ({ default: (await import('../templates/TemplatesTab')).TemplatesTab }))

function renderTab(id: SettingsTabId) {
  switch (id) {
    case 'general':
      return <GeneralTab />
    case 'appearance':
      return <AppearanceTab />
    case 'modules':
      return <ModulesTab />
    case 'notifications':
      return <NotificationsTab />
    case 'shortcuts':
      return <ShortcutsTab />
    case 'data':
      return <DataTab />
    case 'templates':
      return <TemplatesTab />
    case 'about':
      return <AboutTab />
  }
}

/** /settings/:tab. 탭 id 는 URL 이 정하고, 모르는 id 는 첫 탭으로 보낸다. */
export function SettingsView() {
  const { tab } = useParams()
  const id = parseTabId(tab)
  if (!id) return <Navigate to={paths.settings()} replace />
  const current = SETTINGS_TABS.find((t) => t.id === id)

  return (
    <>
      <PageHeader title="설정" description="바꾸는 즉시 저장돼요. 모든 데이터는 이 브라우저 안에만 있어요." />
      <div className="st">
        <nav className="st-tabs" aria-label="설정 구역">
          {SETTINGS_TABS.map((t) => (
            <NavLink key={t.id} to={paths.settings(t.id)} className="st-tab" replace>
              <span className="st-tab__long">{t.label}</span>
              <span className="st-tab__short">{t.short}</span>
            </NavLink>
          ))}
        </nav>
        <section className="st-panel" aria-labelledby="st-panel-title">
          <h2 id="st-panel-title" className="st-panel__title">
            {current?.label}
          </h2>
          <Suspense fallback={<p className="st-loading" role="status">불러오는 중…</p>}>{renderTab(id)}</Suspense>
        </section>
      </div>
    </>
  )
}
