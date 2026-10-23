import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import './ritual.css'
import './plan.css'

export interface StepNav {
  onPrev?: () => void
  onNext?: () => void
  /** 단계를 옮긴 뒤에는 제목으로 포커스를 보내 스크린 리더가 새 단계를 읽게 한다 */
  focusOnMount: boolean
}

interface StepFrameProps {
  title: string
  hint: string
  nav: StepNav
  nextLabel?: string
  /** 다음 버튼 자리를 대신하는 마무리 버튼 등 */
  finish?: ReactNode
  children: ReactNode
}

export function StepFrame({ title, hint, nav, nextLabel, finish, children }: StepFrameProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (nav.focusOnMount) headingRef.current?.focus({ preventScroll: true })
  }, [nav.focusOnMount])

  return (
    <section className="plan-step" aria-labelledby="plan-step-title">
      <header className="plan-step__head">
        <h2 id="plan-step-title" className="plan-step__title" ref={headingRef} tabIndex={-1}>
          {title}
        </h2>
        <p className="plan-step__hint">{hint}</p>
      </header>
      <div className="plan-step__body">{children}</div>
      <footer className="plan-step__nav">
        {nav.onPrev ? (
          <button type="button" className="ritual-btn ritual-btn--quiet" onClick={nav.onPrev}>
            <ArrowLeft size={16} aria-hidden="true" />
            이전
          </button>
        ) : (
          <span />
        )}
        {finish ??
          (nav.onNext ? (
            <button type="button" className="ritual-btn ritual-btn--primary" onClick={nav.onNext}>
              {nextLabel ?? '다음'}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          ) : null)}
      </footer>
    </section>
  )
}
