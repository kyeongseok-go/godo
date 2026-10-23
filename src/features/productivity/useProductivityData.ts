import { useMemo } from 'react'
import { addDays } from '../../domain/date'
import { summarizeProductivity } from '../../domain/stats'
import type { KarmaSummary } from '../../domain/stats'
import { useSettings, useTable, useToday } from '../../hooks/data'
import { hasCompletionHistory, projectDistribution } from './chart'
import type { ProjectDistribution } from './chart'

export const WINDOW_DAYS = 30

export interface ProductivityData {
  today: string
  summary: KarmaSummary
  distribution: ProjectDistribution
  hasHistory: boolean
}

/** 화면이 쓰는 값(카르마 요약, 프로젝트 분포, 이력 유무)을 한 번에 계산한다. */
export function useProductivityData(): ProductivityData {
  const tasks = useTable('tasks')
  const projects = useTable('projects')
  const { weekStartsOn, productivity, dayStartHour } = useSettings()
  const today = useToday()

  const summary = useMemo(
    () =>
      summarizeProductivity({
        tasks,
        today,
        weekStartsOn,
        settings: productivity,
        seriesDays: WINDOW_DAYS,
        dayStartHour,
      }),
    [tasks, today, weekStartsOn, productivity, dayStartHour],
  )
  const distribution = useMemo(
    () => projectDistribution({ tasks, projects, from: addDays(today, -(WINDOW_DAYS - 1)), to: today }),
    [tasks, projects, today],
  )
  const hasHistory = useMemo(() => hasCompletionHistory(tasks), [tasks])
  return { today, summary, distribution, hasHistory }
}
