import { SettingsView } from '../../features/settings/SettingsView'

/** 설정 화면. /settings/:tab 의 탭 id 로 구역을 고른다(general, appearance, modules, notifications, shortcuts, data, templates, about). */
export function SettingsPage() {
  return <SettingsView />
}
