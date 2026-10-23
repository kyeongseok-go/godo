import { ArrowRight } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { paths } from '../../app/nav'
import { replanCandidates } from '../../domain/planning'
import { EmptyNote } from './PlanControls'
import { StepFrame } from './StepFrame'
import type { StepNav } from './StepFrame'
import type { PlanContext } from './usePlanContext'

interface StepProps {
  pc: PlanContext
  nav: StepNav
}

/** ① 어제까지 못 한 일 확인 — 정리는 미완료 정리 화면이 맡고, 여기서는 개수와 길만 알려 준다 */
export function ReviewStep({ pc, nav }: StepProps) {
  const count = useMemo(() => replanCandidates(pc.ctx).length, [pc.ctx])
  return (
    <StepFrame
      title="어제까지 못 한 일 확인"
      hint="못 끝낸 일이 있어도 괜찮아요. 오늘 계획을 짜기 전에 한 번만 훑어 봐요."
      nav={nav}
      nextLabel="오늘 후보 고르기"
    >
      {count > 0 ? (
        <div className="plan-callout">
          <p className="plan-callout__num" aria-hidden="true">
            {count}
          </p>
          <div className="plan-callout__text">
            <p className="plan-callout__lead">어제까지 못 끝낸 일이 {count}개 있어요.</p>
            <p className="plan-callout__calm">괜찮아요, 미뤄도 돼요. 한 장씩 어디로 보낼지만 정하면 돼요.</p>
            <Link to={paths.replan} className="ritual-btn ritual-btn--accent">
              밀린 일 정리하러 가기
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      ) : (
        <EmptyNote>밀린 일이 없어요. 가볍게 시작해 봐요.</EmptyNote>
      )}
    </StepFrame>
  )
}
