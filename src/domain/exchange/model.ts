// 내보내기·가져오기가 함께 쓰는 공용 타입과 상수.
import type {
  ActivityLog,
  Comment,
  Countdown,
  DayPlan,
  FocusSession,
  Habit,
  Label,
  Project,
  SavedFilter,
  Section,
  Settings,
  Task,
  Template,
} from '../types'

/** 백업 파일 형식 버전. 형식이 바뀌면 올리고 migrate.ts 에 변환 단계를 하나 추가한다. */
export const BACKUP_VERSION = 1

/** 앱의 전체 영속 상태 */
export interface AppData {
  tasks: Task[]
  projects: Project[]
  sections: Section[]
  labels: Label[]
  filters: SavedFilter[]
  comments: Comment[]
  activity: ActivityLog[]
  templates: Template[]
  habits: Habit[]
  countdowns: Countdown[]
  focusSessions: FocusSession[]
  dayPlans: DayPlan[]
  settings: Settings | null
}

export interface BackupFile {
  app: 'pace'
  version: number
  exportedAt: string // ISO 8601
  data: AppData
}

/** 가져오기 결과. 오류 메시지와 경고는 사용자에게 그대로 보여 줄 한국어 문장이다. */
export type ImportResult<T> =
  | { ok: true; value: T; warnings: string[] }
  | { ok: false; error: string }

export type MergeMode = 'merge' | 'replace'

export function emptyAppData(): AppData {
  return {
    tasks: [],
    projects: [],
    sections: [],
    labels: [],
    filters: [],
    comments: [],
    activity: [],
    templates: [],
    habits: [],
    countdowns: [],
    focusSessions: [],
    dayPlans: [],
    settings: null,
  }
}

export function failure<T>(error: string): ImportResult<T> {
  return { ok: false, error }
}
