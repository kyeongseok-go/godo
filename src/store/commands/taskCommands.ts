// 할 일 조작 명령. 전부 순수 함수이며, 상태와 인자를 받아 ChangeSet을 돌려준다.
// 저장·실행 취소는 store.commit이 맡는다.
import { advanceRecurringTask, skipOccurrence } from '../../domain/recurrence'
import { INBOX_ID } from '../../domain/types'
import type { ID, ISODate, StatusCategory, Task } from '../../domain/types'
import { EMPTY_CHANGES, mergeChangeSets } from '../changes'
import type { ChangeSet, EntityState } from '../changes'
import { newId } from '../id'
import { activity, buildTask } from './taskFactory'
import type { NewTaskInput } from './taskFactory'
import { childrenIndex, descendantsFrom, descendantsOf, nextOrder, wouldCreateCycle } from './taskTree'

const putTasks = (tasks: readonly Task[], extra: ChangeSet = EMPTY_CHANGES): ChangeSet =>
  mergeChangeSets({ puts: { tasks }, deletes: {} }, extra)

const statusPatch = (status: StatusCategory, nowMs: number): Partial<Task> => ({
  status,
  completedAt: status === 'done' ? nowMs : null,
})

export function createTask(
  state: EntityState,
  input: NewTaskInput,
  nowMs: number,
): { changes: ChangeSet; task: Task } {
  const projectId = input.projectId ?? INBOX_ID
  const parentId = input.parentId ?? null
  const order = input.order ?? nextOrder(state, projectId, parentId)
  const task = buildTask({ ...input, projectId, parentId, order }, nowMs)
  const log = activity(task.id, 'created', `"${task.title}" 추가`, nowMs)
  return { task, changes: putTasks([task], { puts: { activity: [log] }, deletes: {} }) }
}

/** 처음 부를 때 한 번만 자식 색인을 만들어 두는 게으른 접근자. 색인이 필요 없는 경로에서는 비용이 0이다. */
function lazyChildrenIndex(state: EntityState): () => ReadonlyMap<ID, readonly Task[]> {
  let cached: Map<ID, Task[]> | undefined
  return () => (cached ??= childrenIndex(state.tasks))
}

type ChildIndexGetter = () => ReadonlyMap<ID, readonly Task[]>

function patchWith(state: EntityState, id: ID, patch: Partial<Task>, nowMs: number, getIndex: ChildIndexGetter): ChangeSet {
  const task = state.tasks[id]
  if (!task) return EMPTY_CHANGES
  if (patch.parentId !== undefined && patch.parentId !== null && wouldCreateCycle(state, id, patch.parentId, getIndex())) {
    return EMPTY_CHANGES
  }

  const updated: Task = { ...task, ...patch, id, updatedAt: nowMs }
  const projectChanged = patch.projectId !== undefined && patch.projectId !== task.projectId
  if (!projectChanged) return putTasks([updated])

  // 프로젝트가 바뀌면 이전 프로젝트의 섹션은 의미가 없고, 하위 작업도 같이 옮긴다.
  const moved: Task = patch.sectionId === undefined ? { ...updated, sectionId: null } : updated
  const kids = descendantsFrom(getIndex(), id).map((t) => ({
    ...t,
    projectId: moved.projectId,
    sectionId: null,
    updatedAt: nowMs,
  }))
  return putTasks([moved, ...kids])
}

export function patchTask(state: EntityState, id: ID, patch: Partial<Task>, nowMs: number): ChangeSet {
  return patchWith(state, id, patch, nowMs, lazyChildrenIndex(state))
}

/** 여러 작업에 같은 변경을 적용한다. 하위 작업을 따라가야 할 때도 자식 색인은 한 번만 만든다. */
export function patchTasks(state: EntityState, ids: readonly ID[], patch: Partial<Task>, nowMs: number): ChangeSet {
  const getIndex = lazyChildrenIndex(state)
  return mergeChangeSets(...ids.map((id) => patchWith(state, id, patch, nowMs, getIndex)))
}

/** 완료. 반복 작업은 다음 회차로 넘기고, 이번 회차는 완료 기록(복제본)으로 남겨 통계에 잡히게 한다. */
export function completeTask(state: EntityState, id: ID, completedOn: ISODate, nowMs: number): ChangeSet {
  const task = state.tasks[id]
  if (!task || task.status === 'done') return EMPTY_CHANGES
  const log = activity(id, 'completed', `"${task.title}" 완료`, nowMs)
  const logSet: ChangeSet = { puts: { activity: [log] }, deletes: {} }

  const next = task.recurrence ? advanceRecurringTask(task, completedOn, nowMs) : null
  if (task.recurrence && next) {
    const record: Task = {
      ...task,
      id: newId(),
      recurrence: null,
      parentId: null,
      blockedBy: [],
      reminders: [],
      ...statusPatch('done', nowMs),
      updatedAt: nowMs,
    }
    const reset = task.recurrence.resetSubtasks
      ? descendantsOf(state, id).map((t) => ({ ...t, ...statusPatch('todo', nowMs), updatedAt: nowMs }))
      : []
    return putTasks([next, record, ...reset], logSet)
  }

  const open = descendantsOf(state, id).filter((t) => t.status === 'todo' || t.status === 'active')
  const done = [task, ...open].map((t) => ({ ...t, ...statusPatch('done', nowMs), updatedAt: nowMs }))
  return putTasks(done, logSet)
}

