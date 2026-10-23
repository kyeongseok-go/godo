import { describe, expect, it } from 'vitest'
import { makeProject, makeTask } from '../../test/factories'
import { describeFilter, parseFilter, runFilter, suggestCompletions } from './index'
import { makeCtx } from './testContext'

/** 재현 가능한 의사 난수(LCG). 실패 시 같은 입력을 다시 만들 수 있다. */
function lcg(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296
    return state / 4_294_967_296
  }
}

const PIECES = [
  'today', 'overdue', 'no date', 'p1', 'p4', '#Work', '##Work', '/섹션', '%x', '@y*', 'search:',
  'date:', 'date before:', 'deadline:', '7 days', '-3 days', 'next', 'estimate', '>=', '<', '30m',
  'postponed', '"', '\\', '(', ')', '&', '|', '!', ',', ':', ' ', '  ', '\n', '*', '10월 30일',
  'Oct 30', '2026-02-30', '오늘', '완료', 'view all', '😀', '　',
]

function randomQuery(next: () => number): string {
  const length = 1 + Math.floor(next() * 8)
  let query = ''
  for (let i = 0; i < length; i += 1) query += PIECES[Math.floor(next() * PIECES.length)]
  return query
}

describe('robustness', () => {
  it('never throws on random input and always returns a well-formed result', () => {
    const next = lcg(20261023)
    const ctx = makeCtx({
      projects: [makeProject({ id: 'p', name: 'Work' })],
      tasks: [makeTask({ projectId: 'p', startDate: '2026-10-23' })],
    })
    for (let i = 0; i < 3000; i += 1) {
      const query = randomQuery(next)
      const parsed = parseFilter(query)
      if (parsed.ok) {
        expect(parsed.ast.length).toBeGreaterThan(0)
        expect(runFilter(query, ctx).ok).toBe(true)
        expect(describeFilter(query)).not.toBe('')
      } else {
        expect(parsed.error.message).not.toBe('')
        expect(parsed.error.position).toBeGreaterThanOrEqual(0)
        expect(parsed.error.position).toBeLessThanOrEqual(query.length)
        expect(describeFilter(query)).toBe('')
      }
      expect(Array.isArray(suggestCompletions(query))).toBe(true)
    }
  })

  it('handles very long queries without blowing the stack', () => {
    const wide = Array.from({ length: 5000 }, () => 'p1').join(' | ')
    expect(parseFilter(wide).ok).toBe(true)
    const chained = Array.from({ length: 5000 }, () => '!p1').join(' & ')
    expect(parseFilter(chained).ok).toBe(true)
  })

  it('does not slow down on pathological wildcard names', () => {
    const name = 'a'.repeat(5000)
    const project = makeProject({ id: 'p', name })
    const ctx = makeCtx({ projects: [project], tasks: [makeTask({ projectId: 'p' })] })
    const start = performance.now()
    const result = runFilter(`#${'*a'.repeat(200)}*b`, ctx)
    expect(result.ok && result.groups[0]).toHaveLength(0)
    expect(performance.now() - start).toBeLessThan(500)
  })
})
