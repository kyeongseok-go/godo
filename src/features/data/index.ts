// 데이터 기능의 공개 진입점. App.tsx 가 훅 두 개를 호출한다.
// 백업·가져오기 코드는 설정 화면과 자동 스냅샷이 필요할 때만 동적으로 불러오므로 여기서 내보내지 않는다.
export { useAutoSnapshots } from './useAutoSnapshots'
export { usePurgeExpiredTrash } from './usePurgeExpiredTrash'
export { TRASH_KEEP_DAYS } from './constants'
