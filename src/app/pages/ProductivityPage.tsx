import { ProductivityView } from '../../features/productivity/ProductivityView'
import { PageHeader } from '../PageHeader'

export function ProductivityPage() {
  return (
    <>
      <PageHeader
        title="생산성"
        eyebrow="카르마 · 목표 · 연속"
        description="끝낸 일에서 계산해요. 완료한 날의 기록이 쌓일수록 정확해져요."
      />
      <ProductivityView />
    </>
  )
}
