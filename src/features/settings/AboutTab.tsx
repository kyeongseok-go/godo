import { Group, InfoRow } from './fields'
import { APP_NAME, APP_VERSION } from './constants'

const CREDITS: ReadonlyArray<{ name: string; role: string; license: string }> = [
  { name: 'Pretendard', role: '본문 글꼴 (길형진)', license: 'SIL Open Font License 1.1' },
  { name: 'Fraunces', role: '제목·큰 숫자 글꼴 (Undercase Type)', license: 'SIL Open Font License 1.1' },
  { name: 'Lucide', role: '아이콘', license: 'ISC License' },
]

export function AboutTab() {
  return (
    <>
      <Group title="앱 정보">
        <div className="st-about">
          <p className="st-about__name">{APP_NAME}</p>
          <p className="st-about__version">버전 {APP_VERSION}</p>
          <p className="st-about__lead">나만의 속도로 하루를 정리하는 개인용 할 일 앱이에요.</p>
        </div>
      </Group>
      <Group title="저장 방식">
        <div className="st-prose">
          <p>
            모든 데이터는 <strong>이 브라우저 안에만</strong> 저장돼요. 서버로 보내지 않고, 계정도 없어요.
          </p>
          <ul>
            <li>브라우저의 사이트 데이터를 지우거나 다른 기기로 옮기면 데이터는 따라오지 않아요.</li>
            <li>그래서 가끔 설정의 <strong>데이터</strong> 탭에서 JSON 백업을 내려받아 두기를 권해요.</li>
            <li>자동 백업 스냅샷도 같은 브라우저 안에 있으니, 파일로 받은 백업이 더 안전해요.</li>
          </ul>
        </div>
      </Group>
      <Group title="글꼴과 아이콘">
        {CREDITS.map((credit) => (
          <InfoRow key={credit.name} label={credit.name} hint={credit.role}>
            <span className="st-credit">{credit.license}</span>
          </InfoRow>
        ))}
      </Group>
    </>
  )
}
