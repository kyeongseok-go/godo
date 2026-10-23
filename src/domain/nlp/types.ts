// 빠른 입력 파서의 공개 타입. 도메인 모델은 ../types 에서 가져온다.
import type { DayPart, ID, ISODate, Priority, RecurrenceRule, TimeOfDay } from '../types'

export interface ParseContext {
  today: ISODate
  now: Date
  weekStartsOn: 0 | 1
  projects: ReadonlyArray<{ id: ID; name: string }>
  labels: ReadonlyArray<{ id: ID; name: string }>
  sections: ReadonlyArray<{ id: ID; projectId: ID; name: string }>
  /** false면 날짜·시간·반복 자연어 인식을 끄고 기호(#,/,@,p1,~,!,{ })만 처리한다. */
  parseDates: boolean
}

export type TokenKind =
  | 'date'
  | 'time'
  | 'dayPart'
  | 'recurrence'
  | 'duration'
  | 'estimate'
  | 'priority'
  | 'project'
  | 'section'
  | 'label'
  | 'reminder'
  | 'deadline'

/** start/end는 원문 문자 위치([start, end)), label은 칩에 보일 한국어 요약. */
export interface ParsedToken {
  kind: TokenKind
  start: number
  end: number
  text: string
  label: string
}

export interface ParsedQuickAdd {
  title: string
  startDate: ISODate | null
  startTime: TimeOfDay | null
  dayPart: DayPart | null
  dueDate: ISODate | null
  durationMin: number | null
  estimateMin: number | null
  priority: Priority | null
  projectId: ID | null
  sectionId: ID | null
  labelIds: ID[]
  newLabelNames: string[]
  recurrence: RecurrenceRule | null
  reminderOffsetsMin: number[]
  tokens: ParsedToken[]
}
