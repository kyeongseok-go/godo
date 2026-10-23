import { describe, expect, it } from 'vitest'
import { parseFilter } from './index'
import type { FilterError, FilterNode } from './index'

function one(query: string): FilterNode {
  const result = parseFilter(query)
  if (!result.ok) throw new Error(`파싱 실패: ${result.error.message} @${result.error.position}`)
  expect(result.ast).toHaveLength(1)
  return result.ast[0]
}

function fail(query: string): FilterError {
  const result = parseFilter(query)
  if (result.ok) throw new Error(`실패해야 하는 쿼리가 통과했다: ${query}`)
  return result.error
}

const dateOn = (days: number): unknown => ({
  type: 'date',
  field: 'date',
  op: 'on',
  value: { kind: 'offset', days },
})
const TODAY_NODE = dateOn(0)
const OVERDUE = { type: 'overdue' }
const prio = (level: number): unknown => ({ type: 'priority', level })
const project = (name: string, includeChildren = false): unknown => ({
  type: 'project',
  name: [name],
  includeChildren,
})
const flag = (name: string): unknown => ({ type: 'flag', flag: name })

describe('parseFilter: keywords and synonyms', () => {
  it('parses english and korean date keywords', () => {
    expect(one('today')).toEqual(TODAY_NODE)
    expect(one('오늘')).toEqual(TODAY_NODE)
    expect(one('tomorrow')).toEqual(dateOn(1))
    expect(one('내일')).toEqual(dateOn(1))
    expect(one('yesterday')).toEqual(dateOn(-1))
    expect(one('어제')).toEqual(dateOn(-1))
  })

  it('ignores letter case in keywords', () => {
    expect(one('TODAY')).toEqual(TODAY_NODE)
    expect(one('OverDue')).toEqual(OVERDUE)
    expect(one('P1')).toEqual(prio(1))
  })

  it('accepts every overdue spelling', () => {
    for (const q of ['overdue', 'od', 'over due', 'OD', '기한초과', '기한 초과']) {
      expect(one(q)).toEqual(OVERDUE)
    }
  })

  it('parses no-date style keywords in both languages', () => {
    expect(one('no date')).toEqual({ type: 'noDate' })
    expect(one('날짜없음')).toEqual({ type: 'noDate' })
    expect(one('no time')).toEqual({ type: 'noTime' })
    expect(one('시간없음')).toEqual({ type: 'noTime' })
    expect(one('no deadline')).toEqual({ type: 'noDeadline' })
    expect(one('마감없음')).toEqual({ type: 'noDeadline' })
    expect(one('no labels')).toEqual({ type: 'noLabels' })
    expect(one('라벨없음')).toEqual({ type: 'noLabels' })
  })

  it('treats no priority as p4', () => {
    expect(one('no priority')).toEqual(prio(4))
  })

  it('parses flag keywords with korean synonyms', () => {
    const pairs: Array<[string, string, string]> = [
      ['recurring', '반복', 'recurring'],
      ['subtask', '하위작업', 'subtask'],
      ['blocked', '막힘', 'blocked'],
      ['hold', '보류', 'hold'],
      ['someday', '언젠가', 'someday'],
      ['pinned', '고정', 'pinned'],
      ['completed', '완료', 'completed'],
      ['canceled', '취소', 'canceled'],
      ['view all', '전체보기', 'viewAll'],
    ]
    for (const [en, ko, name] of pairs) {
      expect(one(en)).toEqual(flag(name))
      expect(one(ko)).toEqual(flag(name))
    }
  })

  it('parses postponed without a comparison as at least once', () => {
    const expected = { type: 'compare', field: 'postponed', op: '>=', value: 1 }
    expect(one('postponed')).toEqual(expected)
    expect(one('미룸')).toEqual(expected)
  })
})

