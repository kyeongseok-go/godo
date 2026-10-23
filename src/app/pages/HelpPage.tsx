import { HelpView } from '../../features/help/HelpView'
import { PageHeader } from '../PageHeader'

export function HelpPage() {
  return (
    <>
      <PageHeader title="사용 가이드" eyebrow="하나씩 따라 해 보세요" description="각 장의 '따라 해 보기'를 그대로 눌러 보면 금방 익숙해져요. 마지막 장에 7일 적응 플랜과 체크리스트가 있어요." />
      <HelpView />
    </>
  )
}
