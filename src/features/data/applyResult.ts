// DB 를 통째로 바꾼 뒤(가져오기·복원·전체 삭제) 화면을 다시 읽는 구간의 결과 구분.
// "아직 안 바뀌었다"와 "이미 바뀌었는데 화면만 못 따라왔다"는 사용자가 할 일이 다르다.
import { useApp } from '../../store/app'

/** DB 는 이미 바뀌었고 메모리 상태만 못 따라온 상태. 새로고침을 안내해야 한다. */
export class StaleAfterApplyError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : '알 수 없는 오류')
    this.name = 'StaleAfterApplyError'
  }
}

/**
 * DB 변경이 끝난 뒤 다른 탭에 알리고 이 탭의 상태를 다시 읽는다.
 * 다시 읽기에 실패하면 StaleAfterApplyError 로 바꿔 던져, 호출 측이 올바른 문구를 보여 준다.
 */
export async function syncAfterApply(): Promise<void> {
  useApp.getState().announceChange()
  try {
    await useApp.getState().reload()
  } catch (error: unknown) {
    throw new StaleAfterApplyError(error)
  }
}

/** 실패 문구. 이미 적용된 뒤의 실패는 "그대로예요"라고 말하지 않는다. */
export function describeApplyFailure(error: unknown, whatFailed: string): string {
  const detail = error instanceof Error ? error.message : '알 수 없는 오류'
  if (error instanceof StaleAfterApplyError) {
    return `${whatFailed}는 끝났지만 화면을 다시 읽지 못했어요. 새로고침해 주세요. (${detail})`
  }
  return `${whatFailed}하지 못했어요. 데이터는 그대로예요. (${detail})`
}
