import { beforeEach, describe, expect, it, vi } from 'vitest'
import { indexById } from '../../domain/planning/shared'
import { makeBulkContext, makeBulkTasks } from '../../test/bulk'
import { smartListCounts, smartListGroups } from './smartLists'

// 색인 생성 횟수를 세려고 indexById 를 감싼다(동작은 그대로).
vi.mock('../../domain/planning/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../domain/planning/shared')>()
  return { ...actual, indexById: vi.fn(actual.indexById) }
})

const BULK = 10_000
// 이전 구현은 1만 개에서 약 13~15초가 걸렸다. 느린 CI·병렬 실행에서도 흔들리지 않게 넉넉히 잡는다.
const BUDGET_MS = 2_000

describe('smart lists with 10,000 tasks', () => {
  beforeEach(() => {
    vi.mocked(indexById).mockClear()
  })

  it('builds the "now" list with a single id index', () => {
    const ctx = makeBulkContext(makeBulkTasks(BULK))

    const groups = smartListGroups('now', ctx)

    expect(indexById).toHaveBeenCalledTimes(1)
    expect(groups.reduce((n, g) => n + g.tasks.length, 0)).toBeGreaterThan(0)
  })

  it('builds the sidebar counts with a bounded number of id indexes', () => {
    const ctx = makeBulkContext(makeBulkTasks(BULK))

    smartListCounts(ctx)

    // 오늘 목록과 "지금 할 수 있는 것" 이 각각 한 번씩만 만든다(작업 수와 무관).
    expect(vi.mocked(indexById).mock.calls.length).toBeLessThanOrEqual(2)
  })

  it('computes the "now" list and the sidebar counts within the budget', () => {
    const ctx = makeBulkContext(makeBulkTasks(BULK))
    const started = performance.now()

    smartListGroups('now', ctx)
    const counts = smartListCounts(ctx)

    expect(performance.now() - started).toBeLessThan(BUDGET_MS)
    expect(counts.now).toBeGreaterThan(0)
  })
})
