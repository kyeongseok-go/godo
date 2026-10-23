// 백업 파일 검증용 zod 스키마. types.ts 와 어긋나면 이 파일이 컴파일되지 않도록
// 각 스키마에 `satisfies z.ZodType<X>` (스키마 -> 타입) 와 Same<> 단언 (타입 -> 스키마) 을 함께 건다.
import { z } from 'zod'
import { isISODate, isTimeOfDay } from '../date'
import { isSafePayloadShape, TEMPLATE_PAYLOAD_LIMITS } from './payload-guard'
import type {
  ActivityLog,
  Comment,
  Countdown,
  DayPlan,
  FocusSession,
  Habit,
  Label,
  Project,
  RecurrenceRule,
  Reminder,
  SavedFilter,
  Section,
  Settings,
  Task,
  Template,
} from '../types'

// 프로덕션 CSP(script-src 'self')는 eval 을 막는다. zod 는 JIT 가능 여부를 new Function 으로 떠보는데,
// 막힌 환경에서는 예외는 삼켜도 CSP 위반 보고가 남는다. 처음부터 JIT 를 꺼서 위반 없이 같은 경로(해석기)를 쓴다.
z.config({ jitless: true })

/** 두 타입이 서로 대입 가능할 때만 true. 한쪽에 필드가 늘거나 줄면 false 가 되어 컴파일이 깨진다. */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const assertSame = <_T extends true>(): void => undefined

const id = z.string().min(1)
const isoDate = z.string().refine(isISODate, { error: '올바른 날짜(YYYY-MM-DD)가 아니에요' })
const timeOfDay = z.string().refine(isTimeOfDay, { error: '올바른 시각(HH:mm)이 아니에요' })
const epochMs = z.number()
const minutes = z.number().min(0)
const weekday = z.literal([0, 1, 2, 3, 4, 5, 6])
const statusCategory = z.enum(['todo', 'active', 'done', 'canceled'])
const dateNumberRecord = z.record(isoDate, z.number().min(0))

const recurrenceSchema = z.object({
  freq: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  interval: z.number().int().min(1),
  byWeekday: z.array(weekday).optional(),
  byMonthDay: z.union([z.number().int().min(1).max(31), z.literal('last')]).optional(),
  nth: z.object({ n: z.literal([1, 2, 3, 4, -1]), weekday }).optional(),
  anchor: z.enum(['due', 'completion']),
  end: z.discriminatedUnion('type', [
    z.object({ type: z.literal('never') }),
    z.object({ type: z.literal('until'), date: isoDate }),
    z.object({ type: z.literal('count'), count: z.number().int().min(1) }),
  ]),
  doneCount: z.number().int().min(0).optional(),
  skipDates: z.array(isoDate).optional(),
  resetSubtasks: z.boolean(),
}) satisfies z.ZodType<RecurrenceRule>

const reminderSchema = z.discriminatedUnion('kind', [
  z.object({ id, kind: z.literal('relative'), offsetMin: z.number() }),
  z.object({ id, kind: z.literal('absolute'), at: epochMs }),
]) satisfies z.ZodType<Reminder>

export const taskSchema = z.object({
  id,
  title: z.string(),
  description: z.string(),
  projectId: id,
  sectionId: id.nullable(),
  parentId: id.nullable(),
  priority: z.literal([1, 2, 3, 4]),
  labelIds: z.array(id),
  startDate: isoDate.nullable(),
  startTime: timeOfDay.nullable(),
  durationMin: minutes.nullable(),
  dayPart: z.enum(['morning', 'afternoon', 'evening']).nullable(),
  dueDate: isoDate.nullable(),
  estimateMin: minutes.nullable(),
  actualMin: dateNumberRecord,
  recurrence: recurrenceSchema.nullable(),
  reminders: z.array(reminderSchema),
  persistentReminder: z.boolean(),
  status: statusCategory,
  blockedBy: z.array(id),
  onHold: z.boolean(),
  someday: z.boolean(),
  postponeCount: z.number().int().min(0),
  pinned: z.boolean(),
  order: z.number(),
  createdAt: epochMs,
  updatedAt: epochMs,
  completedAt: epochMs.nullable(),
  deletedAt: epochMs.nullable(),
}) satisfies z.ZodType<Task>

export const projectSchema = z.object({
  id,
  name: z.string(),
  color: z.string(),
  icon: z.string().nullable(),
  parentId: id.nullable(),
  isFolder: z.boolean(),
  archived: z.boolean(),
  favorite: z.boolean(),
  defaultView: z.enum(['list', 'board', 'calendar', 'timeline', 'matrix']),
  order: z.number(),
  createdAt: epochMs,
  deletedAt: epochMs.nullable(),
}) satisfies z.ZodType<Project>

export const sectionSchema = z.object({
  id,
  projectId: id,
  name: z.string(),
  order: z.number(),
  category: statusCategory.nullable(),
}) satisfies z.ZodType<Section>

export const labelSchema = z.object({
  id,
  name: z.string(),
  color: z.string(),
  order: z.number(),
}) satisfies z.ZodType<Label>

export const filterSchema = z.object({
  id,
  name: z.string(),
  query: z.string(),
  color: z.string(),
  favorite: z.boolean(),
  order: z.number(),
}) satisfies z.ZodType<SavedFilter>

export const commentSchema = z.object({
  id,
  taskId: id,
  body: z.string(),
  createdAt: epochMs,
}) satisfies z.ZodType<Comment>

export const activitySchema = z.object({
  id,
  taskId: id.nullable(),
  type: z.enum(['created', 'completed', 'reopened', 'updated', 'moved', 'postponed', 'deleted', 'restored', 'commented']),
  summary: z.string(),
  at: epochMs,
}) satisfies z.ZodType<ActivityLog>