describe('parseFilter: operators', () => {
  it('gives & higher precedence than |', () => {
    expect(one('p1 | p2 & p3')).toEqual({
      type: 'or',
      children: [prio(1), { type: 'and', children: [prio(2), prio(3)] }],
    })
  })

  it('gives ! higher precedence than &', () => {
    expect(one('!p1 & today')).toEqual({
      type: 'and',
      children: [{ type: 'not', child: prio(1) }, TODAY_NODE],
    })
  })

  it('flattens chains of the same operator', () => {
    expect(one('p1 & p2 & p3')).toEqual({ type: 'and', children: [prio(1), prio(2), prio(3)] })
    expect(one('p1 | p2 | p3')).toEqual({ type: 'or', children: [prio(1), prio(2), prio(3)] })
  })

  it('groups with parentheses', () => {
    expect(one('(today | overdue) & #Work')).toEqual({
      type: 'and',
      children: [{ type: 'or', children: [TODAY_NODE, OVERDUE] }, project('Work')],
    })
  })

  it('handles nested negation', () => {
    expect(one('!!p1')).toEqual({ type: 'not', child: { type: 'not', child: prio(1) } })
    expect(one('!(p1 | !(today & p2))')).toEqual({
      type: 'not',
      child: {
        type: 'or',
        children: [
          prio(1),
          { type: 'not', child: { type: 'and', children: [TODAY_NODE, prio(2)] } },
        ],
      },
    })
  })

  it('parses a leading-negated subtask as top-level only', () => {
    expect(one('!subtask')).toEqual({ type: 'not', child: flag('subtask') })
  })

  it('accepts operators without surrounding spaces', () => {
    expect(one('p1&today|p2')).toEqual({
      type: 'or',
      children: [{ type: 'and', children: [prio(1), TODAY_NODE] }, prio(2)],
    })
    expect(one('overdue&!no time')).toEqual({
      type: 'and',
      children: [OVERDUE, { type: 'not', child: { type: 'noTime' } }],
    })
  })

  it('tolerates generous whitespace, tabs, newlines and full-width spaces', () => {
    const expected = {
      type: 'and',
      children: [{ type: 'or', children: [TODAY_NODE, OVERDUE] }, prio(1)],
    }
    expect(one('   (  today \t |\n  overdue  )   &   p1   ')).toEqual(expected)
    expect(one('(　today　|　overdue　)　&　p1')).toEqual(expected)
    expect(one('no      date')).toEqual({ type: 'noDate' })
  })

  it('splits top-level commas into groups', () => {
    const result = parseFilter('p1 & overdue, p4 & today')
    expect(result).toEqual({
      ok: true,
      ast: [
        { type: 'and', children: [prio(1), OVERDUE] },
        { type: 'and', children: [prio(4), TODAY_NODE] },
      ],
    })
  })

  it('splits date lists such as "date: yesterday, today"', () => {
    const result = parseFilter('date: yesterday, today')
    expect(result.ok && result.ast).toHaveLength(2)
  })

  it('rejects commas inside parentheses', () => {
    const error = fail('(today, overdue)')
    expect(error.position).toBe(6)
    expect(error.message).toContain('쉼표')
  })
})

describe('parseFilter: dates', () => {
  it('parses date: with iso, korean and english forms', () => {
    expect(one('date: 2026-10-30')).toEqual({
      type: 'date',
      field: 'date',
      op: 'on',
      value: { kind: 'iso', date: '2026-10-30' },
    })
    expect(one('date: 10월 30일')).toMatchObject({ value: { kind: 'monthDay', month: 10, day: 30 } })
    expect(one('date: Oct 30')).toMatchObject({ value: { kind: 'monthDay', month: 10, day: 30 } })
    expect(one('date:Oct 30')).toMatchObject({ value: { kind: 'monthDay', month: 10, day: 30 } })
    expect(one('날짜: 오늘')).toEqual(TODAY_NODE)
  })

  it('parses before and after with every prefix spelling', () => {
    const before = {
      type: 'date',
      field: 'date',
      op: 'before',
      value: { kind: 'iso', date: '2026-05-05' },
    }
    for (const q of [
      'date before: 2026-05-05',
      'before: 2026-05-05',
      '날짜이전: 2026-05-05',
      '날짜 이전: 2026-05-05',
    ]) {
      expect(one(q)).toEqual(before)
    }
    for (const q of ['date after: 2026-05-05', 'after: 2026-05-05', '날짜이후: 2026-05-05']) {
      expect(one(q)).toEqual({ ...before, op: 'after' })
    }
  })

  it('maps deadline and due keywords to the deadline field', () => {
    const base = { type: 'date', field: 'deadline' }
    expect(one('deadline: today')).toMatchObject({ ...base, op: 'on' })
    expect(one('마감: 내일')).toMatchObject({ ...base, op: 'on', value: { kind: 'offset', days: 1 } })
    expect(one('deadline before: today')).toMatchObject({ ...base, op: 'before' })
    expect(one('deadline after: today')).toMatchObject({ ...base, op: 'after' })
    expect(one('마감이전: today')).toMatchObject({ ...base, op: 'before' })
    expect(one('마감이후: today')).toMatchObject({ ...base, op: 'after' })
    expect(one('due before: today')).toMatchObject({ ...base, op: 'before' })
    expect(one('due after: today')).toMatchObject({ ...base, op: 'after' })
  })

  it('parses created with before and after', () => {
    expect(one('created: today')).toMatchObject({ type: 'date', field: 'created', op: 'on' })
    expect(one('생성: 오늘')).toMatchObject({ field: 'created', op: 'on' })
    expect(one('created before: 2026-01-01')).toMatchObject({ field: 'created', op: 'before' })
    expect(one('created after: 2026-01-01')).toMatchObject({ field: 'created', op: 'after' })
    expect(one('생성이전: 2026-01-01')).toMatchObject({ field: 'created', op: 'before' })
  })

  it('stops a date value at an operator', () => {
    expect(one('date: Oct 30 & p1')).toEqual({
      type: 'and',
      children: [
        { type: 'date', field: 'date', op: 'on', value: { kind: 'monthDay', month: 10, day: 30 } },
        prio(1),
      ],
    })
  })

  it('parses day windows', () => {
    expect(one('7 days')).toEqual({ type: 'dateWindow', direction: 'next', days: 7 })
    expect(one('7일')).toEqual({ type: 'dateWindow', direction: 'next', days: 7 })
    expect(one('7 일')).toEqual({ type: 'dateWindow', direction: 'next', days: 7 })
    expect(one('1 day')).toEqual({ type: 'dateWindow', direction: 'next', days: 1 })
    expect(one('next 5 days')).toEqual({ type: 'dateWindow', direction: 'next', days: 5 })
    expect(one('다음 5일')).toEqual({ type: 'dateWindow', direction: 'next', days: 5 })
    expect(one('-3 days')).toEqual({ type: 'dateWindow', direction: 'past', days: 3 })
    expect(one('-3일')).toEqual({ type: 'dateWindow', direction: 'past', days: 3 })
  })

  it('rejects zero or absurd day counts', () => {
    expect(fail('0 days').message).toContain('1 이상')
    expect(fail('99999999 days').message).toContain('일수')
  })

  it('reports unreadable and impossible dates with the value position', () => {
    const unreadable = fail('date: banana')
    expect(unreadable.message).toContain('banana')
    expect(unreadable.position).toBe(6)
    expect(fail('date: 2026-02-30').message).toContain('존재하지 않는')
    expect(fail('date: 13월 1일').message).toContain('존재하지 않는')
    expect(fail('p1 & date:').message).toContain('날짜가 필요')
  })
})