export function reopenTask(state: EntityState, id: ID, nowMs: number): ChangeSet {
  const task = state.tasks[id]
  if (!task || (task.status !== 'done' && task.status !== 'canceled')) return EMPTY_CHANGES
  const log = activity(id, 'reopened', `"${task.title}" 다시 열기`, nowMs)
  return putTasks([{ ...task, ...statusPatch('todo', nowMs), updatedAt: nowMs }], {
    puts: { activity: [log] },
    deletes: {},
  })
}

/** "계획 취소": 지우지 않고 기록은 남기되 목록에서 치운다. */
export function cancelTask(state: EntityState, id: ID, nowMs: number): ChangeSet {
  const task = state.tasks[id]
  if (!task || task.status === 'canceled') return EMPTY_CHANGES
  const open = descendantsOf(state, id).filter((t) => t.status === 'todo' || t.status === 'active')
  const changed = [task, ...open].map((t) => ({ ...t, ...statusPatch('canceled', nowMs), updatedAt: nowMs }))
  return putTasks(changed)
}

/** 이번 회차만 건너뛰기 */
export function skipRecurrence(state: EntityState, id: ID, nowMs: number): ChangeSet {
  const task = state.tasks[id]
  if (!task?.recurrence) return EMPTY_CHANGES
  const next = skipOccurrence(task, nowMs)
  return next ? putTasks([next]) : EMPTY_CHANGES
}

export function deleteTasks(state: EntityState, ids: readonly ID[], nowMs: number): ChangeSet {
  if (ids.length === 0) return EMPTY_CHANGES
  const targets = new Map<ID, Task>()
  const index = childrenIndex(state.tasks)
  for (const id of ids) {
    const task = state.tasks[id]
    if (!task) continue
    for (const t of [task, ...descendantsFrom(index, id)]) targets.set(t.id, t)
  }
  const deleted = [...targets.values()]
    .filter((t) => t.deletedAt === null)
    .map((t) => ({ ...t, deletedAt: nowMs, updatedAt: nowMs }))
  if (deleted.length === 0) return EMPTY_CHANGES
  const title = deleted.length === 1 ? `"${deleted[0].title}"` : `${deleted.length}개`
  const log = activity(null, 'deleted', `${title} 삭제`, nowMs)
  return putTasks(deleted, { puts: { activity: [log] }, deletes: {} })
}

export function restoreTask(state: EntityState, id: ID, nowMs: number): ChangeSet {
  const task = state.tasks[id]
  if (!task || task.deletedAt === null) return EMPTY_CHANGES
  const parent = task.parentId ? state.tasks[task.parentId] : null
  const orphaned = parent !== null && parent !== undefined && parent.deletedAt !== null
  const restored = [task, ...descendantsOf(state, id)]
    .filter((t) => t.deletedAt !== null)
    .map((t) => ({
      ...t,
      deletedAt: null,
      updatedAt: nowMs,
      // 부모가 아직 휴지통에 있으면 최상위로 올려서 보이게 한다.
      parentId: t.id === id && orphaned ? null : t.parentId,
    }))
  const log = activity(id, 'restored', `"${task.title}" 복원`, nowMs)
  return putTasks(restored, { puts: { activity: [log] }, deletes: {} })
}

/** 영구 삭제: 작업, 하위 작업, 댓글을 모두 지운다. */
export function purgeTasks(state: EntityState, ids: readonly ID[]): ChangeSet {
  if (ids.length === 0) return EMPTY_CHANGES
  const doomed = new Set<ID>()
  const index = childrenIndex(state.tasks)
  for (const id of ids) {
    if (!state.tasks[id]) continue
    doomed.add(id)
    for (const t of descendantsFrom(index, id)) doomed.add(t.id)
  }
  if (doomed.size === 0) return EMPTY_CHANGES
  const comments = Object.values(state.comments).filter((c) => doomed.has(c.taskId)).map((c) => c.id)
  return { puts: {}, deletes: { tasks: [...doomed], comments } }
}

export function emptyTrash(state: EntityState): ChangeSet {
  const ids = Object.values(state.tasks).filter((t) => t.deletedAt !== null).map((t) => t.id)
  return purgeTasks(state, ids)
}

/** 30일이 지난 휴지통 항목을 정리한다. 앱을 열 때 한 번 호출한다. */
export function purgeExpiredTrash(state: EntityState, nowMs: number, keepDays = 30): ChangeSet {
  const limit = nowMs - keepDays * 86_400_000
  const ids = Object.values(state.tasks)
    .filter((t) => t.deletedAt !== null && t.deletedAt < limit)
    .map((t) => t.id)
  return purgeTasks(state, ids)
}

