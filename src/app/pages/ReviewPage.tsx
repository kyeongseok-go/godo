import { ReviewView } from '../../features/review/ReviewView'
import { PageHeader } from '../PageHeader'

export function ReviewPage() {
  return (
    <>
      <PageHeader
        title="주간 리뷰"
        eyebrow="묵은 일 정리"
        description={
          <>
            오래 손대지 않았거나 자주 미룬 일을 모았어요. 항목에 포커스를 두고 <kbd>K</kbd> 유지 · <kbd>T</kbd> 오늘 ·{' '}
            <kbd>W</kbd> 다음 주 · <kbd>S</kbd> 언젠가 · <kbd>X</kbd> 취소 키로 바로 처리할 수 있어요.
          </>
        }
      />
      <ReviewView />
    </>
  )
}
