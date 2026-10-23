// 테스트 전용 컨텍스트. 2026-10-23은 금요일이다.
import type { ParseContext } from './types'

export const TODAY = '2026-10-23'

export function makeCtx(overrides: Partial<ParseContext> = {}): ParseContext {
  return {
    today: TODAY,
    now: new Date(2026, 9, 23, 10, 0, 0),
    weekStartsOn: 1,
    projects: [
      { id: 'p-work', name: '업무' },
      { id: 'p-log', name: '업무일지' },
      { id: 'p-home', name: '개인' },
      { id: 'p-my', name: '내 프로젝트' },
      { id: 'p-en', name: 'Work' },
    ],
    labels: [
      { id: 'l-important', name: '중요' },
      { id: 'l-urgent', name: 'urgent' },
    ],
    sections: [
      { id: 's-work-plan', projectId: 'p-work', name: '계획' },
      { id: 's-work-doing', projectId: 'p-work', name: '진행' },
      { id: 's-home-plan', projectId: 'p-home', name: '계획' },
      { id: 's-home-buy', projectId: 'p-home', name: '장보기' },
    ],
    parseDates: true,
    ...overrides,
  }
}