export function duplicateTask(state: EntityState, id: ID, nowMs: number): { changes: ChangeSet; newId: ID | null } {
  const source = state.tasks[id]
  if (!source) return { changes: EMPTY_CHANGES, newId: null }
  const family = [source, ...descendantsOf(state, id)].filter((t) => t.deletedAt === null)
  const idMap = new Map<ID, ID>(family.map((t) => [t.id, newId()]))
  const order = nextOrder(state, source.projectId, source.parentId)
  const copies = family.map((t) => ({
    ...t,
    id: idMap.get(t.id) as ID,
    parentId: t.id === id ? t.parentId : t.parentId ? (idMap.get(t.parentId) ?? null) : null,
    order: t.id === id ? order : t.order,
    status: 'todo' as const,
    completedAt: null,
    actualMin: {},
    postponeCount: 0,
    blockedBy: [],
    createdAt: nowMs,
    updatedAt: nowMs,
  }))
  return { changes: putTasks(copies), newId: idMap.get(id) ?? null }
}

export function postponeTask(state: EntityState, id: ID, toDate: ISODate, nowMs: number): ChangeSet {
  const task = state.tasks[id]
  if (!task) return EMPTY_CHANGES
  const log = activity(id, 'postponed', `"${task.title}" ${toDate}로 미룸`, nowMs)
  const updated = { ...task, startDate: toDate, postponeCount: task.postponeCount + 1, updatedAt: nowMs }
  return putTasks([updated], { puts: { activity: [log] }, deletes: {} })
}

export interface MoveTarget {
  projectId: ID
  sectionId: ID | null
  parentId: ID | null
  order?: number
}

/** 프로젝트·섹션·부모를 한 번에 옮긴다. 섹션에 상태 범주가 있으면 그 상태를 따른다(칸반 열 이동). */
export function moveTask(state: EntityState, id: ID, target: MoveTarget, nowMs: number): ChangeSet {
  const task = state.tasks[id]
  if (!task) return EMPTY_CHANGES
  if (wouldCreateCycle(state, id, target.parentId)) return EMPTY_CHANGES
  const section = target.sectionId ? state.sections[target.sectionId] : undefined
  const order = target.order ?? nextOrder(state, target.projectId, target.parentId)
  const patch: Partial<Task> = {
    projectId: target.projectId,
    sectionId: target.sectionId,
    parentId: target.parentId,
    order,
    ...(section?.category ? statusPatch(section.category, nowMs) : {}),
  }
  const projectChanged = target.projectId !== task.projectId
  const kids = projectChanged
    ? descendantsOf(state, id).map((t) => ({ ...t, projectId: target.projectId, sectionId: null, updatedAt: nowMs }))
    : []
  return putTasks([{ ...task, ...patch, updatedAt: nowMs }, ...kids])
}

/** 같은 부모·같은 섹션에서 order 순으로 정렬한 살아 있는 형제들 */
function siblingsOf(state: EntityState, task: Task): Task[] {
  return Object.values(state.tasks)
    .filter(
      (t) =>
        t.deletedAt === null &&
        t.projectId === task.projectId &&
        t.parentId === task.parentId &&
        t.sectionId === task.sectionId &&
        t.status !== 'done' &&
        t.status !== 'canceled',
    )
    .sort((a, b) => a.order - b.order)
}

/** 들여쓰기: 바로 위 형제의 하위 작업이 된다(맨 끝에 붙는다). 위에 형제가 없으면 아무 일도 하지 않는다. */
export function indentTask(state: EntityState, id: ID, nowMs: number): ChangeSet {
  const task = state.tasks[id]
  if (!task) return EMPTY_CHANGES
  const siblings = siblingsOf(state, task)
  const index = siblings.findIndex((t) => t.id === id)
  const newParent = siblings[index - 1]
  if (!newParent) return EMPTY_CHANGES
  return moveTask(state, id, { projectId: task.projectId, sectionId: task.sectionId, parentId: newParent.id }, nowMs)
}

/** 내어쓰기: 부모와 같은 단계로 올라가 부모 바로 뒤에 놓인다. */
export function outdentTask(state: EntityState, id: ID, nowMs: number): ChangeSet {
  const task = state.tasks[id]
  const parent = task?.parentId ? state.tasks[task.parentId] : undefined
  if (!task || !parent) return EMPTY_CHANGES
  const aunts = siblingsOf(state, parent)
  const at = aunts.findIndex((t) => t.id === parent.id)
  const next = aunts[at + 1]
  const order = next ? (parent.order + next.order) / 2 : parent.order + 1000
  return moveTask(state, id, { projectId: parent.projectId, sectionId: parent.sectionId, parentId: parent.parentId, order }, nowMs)
}
