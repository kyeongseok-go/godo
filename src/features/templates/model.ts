// 템플릿 payload 형식. Template.payload 는 unknown 이므로 읽을 때마다 zod 로 검증한다.
// 날짜는 기준일에서 며칠 떨어졌는지(오프셋)로 저장해, 불러올 때 새 기준일에 맞춰 다시 펼친다.
import { z } from 'zod'
import { isSafePayloadShape, TEMPLATE_PAYLOAD_LIMITS } from '../../domain/exchange'
import type { DayPart, ID, Priority, ProjectView, RecurrenceFreq, StatusCategory, Template, TimeOfDay, Weekday } from '../../domain/types'

// CSP 때문에 eval 을 쓸 수 없다. zod 의 JIT 탐지(new Function)가 위반 보고를 남기지 않게 미리 끈다.
z.config({ jitless: true })

export const TEMPLATE_VERSION = 1
const PARSE_ERROR = '템플릿 내용을 읽지 못했어요.'

export type TemplateRecurrenceEnd =
  | { type: 'never' }
  | { type: 'count'; count: number }
  | { type: 'untilOffset'; days: number }

/** 진행 기록(doneCount, skipDates)은 버리고, 종료일은 기준일로부터의 오프셋으로 바꾼 반복 규칙 */
export interface TemplateRecurrence {
  freq: RecurrenceFreq
  interval: number
  byWeekday?: Weekday[]
  byMonthDay?: number | 'last'
  nth?: { n: 1 | 2 | 3 | 4 | -1; weekday: Weekday }
  anchor: 'due' | 'completion'
  end: TemplateRecurrenceEnd
  resetSubtasks: boolean
}

export interface TemplateTaskNode {
  title: string
  description: string
  priority: Priority
  labelIds: ID[]
  startOffset: number | null
  startTime: TimeOfDay | null
  durationMin: number | null
  dayPart: DayPart | null
  dueOffset: number | null
  estimateMin: number | null
  recurrence: TemplateRecurrence | null
  /** 시작 시각 N분 전 알림만 저장한다. 절대 시각 알림은 템플릿에서 의미가 없어 뺀다. */
  reminderOffsets: number[]
  persistentReminder: boolean
  someday: boolean
  children: TemplateTaskNode[]
}

export interface TaskTemplatePayload {
  version: typeof TEMPLATE_VERSION
  root: TemplateTaskNode
}

export interface ProjectTemplatePayload {
  version: typeof TEMPLATE_VERSION
  project: { color: string; icon: string | null; defaultView: ProjectView }
  sections: Array<{ name: string; category: StatusCategory | null }>
  /** section 은 sections 배열의 위치. 섹션 없이 놓인 작업은 null */
  tasks: Array<{ section: number | null; node: TemplateTaskNode }>
}

const weekday = z.literal([0, 1, 2, 3, 4, 5, 6])

const recurrenceSchema = z.object({
  freq: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  interval: z.number().int().min(1),
  byWeekday: z.array(weekday).optional(),
  byMonthDay: z.union([z.number().int().min(1).max(31), z.literal('last')]).optional(),
  nth: z.object({ n: z.literal([1, 2, 3, 4, -1]), weekday }).optional(),
  anchor: z.enum(['due', 'completion']),
  end: z.discriminatedUnion('type', [
    z.object({ type: z.literal('never') }),
    z.object({ type: z.literal('count'), count: z.number().int().min(1) }),
    z.object({ type: z.literal('untilOffset'), days: z.number().int() }),
  ]),
  resetSubtasks: z.boolean(),
}) satisfies z.ZodType<TemplateRecurrence>

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

const taskNodeSchema: z.ZodType<TemplateTaskNode> = z.lazy(() =>
  z.object({
    title: z.string(),
    description: z.string(),
    priority: z.literal([1, 2, 3, 4]),
    labelIds: z.array(z.string()),
    startOffset: z.number().int().nullable(),
    startTime: timeOfDay.nullable(),
    durationMin: z.number().min(0).nullable(),
    dayPart: z.enum(['morning', 'afternoon', 'evening']).nullable(),
    dueOffset: z.number().int().nullable(),
    estimateMin: z.number().min(0).nullable(),
    recurrence: recurrenceSchema.nullable(),
    reminderOffsets: z.array(z.number()),
    persistentReminder: z.boolean(),
    someday: z.boolean(),
    children: z.array(taskNodeSchema),
  }),
)

const taskPayloadSchema = z.object({
  version: z.literal(TEMPLATE_VERSION),
  root: taskNodeSchema,
}) satisfies z.ZodType<TaskTemplatePayload>

const projectPayloadSchema = z
  .object({
    version: z.literal(TEMPLATE_VERSION),
    project: z.object({
      color: z.string(),
      icon: z.string().nullable(),
      defaultView: z.enum(['list', 'board', 'calendar', 'timeline', 'matrix']),
    }),
    sections: z.array(
      z.object({ name: z.string(), category: z.enum(['todo', 'active', 'done', 'canceled']).nullable() }),
    ),
    tasks: z.array(z.object({ section: z.number().int().min(0).nullable(), node: taskNodeSchema })),
  })
  .refine((p) => p.tasks.every((t) => t.section === null || t.section < p.sections.length), {
    error: '존재하지 않는 섹션을 가리키는 작업이 있어요',
  }) satisfies z.ZodType<ProjectTemplatePayload>

export type ParsedTemplate =
  | { ok: true; kind: 'task'; payload: TaskTemplatePayload }
  | { ok: true; kind: 'project'; payload: ProjectTemplatePayload }
  | { ok: false; error: string }

/** 템플릿 종류에 맞는 payload 인지 검사하고 타입이 붙은 값을 돌려준다. */
export function parseTemplatePayload(template: Pick<Template, 'kind' | 'payload'>): ParsedTemplate {
  // 가져온 백업에 아주 깊게 중첩된 payload 가 있으면 zod 재귀가 스택 오버플로로 예외를 던져 렌더링 중 앱이 멈춘다.
  if (!isSafePayloadShape(template.payload, TEMPLATE_PAYLOAD_LIMITS)) return { ok: false, error: PARSE_ERROR }
  if (template.kind === 'task') {
    const parsed = taskPayloadSchema.safeParse(template.payload)
    return parsed.success ? { ok: true, kind: 'task', payload: parsed.data } : { ok: false, error: PARSE_ERROR }
  }
  const parsed = projectPayloadSchema.safeParse(template.payload)
  return parsed.success ? { ok: true, kind: 'project', payload: parsed.data } : { ok: false, error: PARSE_ERROR }
}

function countNode(node: TemplateTaskNode): number {
  return node.children.reduce((sum, child) => sum + countNode(child), 1)
}

/** 템플릿이 만들어 낼 할 일의 개수(하위 작업 포함) */
export function countTemplateTasks(parsed: Extract<ParsedTemplate, { ok: true }>): number {
  if (parsed.kind === 'task') return countNode(parsed.payload.root)
  return parsed.payload.tasks.reduce((sum, t) => sum + countNode(t.node), 0)
}