/** 템플릿 payload 는 형식을 여기서 검사하지 않지만(읽을 때 features/templates 가 검증), 너무 깊거나 큰 값은 저장 전에 막는다. */
export const templateSchema = z.object({
  id,
  name: z.string(),
  kind: z.enum(['task', 'project']),
  payload: z.unknown().refine((value) => isSafePayloadShape(value, TEMPLATE_PAYLOAD_LIMITS), {
    error: '템플릿 내용이 너무 깊거나 커요',
  }),
  createdAt: epochMs,
}) satisfies z.ZodType<Template>

export const habitSchema = z.object({
  id,
  name: z.string(),
  icon: z.string().nullable(),
  color: z.string(),
  frequency: z.discriminatedUnion('type', [
    z.object({ type: z.literal('daily') }),
    z.object({ type: z.literal('weekdays'), days: z.array(weekday) }),
    z.object({ type: z.literal('timesPerWeek'), times: z.number().int().min(1) }),
  ]),
  goal: z.object({
    kind: z.enum(['check', 'count']),
    target: z.number().min(0),
    unit: z.string().nullable(),
  }),
  startDate: isoDate,
  group: z.string().nullable(),
  reminderTime: timeOfDay.nullable(),
  archived: z.boolean(),
  logs: dateNumberRecord,
  order: z.number(),
}) satisfies z.ZodType<Habit>

export const countdownSchema = z.object({
  id,
  name: z.string(),
  date: isoDate,
  color: z.string(),
  repeatYearly: z.boolean(),
  order: z.number(),
}) satisfies z.ZodType<Countdown>

export const focusSessionSchema = z.object({
  id,
  taskId: id.nullable(),
  kind: z.enum(['pomodoro', 'stopwatch']),
  startedAt: epochMs,
  durationSec: z.number().min(0),
  completed: z.boolean(),
}) satisfies z.ZodType<FocusSession>

export const dayPlanSchema = z.object({
  date: isoDate,
  capacityMin: minutes.nullable(),
  highlightIds: z.array(id),
  morningDoneAt: epochMs.nullable(),
  eveningDoneAt: epochMs.nullable(),
  reflection: z.string(),
}) satisfies z.ZodType<DayPlan>

export const settingsSchema = z.object({
  id: z.literal('settings'),
  timeZone: z.string(),
  weekStartsOn: z.literal([0, 1]),
  timeFormat: z.enum(['12h', '24h']),
  dateFormat: z.enum(['YMD', 'MDY', 'DMY']),
  dayStartHour: z.number().int().min(0).max(23),
  theme: z.enum(['light', 'dark', 'auto']),
  accent: z.string(),
  density: z.enum(['comfortable', 'compact']),
  homeView: z.string(),
  defaultProjectId: id,
  defaultStartDate: z.enum(['none', 'today']),
  defaultReminderOffsetMin: z.number().nullable(),
  defaultDurationMin: minutes,
  smartParsing: z.boolean(),
  hideFutureTasks: z.boolean(),
  showCompleted: z.boolean(),
  workStart: timeOfDay,
  workEnd: timeOfDay,
  bufferMin: minutes,
  dailyCapacityMin: minutes,
  carryOverArchiveDays: z.number().min(0),
  modules: z.object({
    calendar: z.boolean(),
    matrix: z.boolean(),
    habits: z.boolean(),
    focus: z.boolean(),
    countdown: z.boolean(),
    timeline: z.boolean(),
  }),
  sidebar: z.object({
    showToday: z.boolean(),
    showUpcoming: z.boolean(),
    showAnytime: z.boolean(),
    showSomeday: z.boolean(),
    showCompleted: z.boolean(),
    showCounts: z.boolean(),
  }),
  pomodoro: z.object({
    focusMin: minutes,
    shortBreakMin: minutes,
    longBreakMin: minutes,
    longBreakEvery: z.number().int().min(1),
    autoStart: z.boolean(),
    sound: z.boolean(),
  }),
  productivity: z.object({
    karmaEnabled: z.boolean(),
    dailyGoal: z.number().min(0),
    weeklyGoal: z.number().min(0),
    daysOff: z.array(weekday),
    vacationMode: z.boolean(),
  }),
  shortcuts: z.record(z.string(), z.string()),
}) satisfies z.ZodType<Settings>

// 반대 방향 단언: 스키마가 만드는 타입이 types.ts 와 정확히 같아야 한다.
assertSame<Same<z.infer<typeof recurrenceSchema>, RecurrenceRule>>()
assertSame<Same<z.infer<typeof reminderSchema>, Reminder>>()
assertSame<Same<z.infer<typeof taskSchema>, Task>>()
assertSame<Same<z.infer<typeof projectSchema>, Project>>()
assertSame<Same<z.infer<typeof sectionSchema>, Section>>()
assertSame<Same<z.infer<typeof labelSchema>, Label>>()
assertSame<Same<z.infer<typeof filterSchema>, SavedFilter>>()
assertSame<Same<z.infer<typeof commentSchema>, Comment>>()
assertSame<Same<z.infer<typeof activitySchema>, ActivityLog>>()
assertSame<Same<z.infer<typeof templateSchema>, Template>>()
assertSame<Same<z.infer<typeof habitSchema>, Habit>>()
assertSame<Same<z.infer<typeof countdownSchema>, Countdown>>()
assertSame<Same<z.infer<typeof focusSessionSchema>, FocusSession>>()
assertSame<Same<z.infer<typeof dayPlanSchema>, DayPlan>>()
assertSame<Same<z.infer<typeof settingsSchema>, Settings>>()
