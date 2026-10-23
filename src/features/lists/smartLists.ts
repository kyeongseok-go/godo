// 스마트 목록: 어떤 작업이 어느 목록에 보이는지를 정하는 순수 함수 모음.
import { addDays, compareDate, toISODate } from '../../domain/date'
import { describeDate } from '../../domain/format'
import { buildToday, makeActionableChecker } from '../../domain/planning'
import { INBOX_ID } from '../../domain/types'
import type { EngineContext, ID, ISODate, Task } from '../../domain/types'
import { groupTasks, sortTasks } from '../../domain/views'
import type { TaskGroup } from '../../domain/views'

export type SmartListId =
  | 'inbox'
  | 'today'
  | 'upcoming'
  | 'now'
  | 'all'
  | 'someday'
  | 'completed'
  | 'canceled'
  | 'trash'

export const SMART_LIST_TITLES: Record<SmartListId, string> = {
  inbox: '받은편지함',
  today: '오늘',
  upcoming: '다음 7일',
  now: '지금 할 수 있는 것',
  all: '전체',
  someday: '언젠가',
  completed: '완료',
  canceled: '계획 취소',
  trash: '휴지통',
}

export const UPCOMING_DAYS = 7

export const isOpen = (t: Task): boolean => t.deletedAt === null && (t.status === 'todo' || t.status === 'active')

const group = (key: string, title: string, tasks: Task[]): TaskGroup => ({ key, title, tasks })

const byManual = (tasks: readonly Task[]): Task[] => sortTasks(tasks, 'manual', 'asc')

/** 날짜 하나로 환산한 기준일: 시작일이 있으면 시작일, 없으면 마감일 */
export const effectiveDate = (t: Task): ISODate | null => t.startDate ?? t.dueDate

function todayGroups(ctx: EngineContext): TaskGroup[] {
  const plan = buildToday(ctx)
  return [
    group('overdue', '기한 초과', plan.overdue),
    group('timed', '시간 지정', plan.timed),
    group('morning', '오전', plan.morning),
    group('afternoon', '오후', plan.afternoon),
    group('evening', '저녁', plan.evening),
    group('anytime', '하루 중', plan.anytime),
  ].filter((g) => g.tasks.length > 0)
}

function upcomingGroups(ctx: EngineContext): TaskGroup[] {
  const end = addDays(ctx.today, UPCOMING_DAYS)
  const byDate = new Map<ISODate, Task[]>()
  for (const t of ctx.tasks) {
    const d = effectiveDate(t)
    if (!isOpen(t) || !d || d <= ctx.today || d > end || t.someday || t.onHold) continue
    byDate.set(d, [...(byDate.get(d) ?? []), t])
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => compareDate(a, b))
    .map(([date, tasks]) => group(date, describeDate(date, ctx.today), sortTasks(tasks, 'manual', 'asc')))
}

function completedGroups(ctx: EngineContext): TaskGroup[] {
  const done = ctx.tasks.filter((t) => t.deletedAt === null && t.status === 'done' && t.completedAt !== null)
  const byDay = new Map<ISODate, Task[]>()
  for (const t of done) {
    const day = toISODate(new Date(t.completedAt as number))
    byDay.set(day, [...(byDay.get(day) ?? []), t])
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => compareDate(b, a))
    .map(([day, tasks]) =>
      group(day, describeDate(day, ctx.today), [...tasks].sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))),
    )
}

export function smartListGroups(id: SmartListId, ctx: EngineContext): TaskGroup[] {
  switch (id) {
    case 'inbox':
      return [group('all', '', byManual(ctx.tasks.filter((t) => isOpen(t) && t.projectId === INBOX_ID && !t.someday)))]
    case 'today':
      return todayGroups(ctx)
    case 'upcoming':
      return upcomingGroups(ctx)
    case 'now': {
      const ready = ctx.tasks.filter(makeActionableChecker(ctx))
      return groupTasks(ready, 'project', ctx)
    }
    case 'all':
      return groupTasks(ctx.tasks.filter((t) => isOpen(t) && !t.someday), 'project', ctx)
    case 'someday':
      return [group('all', '', byManual(ctx.tasks.filter((t) => isOpen(t) && t.someday)))]
    case 'completed':
      return completedGroups(ctx)
    case 'canceled':
      return [group('all', '', ctx.tasks.filter((t) => t.deletedAt === null && t.status === 'canceled'))]
    case 'trash': {
      // 삭제된 하위 트리는 가장 위 작업만 보여준다(복원하면 하위 작업도 같이 돌아온다).
      const deletedIds = new Set(ctx.tasks.filter((t) => t.deletedAt !== null).map((t) => t.id))
      const roots = ctx.tasks.filter((t) => t.deletedAt !== null && !(t.parentId && deletedIds.has(t.parentId)))
      return [group('all', '', [...roots].sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0)))]
    }
  }
}

/** 사이드바 개수 배지용. 화면에 실제로 나오는 작업 수와 같은 기준을 쓴다. */
export function smartListCounts(ctx: EngineContext): Record<'inbox' | 'today' | 'upcoming' | 'now', number> {
  const count = (id: SmartListId): number => smartListGroups(id, ctx).reduce((n, g) => n + g.tasks.length, 0)
  return { inbox: count('inbox'), today: count('today'), upcoming: count('upcoming'), now: count('now') }
}

export function projectOpenCount(ctx: EngineContext, projectId: ID): number {
  return ctx.tasks.filter((t) => isOpen(t) && t.projectId === projectId).length
}
