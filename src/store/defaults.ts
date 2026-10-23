import { INBOX_ID } from '../domain/types'
import type { Project, Settings } from '../domain/types'

/** 기본 강조색. 테마(라이트/다크)가 각자 맞는 청록을 정하므로, 이 값일 때는 직접 덮어쓰지 않는다. */
export const DEFAULT_ACCENT = '#0a6a60'
/** 예전 기본값(주홍 계열). 저장된 값이 이것이면 새 기본값을 따른다. */
const LEGACY_DEFAULT_ACCENTS: readonly string[] = ['#d9421c', '#c8360f']

export const isDefaultAccent = (accent: string | undefined): boolean =>
  !accent || accent === DEFAULT_ACCENT || LEGACY_DEFAULT_ACCENTS.includes(accent)

export function defaultSettings(): Settings {
  return {
    id: 'settings',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul',
    weekStartsOn: 1,
    timeFormat: '24h',
    dateFormat: 'YMD',
    dayStartHour: 0,
    theme: 'auto',
    accent: DEFAULT_ACCENT,
    density: 'comfortable',
    homeView: 'today',
    defaultProjectId: INBOX_ID,
    defaultStartDate: 'none',
    defaultReminderOffsetMin: null,
    defaultDurationMin: 30,
    smartParsing: true,
    hideFutureTasks: false,
    showCompleted: false,
    workStart: '09:00',
    workEnd: '18:00',
    bufferMin: 10,
    dailyCapacityMin: 360,
    carryOverArchiveDays: 14,
    frames: [],
    modules: { calendar: true, matrix: true, habits: true, focus: true, countdown: true, timeline: true },
    sidebar: {
      showToday: true,
      showUpcoming: true,
      showAnytime: true,
      showSomeday: true,
      showCompleted: true,
      showCounts: true,
    },
    pomodoro: { focusMin: 25, shortBreakMin: 5, longBreakMin: 15, longBreakEvery: 4, autoStart: false, sound: true },
    productivity: { karmaEnabled: true, dailyGoal: 5, weeklyGoal: 25, daysOff: [0, 6], vacationMode: false },
    shortcuts: {},
  }
}

export function inboxProject(nowMs: number): Project {
  return {
    id: INBOX_ID,
    name: '받은편지함',
    color: '#6b6258',
    icon: 'inbox',
    parentId: null,
    isFolder: false,
    archived: false,
    favorite: false,
    defaultView: 'list',
    order: -1,
    createdAt: nowMs,
    deletedAt: null,
  }
}

/** 프로젝트·라벨에 순환해서 쓰는 팔레트. 신호색(청록)을 앞에 둔다. */
export const PALETTE = [
  '#0a6a60',
  '#2f6fd0',
  '#6b4ad6',
  '#b45309',
  '#be1850',
  '#15803d',
  '#2b4c7e',
  '#7a3e8e',
  '#455a64',
  '#6b6258',
] as const

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * 저장된 설정 위에 기본값을 깔아 새로 생긴 필드를 채운다(중첩 객체까지). 배열과 값은 저장된 것을 그대로 쓴다.
 * 앱을 업데이트해 설정 필드가 늘어도 undefined가 퍼지지 않게 하려는 것이다.
 */
export function mergeSettings(stored: Partial<Settings> | null | undefined, defaults: Settings = defaultSettings()): Settings {
  const merge = (base: Record<string, unknown>, over: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = { ...base }
    for (const [key, value] of Object.entries(over)) {
      if (value === undefined) continue
      const current = base[key]
      out[key] = isPlainObject(current) && isPlainObject(value) ? merge(current, value) : value
    }
    return out
  }
  return merge(defaults as unknown as Record<string, unknown>, (stored ?? {}) as Record<string, unknown>) as unknown as Settings
}
