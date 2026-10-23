import { forwardRef } from 'react'

interface ReviewDoneProps {
  handledCount: number
}

/** 리뷰할 항목이 없을 때. 직접 다 정리한 경우와 처음부터 깨끗한 경우의 문구를 나눈다. */
export const ReviewDone = forwardRef<HTMLDivElement, ReviewDoneProps>(function ReviewDone({ handledCount }, ref) {
  return (
    <div className="rv-done" ref={ref} tabIndex={-1} role="status">
      <p className="rv-done__title">깨끗해졌어요</p>
      <p className="rv-done__text">
        {handledCount > 0
          ? `${handledCount}개를 정리했어요. 잠시 숨을 돌려도 좋아요.`
          : '지금은 리뷰할 일이 없어요. 위 기준을 줄이면 더 오래된 일도 찾아볼 수 있어요.'}
      </p>
    </div>
  )
})
