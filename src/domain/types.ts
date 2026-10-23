// 앱 전체가 공유하는 데이터 모델. 순수 타입만 둔다(React·DB 의존 금지).
// 날짜는 로컬 달력 기준 'YYYY-MM-DD', 시각은 'HH:mm' 문자열로 다룬다. 타임존 변환 버그를 피하려는 선택이다.

export type ID = string
export type ISODate = string // 'YYYY-MM-DD' (로컬 날짜)
export type TimeOfDay = string // 'HH:mm' (24시간)
export type EpochMs = number

export type Priority = 1 | 2 | 3 | 4 // 1이 가장 높음(P1), 4가 기본값
export type DayPart = 'morning' | 'afternoon' | 'evening'
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0=일요일

/** 상태 이름은 자유롭게 쓰되 범주는 고정한다(칸반·통계·반복이 이 범주만 본다). */
export type StatusCategory = 'todo' | 'active' | 'done' | 'canceled'

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly' | 'yearly'

export type RecurrenceEnd =
  | { type: 'never' }
  | { type: 'until'; date: ISODate }
  | { type: 'count'; count: number }

export interface RecurrenceRule {
  freq: RecurrenceFreq
  interval: number // 매 N일/주/월/년, 1 이상
  /** weekly: 요일 목록. 비면 시작일의 요일을 쓴다. 평일마다 = [1,2,3,4,5] */
  byWeekday?: Weekday[]
  /** monthly: 일(1~31) 또는 'last'(말일). 비면 시작일의 일을 쓴다. */
  byMonthDay?: number | 'last'
  /** monthly: 'n번째 요일'. n은 1~4 또는 -1(마지막). 예: 매월 첫째 월요일 */
  nth?: { n: 1 | 2 | 3 | 4 | -1; weekday: Weekday }
  /** 'due': 예정일 기준으로 다음 회차 계산, 'completion': 완료한 날 기준 */
  anchor: 'due' | 'completion'
  end: RecurrenceEnd
  /** 이미 끝낸 회차 수(count 종료 판정용) */
  doneCount?: number
  /** 건너뛴 날짜(이번 회차만 예외) */
  skipDates?: ISODate[]
  /** 완료해 다음 회차로 넘어갈 때 하위 작업을 미완료로 되돌린다 */
  resetSubtasks: boolean
}

export type Reminder =
  | { id: ID; kind: 'relative'; offsetMin: number } // 시작 시각 N분 전. 0은 정각
  | { id: ID; kind: 'absolute'; at: EpochMs }

export interface Task {
  id: ID
  title: string
  description: string // 마크다운
  projectId: ID // 받은편지함도 프로젝트 하나다(INBOX_ID)
  sectionId: ID | null
  parentId: ID | null
  priority: Priority
  labelIds: ID[]

  /** 할 날 = 시작일. 이 날부터 오늘 목록에 나타난다. */
  startDate: ISODate | null
  startTime: TimeOfDay | null
  /** 시간 블록 길이(분). 캘린더에서 블록으로 그린다. */
  durationMin: number | null
  /** 하루 안 구간. 시간을 못 박지 않고 순서만 잡을 때 쓴다. */
  dayPart: DayPart | null
  /** 마감일. 시작일과 별개다. 날짜만 가진다. */
  dueDate: ISODate | null

  estimateMin: number | null // 예상 시간
  actualMin: Record<ISODate, number> // 날짜별 실제 소요 시간

  recurrence: RecurrenceRule | null
  reminders: Reminder[]
  persistentReminder: boolean // 확인할 때까지 반복해서 알린다

  status: StatusCategory
  blockedBy: ID[] // 이 작업들이 끝나야 시작할 수 있다
  onHold: boolean // 보류
  someday: boolean // "언젠가" 보관함
  postponeCount: number // 미룬 횟수
  pinned: boolean
  order: number // 같은 부모·섹션 안의 정렬 값(실수)

  createdAt: EpochMs
  updatedAt: EpochMs
  completedAt: EpochMs | null
  deletedAt: EpochMs | null // 휴지통
}

export type ProjectView = 'list' | 'board' | 'calendar' | 'timeline' | 'matrix'

export interface Project {
  id: ID
  name: string
  color: string // 디자인 토큰 이름이 아닌 hex
  icon: string | null
  parentId: ID | null // 폴더 중첩
  isFolder: boolean
  archived: boolean
  favorite: boolean
  defaultView: ProjectView
  order: number
  createdAt: EpochMs
  deletedAt: EpochMs | null
}

export interface Section {
  id: ID
  projectId: ID
  name: string
  order: number
  /** 이 섹션으로 옮기면 작업 상태가 이 범주로 바뀐다(칸반 열 = 상태) */
  category: StatusCategory | null
}

export interface Label {
  id: ID
  name: string
  color: string
  order: number
}

export interface SavedFilter {
  id: ID
  name: string
  query: string // 필터 쿼리 문법
  color: string
  favorite: boolean
  order: number
}

export interface Comment {
  id: ID
  taskId: ID
  body: string
  createdAt: EpochMs
}

export type ActivityType =
  | 'created'
  | 'completed'
  | 'reopened'
  | 'updated'
  | 'moved'
  | 'postponed'
  | 'deleted'
  | 'restored'
  | 'commented'

export interface ActivityLog {
  id: ID
  taskId: ID | null
  type: ActivityType
  summary: string
  at: EpochMs
}

