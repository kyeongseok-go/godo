import { NumberStepper } from '../productivity/NumberStepper'
import { POSTPONE_RANGE, STALE_DAYS_RANGE } from './params'
import type { ReviewOptions } from '../../domain/planning'

interface ReviewCriteriaProps {
  value: ReviewOptions
  onChange: (next: ReviewOptions) => void
}

/** 리뷰 기준. 바꾸면 주소에 담겨 새로고침하거나 공유해도 같은 목록이 나온다. */
export function ReviewCriteria({ value, onChange }: ReviewCriteriaProps) {
  return (
    <section className="rv-criteria" aria-label="리뷰 기준">
      <div className="rv-criteria__item">
        <div>
          <p className="rv-criteria__title">묵은 일수</p>
          <p className="rv-criteria__hint">이만큼 손대지 않은 일</p>
        </div>
        <NumberStepper
          value={value.staleDays}
          label="묵은 일수 기준"
          unit="일"
          range={STALE_DAYS_RANGE}
          onChange={(staleDays) => onChange({ ...value, staleDays })}
        />
      </div>
      <div className="rv-criteria__item">
        <div>
          <p className="rv-criteria__title">미룬 횟수</p>
          <p className="rv-criteria__hint">이만큼 이상 미룬 일</p>
        </div>
        <NumberStepper
          value={value.postponeThreshold}
          label="미룬 횟수 기준"
          unit="번"
          range={POSTPONE_RANGE}
          onChange={(postponeThreshold) => onChange({ ...value, postponeThreshold })}
        />
      </div>
    </section>
  )
}