describe('parseFilter: properties', () => {
  it('parses priorities and rejects p5', () => {
    for (const level of [1, 2, 3, 4]) expect(one(`p${level}`)).toEqual(prio(level))
    const error = fail('p5')
    expect(error.message).toBe('알 수 없는 조건 "p5"입니다')
    expect(error.position).toBe(0)
  })

  it('parses projects with and without subprojects', () => {
    expect(one('#Work')).toEqual(project('Work'))
    expect(one('##Work')).toEqual(project('Work', true))
    expect(one('#업무')).toEqual(project('업무'))
  })

  it('parses escaped and quoted names', () => {
    expect(one('#Shopping\\ list')).toEqual(project('Shopping list'))
    expect(one('#One\\&Two')).toEqual(project('One&Two'))
    expect(one('#"My Project"')).toEqual(project('My Project'))
    expect(one('#Work & p1')).toEqual({ type: 'and', children: [project('Work'), prio(1)] })
  })

  it('parses wildcards as name segments and escaped stars as literals', () => {
    expect(one('#Work*')).toEqual({ type: 'project', name: ['Work', ''], includeChildren: false })
    expect(one('#*work*')).toEqual({ type: 'project', name: ['', 'work', ''], includeChildren: false })
    expect(one('#a\\*b')).toEqual(project('a*b'))
  })

  it('parses sections and both label prefixes', () => {
    expect(one('/Planning')).toEqual({ type: 'section', name: ['Planning'] })
    expect(one('/기획')).toEqual({ type: 'section', name: ['기획'] })
    expect(one('@urgent')).toEqual({ type: 'label', name: ['urgent'] })
    expect(one('%urgent')).toEqual({ type: 'label', name: ['urgent'] })
    expect(one('%work*')).toEqual({ type: 'label', name: ['work', ''] })
  })

  it('parses numeric comparisons', () => {
    expect(one('postponed >= 3')).toEqual({ type: 'compare', field: 'postponed', op: '>=', value: 3 })
    expect(one('postponed>3')).toEqual({ type: 'compare', field: 'postponed', op: '>', value: 3 })
    expect(one('미룸 < 2')).toEqual({ type: 'compare', field: 'postponed', op: '<', value: 2 })
    expect(one('postponed = 0')).toEqual({ type: 'compare', field: 'postponed', op: '=', value: 0 })
    expect(one('estimate > 30m')).toEqual({ type: 'compare', field: 'estimate', op: '>', value: 30 })
    expect(one('예상 > 30분')).toEqual({ type: 'compare', field: 'estimate', op: '>', value: 30 })
    expect(one('estimate <= 1h30m')).toEqual({ type: 'compare', field: 'estimate', op: '<=', value: 90 })
    expect(one('예상 >= 1시간 30분')).toEqual({ type: 'compare', field: 'estimate', op: '>=', value: 90 })
    expect(one('estimate = 45')).toEqual({ type: 'compare', field: 'estimate', op: '=', value: 45 })
  })

  it('parses search values', () => {
    expect(one('search: Meeting')).toEqual({ type: 'search', text: 'Meeting', needle: 'meeting' })
    expect(one('검색: 단어')).toEqual({ type: 'search', text: '단어', needle: '단어' })
    expect(one('search: "send email"')).toEqual({
      type: 'search',
      text: 'send email',
      needle: 'send email',
    })
    expect(one('search: http://x.io/a')).toMatchObject({ text: 'http://x.io/a' })
    expect(one('search: a\\&b')).toMatchObject({ text: 'a&b' })
    expect(one('search: "say \\"hi\\""')).toMatchObject({ text: 'say "hi"' })
    expect(one('search: Meeting | search: Work')).toMatchObject({ type: 'or' })
  })
})

