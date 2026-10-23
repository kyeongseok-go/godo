import { describe, expect, it } from 'vitest'
import { describeFilter, suggestCompletions } from './index'

describe('describeFilter', () => {
  it('returns an empty string when the query does not parse', () => {
    expect(describeFilter('')).toBe('')
    expect(describeFilter('meeting')).toBe('')
    expect(describeFilter('(today')).toBe('')
  })

  it('describes simple date keywords', () => {
    expect(describeFilter('today')).toBe('오늘')
    expect(describeFilter('tomorrow')).toBe('내일')
    expect(describeFilter('어제')).toBe('어제')
    expect(describeFilter('overdue')).toBe('기한 초과')
    expect(describeFilter('no date')).toBe('날짜 없음')
    expect(describeFilter('no time')).toBe('시간 없음')
    expect(describeFilter('no deadline')).toBe('마감 없음')
  })

  it('describes explicit dates and ranges', () => {
    expect(describeFilter('date: 2026-10-30')).toBe('날짜 2026-10-30')
    expect(describeFilter('date: Oct 30')).toBe('날짜 10월 30일')
    expect(describeFilter('date before: next week')).toBe('날짜 다음 주 시작일 이전')
    expect(describeFilter('date after: monday')).toBe('날짜 월요일 이후')
    expect(describeFilter('date: in 3 days')).toBe('날짜 3일 후')
    expect(describeFilter('date: 3일 전')).toBe('날짜 3일 전')
    expect(describeFilter('date: 모레')).toBe('날짜 모레')
    expect(describeFilter('deadline before: today')).toBe('마감 오늘 이전')
    expect(describeFilter('created: today')).toBe('생성일 오늘')
    expect(describeFilter('7 days')).toBe('오늘부터 7일 이내')
    expect(describeFilter('-3 days')).toBe('최근 3일(오늘 포함)')
  })

  it('describes properties', () => {
    expect(describeFilter('p1')).toBe('우선순위 1')
    expect(describeFilter('no priority')).toBe('우선순위 4(기본)')
    expect(describeFilter('#Work')).toBe('프로젝트 "Work"')
    expect(describeFilter('##Work*')).toBe('프로젝트 "Work*"(하위 포함)')
    expect(describeFilter('/기획')).toBe('섹션 "기획"')
    expect(describeFilter('%urgent')).toBe('라벨 "urgent"')
    expect(describeFilter('no labels')).toBe('라벨 없음')
    expect(describeFilter('search: "send email"')).toBe('제목·설명에 "send email" 포함')
  })

  it('describes flags', () => {
    const cases: Array<[string, string]> = [
      ['recurring', '반복 작업'],
      ['subtask', '하위 작업'],
      ['blocked', '막힌 작업'],
      ['hold', '보류 중'],
      ['someday', '언젠가'],
      ['pinned', '고정됨'],
      ['completed', '완료됨'],
      ['canceled', '취소됨'],
      ['view all', '완료·취소 포함 전체 보기'],
      ['all', '전체'],
    ]
    for (const [query, text] of cases) expect(describeFilter(query)).toBe(text)
  })

  it('describes comparisons with readable units', () => {
    expect(describeFilter('postponed')).toBe('미룬 횟수 1회 이상')
    expect(describeFilter('postponed > 3')).toBe('미룬 횟수 3회 초과')
    expect(describeFilter('postponed <= 2')).toBe('미룬 횟수 2회 이하')
    expect(describeFilter('postponed < 2')).toBe('미룬 횟수 2회 미만')
    expect(describeFilter('postponed = 2')).toBe('미룬 횟수 2회')
    expect(describeFilter('estimate > 30m')).toBe('예상 시간 30분 초과')
    expect(describeFilter('estimate >= 1h30m')).toBe('예상 시간 1시간 30분 이상')
    expect(describeFilter('estimate < 2h')).toBe('예상 시간 2시간 미만')
  })

  it('describes operators with precedence-aware grouping', () => {
    expect(describeFilter('p1 & today')).toBe('우선순위 1 그리고 오늘')
    expect(describeFilter('today | overdue')).toBe('오늘 또는 기한 초과')
    expect(describeFilter('(today | overdue) & #Work')).toBe(
      '(오늘 또는 기한 초과) 그리고 프로젝트 "Work"',
    )
    expect(describeFilter('p1 | p2 & p3')).toBe('우선순위 1 또는 (우선순위 2 그리고 우선순위 3)')
    expect(describeFilter('!subtask')).toBe('하위 작업 제외')
    expect(describeFilter('!(today | overdue)')).toBe('(오늘 또는 기한 초과) 제외')
    expect(describeFilter('!!p1')).toBe('(우선순위 1 제외) 제외')
  })

  it('numbers multiple groups', () => {
    expect(describeFilter('p1 & overdue, p4 & today')).toBe(
      '1번 목록: 우선순위 1 그리고 기한 초과 / 2번 목록: 우선순위 4(기본) 그리고 오늘',
    )
  })
})

describe('suggestCompletions', () => {
  it('returns nothing for empty or name-prefixed fragments', () => {
    expect(suggestCompletions('')).toEqual([])
    expect(suggestCompletions('   ')).toEqual([])
    expect(suggestCompletions('p1 & ')).toEqual([])
    expect(suggestCompletions('#Wo')).toEqual([])
    expect(suggestCompletions('%wo')).toEqual([])
    expect(suggestCompletions('/기')).toEqual([])
  })

  it('completes the last fragment after an operator', () => {
    expect(suggestCompletions('to')).toEqual(['today', 'tomorrow'])
    expect(suggestCompletions('p1 & to')).toEqual(['today', 'tomorrow'])
    expect(suggestCompletions('(overdue|TO')).toEqual(['today', 'tomorrow'])
    expect(suggestCompletions('!sub')).toEqual(['subtask'])
  })

  it('completes multi-word keywords', () => {
    expect(suggestCompletions('no d')).toEqual(['no date', 'no deadline'])
    expect(suggestCompletions('date b')).toEqual(['date before:'])
  })

  it('completes korean keywords', () => {
    expect(suggestCompletions('오')).toEqual(['오늘'])
    expect(suggestCompletions('기한')).toEqual(['기한초과'])
  })

  it('suggests date words after a date keyword colon', () => {
    expect(suggestCompletions('date: to')).toEqual(['today', 'tomorrow'])
    expect(suggestCompletions('deadline before: 내')).toEqual(['내일'])
    expect(suggestCompletions('search: to')).toEqual([])
    expect(suggestCompletions('foo: to')).toEqual([])
  })

  it('caps the number of suggestions and avoids duplicates', () => {
    const result = suggestCompletions('p')
    expect(result.length).toBeLessThanOrEqual(8)
    expect(new Set(result).size).toBe(result.length)
    expect(result).toContain('p1')
  })

  it('returns nothing when no keyword matches', () => {
    expect(suggestCompletions('zzz')).toEqual([])
  })
})
