// 설정 화면의 선택지를 만드는 순수 함수들.
import type { Project, Settings } from '../../domain/types'

export interface SelectOption {
  value: string
  label: string
  group?: string
}

const PROJECT_GROUP = '프로젝트'

const byOrder = (a: Project, b: Project): number => a.order - b.order

function selectableProjects(projects: readonly Project[], currentId: string | null): Project[] {
  return projects
    .filter((p) => !p.isFolder && p.deletedAt === null && (!p.archived || p.id === currentId))
    .sort(byOrder)
}

/** 홈 화면 선택지. 지금 값이 목록에 없어도(지운 프로젝트 등) 빠뜨리지 않고 보여 준다. */
export function homeOptions(homeView: string, projects: readonly Project[], modules: Settings['modules']): SelectOption[] {
  const options: SelectOption[] = [
    { value: 'today', label: '오늘' },
    { value: 'inbox', label: '받은편지함' },
    { value: 'upcoming', label: '다음 7일' },
    { value: 'now', label: '지금 할 수 있는 것' },
    { value: 'all', label: '전체' },
  ]
  if (modules.calendar || homeView === 'calendar') options.push({ value: 'calendar', label: '캘린더' })
  if (modules.matrix || homeView === 'matrix') options.push({ value: 'matrix', label: '아이젠하워 매트릭스' })

  const currentProjectId = homeView.startsWith('project:') ? homeView.slice('project:'.length) : null
  for (const p of selectableProjects(projects, currentProjectId)) {
    options.push({ value: `project:${p.id}`, label: p.name, group: PROJECT_GROUP })
  }
  if (!options.some((o) => o.value === homeView)) {
    options.push({ value: homeView, label: '찾을 수 없는 화면 (오늘로 열려요)' })
  }
  return options
}

/** 새 할 일의 기본 프로젝트 선택지. 받은편지함도 프로젝트 하나로 들어 있다. */
export function projectOptions(projects: readonly Project[], currentId: string): SelectOption[] {
  return selectableProjects(projects, currentId).map((p) => ({ value: p.id, label: p.name }))
}

const FALLBACK_TIME_ZONES = [
  'Asia/Seoul',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Kolkata',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Australia/Sydney',
  'Pacific/Auckland',
]

/** 브라우저가 알려 주는 시간대 이름 목록. 지원하지 않으면 null. */
export function supportedTimeZones(): string[] | null {
  const intl = Intl as unknown as { supportedValuesOf?: (key: 'timeZone') => string[] }
  try {
    return intl.supportedValuesOf ? intl.supportedValuesOf('timeZone') : null
  } catch {
    return null
  }
}

export function timeZoneOptions(current: string, supported: readonly string[] | null): string[] {
  const all = new Set([...(supported ?? FALLBACK_TIME_ZONES), 'UTC', current])
  return [...all].sort((a, b) => a.localeCompare(b))
}

export function reminderLabel(offsetMin: number): string {
  if (offsetMin === 0) return '정각'
  if (offsetMin % 1440 === 0) return `${offsetMin / 1440}일 전`
  if (offsetMin % 60 === 0) return `${offsetMin / 60}시간 전`
  return `${offsetMin}분 전`
}

const STANDARD_REMINDERS = [0, 5, 10, 15, 30, 60, 120, 1440]

/** 기본 알림 시점 선택지. value 'none' 은 알림 없음이다. */
export function reminderOptions(current: number | null): SelectOption[] {
  const offsets = current !== null && !STANDARD_REMINDERS.includes(current) ? [...STANDARD_REMINDERS, current].sort((a, b) => a - b) : STANDARD_REMINDERS
  return [{ value: 'none', label: '사용 안 함' }, ...offsets.map((m) => ({ value: String(m), label: reminderLabel(m) }))]
}

/** 날짜 형식 선택지 옆에 보여 줄 예시. 월·일이 헷갈리지 않게 24일로 고정한다. */
export function dateFormatSample(format: Settings['dateFormat']): string {
  if (format === 'MDY') return '03/24/2026'
  if (format === 'DMY') return '24/03/2026'
  return '2026-03-24'
}
