import { INBOX_ID } from '../../domain/types'
import type { ActivityLog, ActivityType, ID, Task } from '../../domain/types'
import { newId } from '../id'

export type NewTaskInput = Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>> & { title: string }

export function buildTask(input: NewTaskInput, nowMs: number, id: ID = newId()): Task {
  return {
    id,
    description: '',
    projectId: INBOX_ID,
    sectionId: null,
    parentId: null,
    priority: 4,
    labelIds: [],
    startDate: null,
    startTime: null,
    durationMin: null,
    dayPart: null,
    dueDate: null,
    estimateMin: null,
    actualMin: {},
    recurrence: null,
    reminders: [],
    persistentReminder: false,
    status: 'todo',
    blockedBy: [],
    onHold: false,
    someday: false,
    postponeCount: 0,
    pinned: false,
    order: 0,
    completedAt: null,
    deletedAt: null,
    ...input,
    title: input.title.trim(),
    createdAt: nowMs,
    updatedAt: nowMs,
  }
}

export function activity(
  taskId: ID | null,
  type: ActivityType,
  summary: string,
  nowMs: number,
): ActivityLog {
  return { id: newId(), taskId, type, summary, at: nowMs }
}
