// 요약 보고서 옵션 ↔ URL 검색 파라미터. 공유·새로고침 후에도 같은 보고서가 열리게 한다.
import { nextWeekStart } from '../../domain/calendarGrid'
import { addDays, isISODate, lastDayOfMonth, startOfWeek } from '../../domain/date'
import type { SummaryOptions } from '../../domain/stats'
import type { ID, ISODate } from '../../domain/types'

export type SummaryRange = 'today' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'custom'
export type SummaryStatus = SummaryOptions['status']

export interface SummaryParams {
  range: SummaryRange
  /** custom 일 때만 쓰는 시작·끝 날짜 */
  from: ISODate | null
  to: ISODate | null
  /** null 이면 모든 프로젝트 */
  projectIds: ID[] | null
  status: SummaryStatus
}

export const DEFAULT_SUMMARY_PARAMS: SummaryParams = {
  range: 'thisWeek',
  from: null,
  to: null,
  projectIds: null,
  status: 'all',
}

export const RANGE_LABELS: Readonly<Record<SummaryRange, string>> = {
  today: '오늘',
  thisWeek: '이번 주',
  lastWeek: '지난 주',
  thisMonth: '이번 달',
  custom: '사용자 지정',
}

export const STATUS_LABELS: Readonly<Record<SummaryStatus, string>> = {
  completed: '완료',
  pending: '미완료',
  all: '전체',
}

const RANGES = Object.keys(RANGE_LABELS) as SummaryRange[]
const STATUSES = Object.keys(STATUS_LABELS) as SummaryStatus[]
const KEYS = ['range', 'from', 'to', 'projects', 'status'] as const
const DAYS_IN_WEEK = 7

const pickOne = <T extends string>(allowed: readonly T[], value: string | null, fallback: T): T =>
  allowed.find((candidate) => candidate === value) ?? fallback

const pickDate = (value: string | null): ISODate | null => (isISODate(value) ? value : null)

function parseProjects(raw: string | null): ID[] | null {
  if (raw === null) return null
  return [...new Set(raw.split(',').filter((id) => id !== ''))]
}

export function parseSummaryParams(search: URLSearchParams): SummaryParams {
  return {
    range: pickOne(RANGES, search.get('range'), DEFAULT_SUMMARY_PARAMS.range),
    from: pickDate(search.get('from')),
    to: pickDate(search.get('to')),
    projectIds: parseProjects(search.get('projects')),
    status: pickOne(STATUSES, search.get('status'), DEFAULT_SUMMARY_PARAMS.status),
  }
}

/** 기본값과 같은 항목은 쓰지 않아 주소를 짧게 둔다. base 의 다른 키(예: task)는 그대로 보존한다. */
export function writeSummaryParams(params: SummaryParams, base?: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(base)
  KEYS.forEach((key) => next.delete(key))
  if (params.range !== DEFAULT_SUMMARY_PARAMS.range) next.set('range', params.range)
  if (params.range === 'custom') {
    if (params.from) next.set('from', params.from)
    if (params.to) next.set('to', params.to)
  }
  if (params.projectIds !== null) next.set('projects', params.projectIds.join(','))
  if (params.status !== DEFAULT_SUMMARY_PARAMS.status) next.set('status', params.status)
  return next
}

function rangeDates(params: SummaryParams, today: ISODate, weekStartsOn: 0 | 1): { from: ISODate; to: ISODate } {
  switch (params.range) {
    case 'today':
      return { from: today, to: today }
    case 'thisWeek': {
      const from = startOfWeek(today, weekStartsOn)
      return { from, to: addDays(from, DAYS_IN_WEEK - 1) }
    }
    case 'lastWeek': {
      const from = addDays(startOfWeek(today, weekStartsOn), -DAYS_IN_WEEK)
      return { from, to: addDays(from, DAYS_IN_WEEK - 1) }
    }
    case 'thisMonth': {
      const [year, month] = today.split('-').map(Number)
      const prefix = today.slice(0, 7)
      return { from: `${prefix}-01`, to: `${prefix}-${String(lastDayOfMonth(year, month)).padStart(2, '0')}` }
    }
    case 'custom': {
      const from = params.from ?? params.to ?? today
      const to = params.to ?? params.from ?? today
      return from <= to ? { from, to } : { from: to, to: from }
    }
  }
}

/** 화면 옵션을 buildSummaryMarkdown 이 받는 옵션으로 바꾼다. */
export function resolveSummaryOptions(params: SummaryParams, today: ISODate, weekStartsOn: 0 | 1): SummaryOptions {
  return { ...rangeDates(params, today, weekStartsOn), projectIds: params.projectIds, status: params.status }
}

/**
 * 프로젝트 칩 클릭. "전체"에서 하나를 고르면 그 하나만 남고, 모두 고르거나 마지막 하나를 빼면 다시 "전체"가 된다.
 */
export function toggleProject(current: readonly ID[] | null, id: ID, allIds: readonly ID[]): ID[] | null {
  if (current === null) return [id]
  const next = current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id]
  if (next.length === 0 || allIds.every((candidate) => next.includes(candidate))) return null
  return next
}

export type QuickPreset = 'thisWeekDone' | 'nextWeekTodo'

export const QUICK_PRESET_LABELS: Readonly<Record<QuickPreset, string>> = {
  thisWeekDone: '이번 주 한 일',
  nextWeekTodo: '다음 주 할 일',
}

/** 주간 보고서용 빠른 설정. 프로젝트 선택은 사용자가 정한 대로 둔다. */
export function quickPresetParams(
  preset: QuickPreset,
  current: SummaryParams,
  today: ISODate,
  weekStartsOn: 0 | 1,
): SummaryParams {
  if (preset === 'thisWeekDone') {
    return { ...current, range: 'thisWeek', from: null, to: null, status: 'completed' }
  }
  const from = nextWeekStart(today, weekStartsOn)
  return { ...current, range: 'custom', from, to: addDays(from, DAYS_IN_WEEK - 1), status: 'pending' }
}

export function isQuickPresetActive(
  preset: QuickPreset,
  current: SummaryParams,
  today: ISODate,
  weekStartsOn: 0 | 1,
): boolean {
  const target = quickPresetParams(preset, current, today, weekStartsOn)
  return (
    current.range === target.range &&
    current.status === target.status &&
    current.from === target.from &&
    current.to === target.to
  )
}

/** 내려받는 파일 이름. 기간이 하루면 날짜 하나만 쓴다. */
export function summaryFileName(options: Pick<SummaryOptions, 'from' | 'to'>): string {
  const period = options.from === options.to ? options.from : `${options.from}_${options.to}`
  return `pace-summary-${period}.md`
}
