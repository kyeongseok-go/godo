import { useMemo } from 'react'
import type { DayPlan, EngineContext, ISODate, Settings } from '../../domain/types'
import { useEngineContext, useSettings } from '../../hooks/data'
import { useApp } from '../../store/app'
import { emptyDayPlan } from './commands'

export interface PlanContext {
  ctx: EngineContext
  settings: Settings
  today: ISODate
  plan: DayPlan
  /** 오늘 용량(분): 그날 지정값, 없으면 설정 기본값 */
  capacityMin: number
}

/** 계획 화면이 함께 쓰는 값 묶음. 오늘의 DayPlan 이 없으면 빈 계획으로 본다. */
export function usePlanContext(): PlanContext {
  const ctx = useEngineContext()
  const settings = useSettings()
  const stored = useApp((s) => s.entities.dayPlans[ctx.today])
  const plan = useMemo(() => stored ?? emptyDayPlan(ctx.today), [stored, ctx.today])
  return { ctx, settings, today: ctx.today, plan, capacityMin: plan.capacityMin ?? settings.dailyCapacityMin }
}
