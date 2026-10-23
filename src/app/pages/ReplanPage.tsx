import { ReplanSession } from '../../features/replan/ReplanSession'
import { PageHeader } from '../PageHeader'

/** F3: 밀린 일을 카드로 한 장씩 정리한다 */
export function ReplanPage() {
  return (
    <>
      <PageHeader
        eyebrow="미완료 정리"
        title="밀린 일 정리"
        description="못 한 일은 실패가 아니에요. 한 장씩 어디로 보낼지만 정해 주세요."
      />
      <ReplanSession />
    </>
  )
}
