import Dexie, { type EntityTable } from 'dexie'
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
} from '../domain/types'

/** 자동 백업 스냅샷. data는 직렬화된 백업 JSON 문자열이다. */
export interface SnapshotRecord {
  id: string
  createdAt: number
  data: string
}

/** 다른 탭이 DB 버전을 올려서 이 탭의 연결이 닫혔을 때 window로 알리는 이벤트 */
export const DB_STALE_EVENT = 'godo:db-stale'

export class GodoDB extends Dexie {
  tasks!: EntityTable<Task, 'id'>
  projects!: EntityTable<Project, 'id'>
  sections!: EntityTable<Section, 'id'>
  labels!: EntityTable<Label, 'id'>
  filters!: EntityTable<SavedFilter, 'id'>
  comments!: EntityTable<Comment, 'id'>
  activity!: EntityTable<ActivityLog, 'id'>
  templates!: EntityTable<Template, 'id'>
  habits!: EntityTable<Habit, 'id'>
  countdowns!: EntityTable<Countdown, 'id'>
  focusSessions!: EntityTable<FocusSession, 'id'>
  dayPlans!: EntityTable<DayPlan, 'date'>
  settings!: EntityTable<Settings, 'id'>
  snapshots!: EntityTable<SnapshotRecord, 'id'>

  constructor(name = 'godo') {
    super(name)
    // 다른 탭이 새 버전으로 업그레이드하려고 하면 연결을 닫아 주고, 이 탭에는 새로고침을 안내한다.
    // 그냥 두면 업그레이드가 막히고, 오래된 탭이 계속 낡은 데이터를 쓰게 된다.
    this.on('versionchange', () => {
      this.close()
      if (typeof window !== 'undefined') window.dispatchEvent(new Event(DB_STALE_EVENT))
    })
    // 인덱스는 실제로 조회에 쓰는 것만 둔다. 스키마를 바꿀 때는 version을 올리고 upgrade를 붙인다.
    this.version(1).stores({
      tasks: 'id, projectId, parentId, status, startDate, dueDate, deletedAt, updatedAt',
      projects: 'id, parentId',
      sections: 'id, projectId',
      labels: 'id',
      filters: 'id',
      comments: 'id, taskId',
      activity: 'id, taskId, at',
      templates: 'id',
      habits: 'id',
      countdowns: 'id',
      focusSessions: 'id, taskId, startedAt',
      dayPlans: 'date',
      settings: 'id',
      snapshots: 'id, createdAt',
    })
    // v2: F12 에서 습관 블록(habits.block)과 시간대 템플릿(settings.frames)이 생겼다.
    // 인덱스는 그대로지만, 예전에 저장된 행에 필드를 채워 undefined 가 앱으로 퍼지지 않게 한다.
    this.version(2).upgrade(async (tx) => {
      await tx
        .table('habits')
        .toCollection()
        .modify((habit: Partial<Habit>) => {
          if (habit.block === undefined) habit.block = null
        })
      await tx
        .table('settings')
        .toCollection()
        .modify((settings: Partial<Settings>) => {
          if (settings.frames === undefined) settings.frames = []
        })
    })
  }
}
