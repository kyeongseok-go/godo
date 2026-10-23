import { describe, expect, it } from 'vitest'
import { makeTask } from '../../test/factories'
import { currentTaskId, recordDecision, startDecisionFlow, stripAutos, withAutoSkips } from './decisionFlow'
import type { DecisionRecord } from './decisionFlow'

type D = 'keep' | 'gone'
const tasks = ['a', 'b', 'c', 'd'].map((id) => makeTask({ id }))
const empty = { puts: {}, deletes: {} }
const real = (taskId: string): DecisionRecord<D> => ({ taskId, decision: 'keep', inverse: empty })

describe('withAutoSkips', () => {
  it('leaves a flow alone when nothing is gone', () => {
    const flow = recordDecision(startDecisionFlow<D>(tasks), real('a'))
    const derived = withAutoSkips(flow, () => null)
    expect(derived.records).toEqual(flow.records)
    expect(currentTaskId(derived)).toBe('b')
  })

  it('skips the cards that are already gone and marks them automatic', () => {
    const flow = startDecisionFlow<D>(tasks)
    const derived = withAutoSkips(flow, (id) => (id === 'a' || id === 'b' ? 'gone' : null))
    expect(derived.records.map((r) => [r.taskId, r.auto])).toEqual([
      ['a', true],
      ['b', true],
    ])
    expect(currentTaskId(derived)).toBe('c')
  })

  it('keeps the user choices in order around automatic ones', () => {
    const raw = { queue: ['a', 'b', 'c', 'd'], records: [real('a'), real('c')] }
    const derived = withAutoSkips(raw, (id) => (id === 'b' ? 'gone' : null))
    expect(derived.records.map((r) => r.taskId)).toEqual(['a', 'b', 'c'])
    expect(currentTaskId(derived)).toBe('d')
  })

  it('finishes the flow when every remaining card is gone', () => {
    const derived = withAutoSkips(startDecisionFlow<D>(tasks), () => 'gone')
    expect(derived.records).toHaveLength(4)
    expect(currentTaskId(derived)).toBeNull()
  })

  it('does not mutate its input', () => {
    const flow = startDecisionFlow<D>(tasks)
    withAutoSkips(flow, () => 'gone')
    expect(flow.records).toHaveLength(0)
  })
})

describe('stripAutos', () => {
  it('drops automatic records only', () => {
    const raw = { queue: ['a', 'b', 'c'], records: [real('a'), real('c')] }
    const derived = withAutoSkips(raw, (id) => (id === 'b' ? 'gone' : null))
    expect(stripAutos(derived).records.map((r) => r.taskId)).toEqual(['a', 'c'])
  })
})