export interface Template {
  id: ID
  name: string
  kind: 'task' | 'project'
  /** 작업 템플릿은 Task 트리, 프로젝트 템플릿은 Project + Section + Task 트리를 직렬화한 값 */
  payload: unknown
  createdAt: EpochMs
}

export type HabitFrequency =
  | { type: 'daily' }
  | { type: 'weekdays'; days: Weekday[] }
  | { type: 'timesPerWeek'; times: number }

/**
 * F12: 유연한 습관 블록. 정해진 시각에 고정하지 않고, 이 시간대 안의 빈 자리를 날마다 다시 찾는다.
 * 알림 시각(reminderTime)과 달리 하루 일정에 맞춰 움직인다.
 */
export interface HabitBlock {
  durationMin: number
  start: TimeOfDay
  end: TimeOfDay
}

export interface Habit {
  id: ID
  name: string
  icon: string | null
  color: string
  frequency: HabitFrequency
  /** 하루 목표. check이면 target은 1, count면 횟수/분량 */
  goal: { kind: 'check' | 'count'; target: number; unit: string | null }
  startDate: ISODate
  group: string | null
  reminderTime: TimeOfDay | null
  /** 시간을 비워 둘 블록. null 이면 시간을 잡지 않는다 */
  block: HabitBlock | null
  archived: boolean
  /** 날짜별 기록 값. check이면 0 또는 1 */
  logs: Record<ISODate, number>
  order: number
}

export interface Countdown {
  id: ID
  name: string
  date: ISODate
  color: string
  repeatYearly: boolean
  order: number
}

export interface FocusSession {
  id: ID
  taskId: ID | null
  kind: 'pomodoro' | 'stopwatch'
  startedAt: EpochMs
  durationSec: number
  completed: boolean
}

/** 하루 계획 기록: 용량, 오늘의 핵심, 아침·저녁 의식 완료 여부 */
export interface DayPlan {
  date: ISODate // 키
  capacityMin: number | null // null이면 설정 기본값
  highlightIds: ID[] // 오늘의 핵심 2~3개
  morningDoneAt: EpochMs | null
  eveningDoneAt: EpochMs | null
  reflection: string
}

export type ThemeMode = 'light' | 'dark' | 'auto'
export type Density = 'comfortable' | 'compact'

/**
 * F12: 작업 유형별 시간대 템플릿("딥워크는 오전, 잡무는 오후").
 * 자동 배치는 조건에 맞는 일을 이 시간대 안에만 넣는다. 조건이 모두 비어 있으면 모든 일에 맞는 시간대다.
 */
export interface TimeFrame {
  id: ID
  name: string
  /** 이 시간대를 쓰는 요일. 비어 있으면 어느 날에도 쓰지 않는다 */
  days: Weekday[]
  start: TimeOfDay
  end: TimeOfDay
  match: {
    labelIds: ID[]
    priorities: Priority[]
    /** 예상 시간이 이 값 이상인 일만. null 이면 길이를 따지지 않는다 */
    minMinutes: number | null
  }
  order: number
}

export interface Settings {
  id: 'settings'
  timeZone: string
  weekStartsOn: 0 | 1
  timeFormat: '12h' | '24h'
  dateFormat: 'YMD' | 'MDY' | 'DMY'
  /** 하루가 시작되는 시각. 새벽 2시에 "오늘"이 어제로 보이게 하는 용도 */
  dayStartHour: number
  theme: ThemeMode
  accent: string
  density: Density
  homeView: string
  defaultProjectId: ID
  defaultStartDate: 'none' | 'today'
  defaultReminderOffsetMin: number | null
  defaultDurationMin: number
  smartParsing: boolean
  hideFutureTasks: boolean // 시작일 전 작업을 프로젝트 목록에서 숨김
  showCompleted: boolean
  workStart: TimeOfDay
  workEnd: TimeOfDay
  bufferMin: number // 자동 배치 때 블록 사이 여유
  dailyCapacityMin: number // 하루 용량 기본값
  carryOverArchiveDays: number // 연속 N일 이월되면 보관 제안
  /** F12 시간대 템플릿. 비어 있으면 근무 시간 전체를 쓴다 */
  frames: TimeFrame[]
  modules: {
    calendar: boolean
    matrix: boolean
    habits: boolean
    focus: boolean
    countdown: boolean
    timeline: boolean
  }
  sidebar: {
    showToday: boolean
    showUpcoming: boolean
    showAnytime: boolean
    showSomeday: boolean
    showCompleted: boolean
    showCounts: boolean
  }
  pomodoro: {
    focusMin: number
    shortBreakMin: number
    longBreakMin: number
    longBreakEvery: number
    autoStart: boolean
    sound: boolean
  }
  productivity: {
    karmaEnabled: boolean
    dailyGoal: number
    weeklyGoal: number
    daysOff: Weekday[]
    vacationMode: boolean
  }
  shortcuts: Record<string, string> // 사용자 지정 단축키(명령 id → 키 시퀀스)
}

export const INBOX_ID: ID = 'inbox'

/** 필터·자연어 파서·계획 로직이 참조하는 읽기 전용 컨텍스트 */
export interface EngineContext {
  today: ISODate
  now: Date
  weekStartsOn: 0 | 1
  projects: readonly Project[]
  sections: readonly Section[]
  labels: readonly Label[]
  tasks: readonly Task[]
}
