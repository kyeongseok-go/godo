import { matchScore, rankBy } from './search'

describe('matchScore', () => {
  test('an empty query matches everything', () => {
    expect(matchScore('아무거나', '')).toBeGreaterThan(0)
  })

  test('requires every term to appear', () => {
    expect(matchScore('우유 사기', '우유 사기')).toBeGreaterThan(0)
    expect(matchScore('우유 사기', '우유 빵')).toBe(0)
  })

  test('is case-insensitive', () => {
    expect(matchScore('Weekly Report', 'weekly')).toBeGreaterThan(0)
  })

  test('prefers prefix matches over mid-word matches', () => {
    expect(matchScore('보고서 작성', '보고')).toBeGreaterThan(matchScore('주간보고서', '보고'))
  })

  test('an exact match gets a bonus', () => {
    expect(matchScore('오늘', '오늘')).toBeGreaterThan(matchScore('오늘의 할 일', '오늘'))
  })
})

describe('rankBy', () => {
  test('sorts by score, drops non-matches, and respects the limit', () => {
    const items = ['주간보고서', '보고서 작성', '청소', '보고']

    expect(rankBy(items, '보고', (s) => s, 2)).toEqual(['보고', '보고서 작성'])
    expect(rankBy(items, '없는말', (s) => s, 5)).toEqual([])
  })
})
