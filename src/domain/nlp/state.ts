// 인식기들이 주고받는 상태. 인식기는 상태를 바꾸지 않고 Hit만 돌려주며, 합치는 일은 applyHits가 한다.
import type { DayPart, ID, ISODate, Priority, RecurrenceRule, TimeOfDay } from '../types'
import { overlaps, type Span } from './scan'
import type { ParseContext, ParsedToken } from './types'

export interface Fields {
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
  /** 반복 구절 안에 날짜가 있을 때(매년 3월 2일)의 첫 회차 */
  recurrenceStart: ISODate | null
}

export interface State {
  /** 이미 쓰인 구간. 토큰이 되지 않는 보호 구간(URL 등)도 들어 있다. */
  claimed: readonly Span[]
  tokens: readonly ParsedToken[]
  fields: Fields
}

export type Patch = Partial<Fields>

export interface Hit {
  token: ParsedToken
  patch: Patch
}

export type Recognizer = (text: string, state: State, ctx: ParseContext) => Hit[]

export function emptyFields(): Fields {
  return {
    startDate: null,
    startTime: null,
    dayPart: null,
    dueDate: null,
    durationMin: null,
    estimateMin: null,
    priority: null,
    projectId: null,
    sectionId: null,
    labelIds: [],
    newLabelNames: [],
    recurrence: null,
    reminderOffsetsMin: [],
    recurrenceStart: null,
  }
}

function union<T>(current: readonly T[], extra: readonly T[] | undefined): T[] {
  if (!extra) return [...current]
  return [...current, ...extra.filter((x, i) => !current.includes(x) && extra.indexOf(x) === i)]
}

/** 스칼라 필드는 먼저 나온 값을 유지하고, 배열 필드는 중복 없이 이어 붙인다. */
export function mergeFields(f: Fields, p: Patch): Fields {
  return {
    startDate: f.startDate ?? p.startDate ?? null,
    startTime: f.startTime ?? p.startTime ?? null,
    dayPart: f.dayPart ?? p.dayPart ?? null,
    dueDate: f.dueDate ?? p.dueDate ?? null,
    durationMin: f.durationMin ?? p.durationMin ?? null,
    estimateMin: f.estimateMin ?? p.estimateMin ?? null,
    priority: f.priority ?? p.priority ?? null,
    projectId: f.projectId ?? p.projectId ?? null,
    sectionId: f.sectionId ?? p.sectionId ?? null,
    labelIds: union(f.labelIds, p.labelIds),
    newLabelNames: union(f.newLabelNames, p.newLabelNames),
    recurrence: f.recurrence ?? p.recurrence ?? null,
    reminderOffsetsMin: union(f.reminderOffsetsMin, p.reminderOffsetsMin),
    recurrenceStart: f.recurrenceStart ?? p.recurrenceStart ?? null,
  }
}

export function applyHits(state: State, hits: readonly Hit[]): State {
  return hits.reduce<State>((acc, hit) => {
    const { start, end } = hit.token
    if (overlaps(acc.claimed, start, end)) return acc
    return {
      claimed: [...acc.claimed, { start, end }],
      tokens: [...acc.tokens, hit.token],
      fields: mergeFields(acc.fields, hit.patch),
    }
  }, state)
}

export function token(kind: ParsedToken['kind'], text: string, start: number, end: number, label: string): ParsedToken {
  return { kind, start, end, text: text.slice(start, end), label }
}