describe('parseFilter: errors', () => {
  it('rejects empty and blank queries', () => {
    expect(parseFilter('').ok).toBe(false)
    expect(parseFilter('   \n ').ok).toBe(false)
    expect(fail('').position).toBe(0)
  })

  it('does not treat a bare word as a search', () => {
    const error = fail('meeting')
    expect(error.message).toBe('알 수 없는 조건 "meeting"입니다')
    expect(error.position).toBe(0)
  })

  it('points at the unknown keyword inside a larger query', () => {
    const error = fail('today & foo')
    expect(error.message).toBe('알 수 없는 조건 "foo"입니다')
    expect(error.position).toBe(8)
    expect(fail('(today | 오타) & p1').position).toBe(9)
  })

  it('explains that unquoted search values cannot contain spaces', () => {
    const error = fail('search: send email')
    expect(error.position).toBe(13)
    expect(error.message).toContain('따옴표')
  })

  it('reports unmatched parentheses at the right place', () => {
    const open = fail('(today & p1')
    expect(open.position).toBe(0)
    expect(open.message).toContain(')')
    const close = fail('today)')
    expect(close.position).toBe(5)
    expect(fail('((today)').position).toBe(0)
    expect(fail('(today))').position).toBe(7)
  })

  it('rejects empty parentheses', () => {
    expect(fail('()').message).toContain('괄호')
    expect(fail('p1 & ()').position).toBe(6)
  })

  it('rejects unterminated quotes', () => {
    const search = fail('search: "abc')
    expect(search.message).toContain('따옴표')
    expect(search.position).toBe(8)
    expect(fail('"abc').message).toContain('따옴표')
    expect(fail('#"abc').message).toContain('따옴표')
  })

  it('rejects dangling and doubled operators', () => {
    expect(fail('today &').position).toBe(7)
    expect(fail('& today').position).toBe(0)
    expect(fail('today | | p1').position).toBe(8)
    expect(fail('today,').position).toBe(6)
    expect(fail(',today').position).toBe(0)
    expect(fail('!').position).toBe(1)
  })

  it('requires an operator between conditions', () => {
    const error = fail('p1 p2')
    expect(error.position).toBe(3)
    expect(error.message).toContain('&')
  })

  it('rejects incomplete properties', () => {
    expect(fail('#').message).toContain('프로젝트')
    expect(fail('##').message).toContain('프로젝트')
    expect(fail('/').message).toContain('섹션')
    expect(fail('@').message).toContain('라벨')
    expect(fail('%').message).toContain('라벨')
    expect(fail('search:').message).toContain('검색어')
    expect(fail('estimate').message).toContain('estimate')
    expect(fail('estimate > abc').message).toContain('abc')
    expect(fail('postponed > x').message).toContain('x')
    expect(fail('postponed >').message).toContain('횟수')
    expect(fail('date').message).toContain(':')
    expect(fail('today: x').message).toContain(':')
  })

  it('rejects a dangling escape', () => {
    expect(fail('#Work\\').message).toContain('이스케이프')
  })

  it('reports colon after unknown keyword as unknown condition', () => {
    expect(fail('foo: bar').message).toBe('알 수 없는 조건 "foo"입니다')
  })

  it('rejects stray comparators', () => {
    expect(fail('> 3').message).toContain('알 수 없는 조건')
  })

  it('fails gracefully on extreme nesting', () => {
    const deep = `${'('.repeat(500)}today${')'.repeat(500)}`
    const error = fail(deep)
    expect(error.message).toContain('중첩')
    const bangs = `${'!'.repeat(500)}today`
    expect(fail(bangs).message).toContain('중첩')
  })

  it('accepts moderate nesting', () => {
    expect(parseFilter(`${'('.repeat(20)}today${')'.repeat(20)}`).ok).toBe(true)
  })
})
