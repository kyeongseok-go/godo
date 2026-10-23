// 설정 탭 정의. id 는 URL(/settings/:tab)에 그대로 쓰이므로 바꾸지 않는다.
export const SETTINGS_TABS = [
  { id: 'general', label: '일반', short: '일반' },
  { id: 'appearance', label: '모양', short: '모양' },
  { id: 'modules', label: '사이드바·모듈', short: '모듈' },
  { id: 'notifications', label: '알림', short: '알림' },
  { id: 'shortcuts', label: '단축키', short: '단축키' },
  { id: 'data', label: '데이터', short: '데이터' },
  { id: 'templates', label: '템플릿', short: '템플릿' },
  { id: 'about', label: '정보', short: '정보' },
] as const

export type SettingsTabId = (typeof SETTINGS_TABS)[number]['id']

export function parseTabId(raw: string | undefined): SettingsTabId | null {
  return SETTINGS_TABS.find((t) => t.id === raw)?.id ?? null
}
