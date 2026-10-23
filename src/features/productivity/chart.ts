// 생산성 화면의 계산만 모은 순수 모듈: 추이 막대 기하, 레벨 진행률, 프로젝트별 분포.
import { fromISODate, toISODate, weekdayOf, WEEKDAY_KO } from '../../domain/date'
import { KARMA_LEVELS } from '../../domain/stats'
import type { ISODate, Project, Task, Weekday } from '../../domain/types'

export const TREND_PADDING = { top: 12, right: 8, bottom: 26, left: 28 } as const

const MIN_BAR_HEIGHT = 2
const MIN_BAR_WIDTH = 2
const MAX_BAR_WIDTH = 28
const BAR_FILL_RATIO = 0.62
const DELETED_PROJECT_NAME = '삭제된 프로젝트'
export const DEFAULT_DISTRIBUTION_LIMIT = 5

export interface TrendBar {
  index: number
  date: ISODate
  done: number
  x: number
  y: number
  width: number
  height: number
  /** 호버·포커스를 받는 세로 띠(막대보다 넓다) */
  slotX: number
  slotWidth: number
  isOff: boolean
  isToday: boolean
}

export interface TrendChart {
  bars: TrendBar[]
  max: number
  goalY: number
  plotTop: number
  plotBottom: number
  plotLeft: number
  plotRight: number
}

export interface TrendInput {
  series: readonly { date: ISODate; done: number }[]
  dailyGoal: number
  daysOff: readonly Weekday[]
  today: ISODate
  width: number
  height: number
}

export function buildTrend(input: TrendInput): TrendChart {
  const { series, daysOff, today, width, height } = input
  const goal = Math.max(1, input.dailyGoal)
  const plotTop = TREND_PADDING.top
  const plotBottom = Math.max(plotTop + 1, height - TREND_PADDING.bottom)
  const plotLeft = TREND_PADDING.left
  const plotRight = Math.max(plotLeft + 1, width - TREND_PADDING.right)
  const plotHeight = plotBottom - plotTop
  const max = Math.max(1, goal, ...series.map((point) => point.done))
  const slotWidth = series.length === 0 ? 0 : (plotRight - plotLeft) / series.length
  const barWidth = Math.min(MAX_BAR_WIDTH, Math.max(MIN_BAR_WIDTH, slotWidth * BAR_FILL_RATIO))

  const bars = series.map((point, index): TrendBar => {
    const scaled = (point.done / max) * plotHeight
    const barHeight = point.done > 0 ? Math.max(MIN_BAR_HEIGHT, scaled) : 0
    const slotX = plotLeft + index * slotWidth
    return {
      index,
      date: point.date,
      done: point.done,
      x: slotX + (slotWidth - barWidth) / 2,
      y: plotBottom - barHeight,
      width: barWidth,
      height: barHeight,
      slotX,
      slotWidth,
      isOff: daysOff.includes(weekdayOf(point.date)),
      isToday: point.date === today,
    }
  })

  return {
    bars,
    max,
    goalY: plotBottom - (goal / max) * plotHeight,
    plotTop,
    plotBottom,
    plotLeft,
    plotRight,
  }
}

/** 날짜 눈금을 붙일 막대 번호. 오늘(마지막)부터 step 간격으로 거슬러 올라간다. */
export function axisLabelIndices(length: number, step: number): number[] {
  const safeStep = Math.max(1, Math.floor(step))
  const indices: number[] = []
  for (let i = length - 1; i >= 0; i -= safeStep) indices.unshift(i)
  return indices
}

/** 툴팁·표 대체 텍스트에 쓰는 한 줄 설명 */
export function describeTrendBar(
  bar: Pick<TrendBar, 'date' | 'done' | 'isOff' | 'isToday'>,
  dailyGoal: number,
): string {
  const date = fromISODate(bar.date)
  const parts = [
    `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAY_KO[date.getDay()]})`,
    bar.done > 0 ? `${bar.done}건 완료` : '완료 없음',
  ]
  if (bar.done >= Math.max(1, dailyGoal)) parts.push('목표 달성')
  if (bar.isOff) parts.push('쉬는 날')
  if (bar.isToday) parts.push('오늘')
  return parts.join(' · ')
}

/** 현재 레벨 시작점에서 다음 레벨까지 얼마나 왔는지(0~1)와 남은 점수 */
export function levelProgress(
  points: number,
  levelIndex: number,
  nextLevelAt: number | null,
): { ratio: number; remaining: number | null } {
  if (nextLevelAt === null) return { ratio: 1, remaining: null }
  const floor = KARMA_LEVELS[levelIndex]?.min ?? 0
  const span = Math.max(1, nextLevelAt - floor)
  const ratio = Math.min(1, Math.max(0, (points - floor) / span))
  return { ratio, remaining: Math.max(0, nextLevelAt - points) }
}

export interface ProjectShare {
  projectId: string
  name: string
  color: string
  count: number
  /** 가장 많은 프로젝트를 1로 놓은 비율(막대 길이용) */
  ratio: number
}

export interface ProjectDistribution {
  items: ProjectShare[]
  /** 표시 한도 밖으로 밀려난 프로젝트 수 */
  otherProjects: number
  total: number
}

const FALLBACK_COLOR = 'var(--p4)'

/** 기간 안에 완료한 작업을 프로젝트별로 센다. 많은 순, 같으면 이름순. */
export function projectDistribution(input: {
  tasks: readonly Task[]
  projects: readonly Project[]
  from: ISODate
  to: ISODate
  limit?: number
}): ProjectDistribution {
  const { tasks, projects, from, to, limit = DEFAULT_DISTRIBUTION_LIMIT } = input
  const counts = new Map<string, number>()
  for (const task of tasks) {
    if (task.status !== 'done' || task.completedAt === null || task.deletedAt !== null) continue
    const date = toISODate(new Date(task.completedAt))
    if (date < from || date > to) continue
    counts.set(task.projectId, (counts.get(task.projectId) ?? 0) + 1)
  }

  const byId = new Map(projects.map((project) => [project.id, project]))
  const all = [...counts.entries()]
    .map(([projectId, count]) => ({
      projectId,
      count,
      name: byId.get(projectId)?.name ?? DELETED_PROJECT_NAME,
      color: byId.get(projectId)?.color ?? FALLBACK_COLOR,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'))

  const top = all[0]?.count ?? 1
  const shown = all.slice(0, Math.max(0, limit)).map((item) => ({ ...item, ratio: item.count / top }))
  return {
    items: shown,
    otherProjects: Math.max(0, all.length - shown.length),
    total: all.reduce((sum, item) => sum + item.count, 0),
  }
}

/** 완료 이력이 하나라도 있는지(빈 상태 문구를 보일지 판단) */
export function hasCompletionHistory(tasks: readonly Task[]): boolean {
  return tasks.some((task) => task.status === 'done' && task.completedAt !== null && task.deletedAt === null)
}
