// 현재 버전 형식의 data 를 관대하게 검증한다. 항목 하나가 깨져도 그 항목만 건너뛰고 나머지는 살린다.
import type { z } from 'zod'
import { failure, type AppData, type ImportResult } from './model'
import {
  activitySchema,
  commentSchema,
  countdownSchema,
  dayPlanSchema,
  filterSchema,
  focusSessionSchema,
  habitSchema,
  labelSchema,
  projectSchema,
  sectionSchema,
  settingsSchema,
  taskSchema,
  templateSchema,
} from './schemas'

/** 컬렉션 전체가 목록이 아닐 때 던지는 내부용 예외. parseAppData 안에서만 잡는다. */
class CollectionError extends Error {}

function readList<T>(raw: unknown, schema: z.ZodType<T>, label: string, warnings: string[]): T[] {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw)) throw new CollectionError(`${label} 목록이 올바르지 않아요. 목록(배열) 형태여야 해요.`)

  const items: T[] = []
  let skipped = 0
  for (const entry of raw) {
    const parsed = schema.safeParse(entry)
    if (parsed.success) items.push(parsed.data)
    else skipped += 1
  }
  if (skipped > 0) warnings.push(`${label} ${skipped}개를 건너뛰었어요`)
  return items
}

function readSettings(raw: unknown, warnings: string[]): AppData['settings'] {
  if (raw === undefined || raw === null) return null
  const parsed = settingsSchema.safeParse(raw)
  if (parsed.success) return parsed.data
  warnings.push('설정을 읽지 못해 건너뛰었어요')
  return null
}

export function parseAppData(data: Readonly<Record<string, unknown>>): ImportResult<AppData> {
  const warnings: string[] = []
  try {
    const value: AppData = {
      tasks: readList(data.tasks, taskSchema, '작업', warnings),
      projects: readList(data.projects, projectSchema, '프로젝트', warnings),
      sections: readList(data.sections, sectionSchema, '섹션', warnings),
      labels: readList(data.labels, labelSchema, '라벨', warnings),
      filters: readList(data.filters, filterSchema, '필터', warnings),
      comments: readList(data.comments, commentSchema, '댓글', warnings),
      activity: readList(data.activity, activitySchema, '활동 기록', warnings),
      templates: readList(data.templates, templateSchema, '템플릿', warnings),
      habits: readList(data.habits, habitSchema, '습관', warnings),
      countdowns: readList(data.countdowns, countdownSchema, '카운트다운', warnings),
      focusSessions: readList(data.focusSessions, focusSessionSchema, '집중 기록', warnings),
      dayPlans: readList(data.dayPlans, dayPlanSchema, '하루 계획', warnings),
      settings: readSettings(data.settings, warnings),
    }
    return { ok: true, value, warnings }
  } catch (error: unknown) {
    if (error instanceof CollectionError) return failure(error.message)
    throw error
  }
}
