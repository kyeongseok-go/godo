import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeBulkContext, makeBulkTasks } from '../../test/bulk'
import { makeActionableChecker } from './actionable'
import { indexById } from './shared'

// 색인 생성 횟수를 세려고 shared 의 indexById 를 감싼다(동작은 그대로).
vi.mock('./shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./shared')>()
  return { ...actual, indexById: vi.fn(actual.indexById) }
})

const BULK = 10_000
// 이전 구현은 1만 개에서 13초 넘게 걸렸다. 느린 CI 에서도 흔들리지 않게 넉넉히 잡는다.
const BUDGET_MS = 2_000

describe('makeActionableChecker performance', () => {
  beforeEach(() => {
    vi.mocked(indexById).mockClear()
  })

  it('builds the id index exactly once no matter how many tasks it checks', () => {
    const ctx = makeBulkContext(makeBulkTasks(BULK))

    const check = makeActionableChecker(ctx)
    ctx.tasks.filter(check)

    expect(indexById).toHaveBeenCalledTimes(1)
  })

  it('checks 10,000 tasks well within the budget', () => {
    const ctx = makeBulkContext(makeBulkTasks(BULK))
    const started = performance.now()

    const ready = ctx.tasks.filter(makeActionableChecker(ctx))

    expect(performance.now() - started).toBeLessThan(BUDGET_MS)
    expect(ready.length).toBeGreaterThan(0)
  })
})
