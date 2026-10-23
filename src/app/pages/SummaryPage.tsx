import { SummaryView } from '../../features/summary/SummaryView'
import { PageHeader } from '../PageHeader'

export function SummaryPage() {
  return (
    <>
      <PageHeader
        title="요약 보고서"
        eyebrow="주간 보고"
        description="기간·프로젝트·상태를 고르면 마크다운으로 정리해요. 옵션은 주소에 담겨 새로고침해도 그대로예요."
      />
      <SummaryView />
    </>
  )
}
