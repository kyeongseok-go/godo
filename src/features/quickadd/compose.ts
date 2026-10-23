// 파서 결과 + 사용자가 직접 고른 값 + 화면 기본값 + 설정을 합쳐 새 작업 입력을 만든다.
// 우선순위: 직접 고른 값 > 입력 문장에서 인식한 값 > 화면 기본값 > 설정 기본값.
import type { ParsedQuickAdd } from '../../domain/nlp/types'
import { INBOX_ID } from '../../domain/types'
import type { ID, ISODate, Priority, Reminder, Settings, TimeOfDay } from '../../domain/types'
import { newId } from '../../store/id'
import type { NewTaskInput } from '../../store/commands/taskFactory'
import type { QuickAddDefaults } from '../../store/ui'
import type { SchedulePatch } from '../pickers/DatePopover'

export interface ManualOverrides {
  schedule?: Partial<SchedulePatch>
  priority?: Priority
  projectId?: ID
  sectionId?: ID | null
  labelIds?: ID[]
}

export interface ComposeArgs {
  parsed: ParsedQuickAdd
  manual: ManualOverrides
  defaults: QuickAddDefaults
  settings: Settings
  today: ISODate
}

const pick = <T,>(manual: T | undefined, parsed: T, fallback: T): T =>
  manual !== undefined ? manual : parsed !== null && parsed !== undefined ? parsed : fallback

export function composeTask({ parsed, manual, defaults, settings, today }: ComposeArgs): {
  input: NewTaskInput
  newLabelNames: string[]
} {
  const schedule = manual.schedule ?? {}
  const projectId = manual.projectId ?? parsed.projectId ?? defaults.projectId ?? settings.defaultProjectId ?? INBOX_ID
  const sameProject = projectId === (defaults.projectId ?? settings.defaultProjectId)
  const sectionId =
    manual.sectionId !== undefined ? manual.sectionId : (parsed.sectionId ?? (sameProject ? (defaults.sectionId ?? null) : null))

  const defaultStart = (defaults.startDate as ISODate | null | undefined) ?? (settings.defaultStartDate === 'today' ? today : null)
  const someday = schedule.someday === true
  const startDate = someday ? null : pick(schedule.startDate, parsed.startDate, defaultStart)
  const startTime = pick(schedule.startTime, parsed.startTime, (defaults.startTime as TimeOfDay | null | undefined) ?? null)
  const hasDate = startDate !== null

  const offsets = parsed.reminderOffsetsMin.length
    ? parsed.reminderOffsetsMin
    : startTime && settings.defaultReminderOffsetMin !== null
      ? [settings.defaultReminderOffsetMin]
      : []
  const reminders: Reminder[] = hasDate ? offsets.map((offsetMin) => ({ id: newId(), kind: 'relative', offsetMin })) : []

  const input: NewTaskInput = {
    title: parsed.title,
    projectId,
    sectionId,
    parentId: defaults.parentId ?? null,
    priority: manual.priority ?? parsed.priority ?? 4,
    labelIds: manual.labelIds ?? parsed.labelIds,
    startDate,
    startTime,
    durationMin: pick(schedule.durationMin, parsed.durationMin, null),
    dayPart: startTime ? null : pick(schedule.dayPart, parsed.dayPart, null),
    dueDate: parsed.dueDate,
    estimateMin: parsed.estimateMin,
    recurrence: pick(schedule.recurrence, parsed.recurrence, null),
    reminders,
    someday,
  }
  return { input, newLabelNames: manual.labelIds ? [] : parsed.newLabelNames }
}
