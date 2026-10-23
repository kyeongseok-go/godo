// 필터 모듈 테스트 전용 헬퍼. 운영 코드에서는 가져오지 않는다.
import type { EngineContext } from '../types'

/** 2026-10-23은 금요일이다. */
export const TODAY = '2026-10-23'

export function makeCtx(overrides: Partial<EngineContext> = {}): EngineContext {
  return {
    today: TODAY,
    now: new Date(2026, 9, 23, 12, 0),
    weekStartsOn: 1,
    projects: [],
    sections: [],
    labels: [],
    tasks: [],
    ...overrides,
  }
}
