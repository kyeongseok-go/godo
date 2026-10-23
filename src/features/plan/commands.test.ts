import { describe, expect, it } from 'vitest'
import type { DayPlan, Task } from '../../domain/types'
import { makeTask } from '../../test/factories'
import { applyChangeSet, emptyEntityState } from '../../store/changes'
import type { ChangeSet, EntityState } from '../../store/changes'
import {
  applyPlacements,
  dayPlanOf,
  emptyDayPlan,
  finishEvening,
  finishMorning,
  pushToDay,
  scheduleTasks,
  setCapacity,
  setHighlights,
} from './commands'

const TODAY = '2026-03-10'
const NOW = 1_800_000_000_000

const stateWith = (tasks: Task[] = [], plans: DayPlan[] = []): EntityState =>
  applyChangeSet(emptyEntityState(), { puts: { tasks, dayPlans: plans }, deletes: {} }).next
const run = (state: EntityState, cs: ChangeSet): EntityState => applyChangeSet(state, cs).next

describe('dayPlanOf', () => {
  it('returns an empty plan for a day nobody planned yet', () => {
    expect(dayPlanOf(emptyEntityState(), TODAY)).toEqual(emptyDayPlan(TODAY))
    expect(emptyDayPlan(TODAY)).toEqual({
      date: TODAY,
      capacityMin: null,
      highlightIds: [],
      morningDoneAt: null,
      eveningDoneAt: null,
      reflection: '',
    })
  })
})

describe('setCapacity', () => {
  it('stores a per-day capacity keyed by date', () => {
    const next = run(emptyEntityState(), setCapacity(emptyEntityState(), TODAY, 300))
    expect(next.dayPlans[TODAY].capacityMin).toBe(300)
  })

  it('goes back to the default with null and keeps other fields', () => {
    const state = stateWith([], [{ ...emptyDayPlan(TODAY), capacityMin: 300, reflection: '좋은 날' }])
    const next = run(state, setCapacity(state, TODAY, null))
    expect(next.dayPlans[TODAY]).toMatchObject({ capacityMin: null, reflection: '좋은 날' })
  })

  it('rejects a non-positive capacity as a no-op', () => {
    expect(setCapacity(emptyEntityState(), TODAY, 0)).toEqual({ puts: {}, deletes: {} })
    expect(setCapacity(emptyEntityState(), TODAY, -30)).toEqual({ puts: {}, deletes: {} })
  })
})

describe('setHighlights', () => {
  it('keeps at most three unique ids in the given order', () => {
    const next = run(emptyEntityState(), setHighlights(emptyEntityState(), TODAY, ['a', 'b', 'a', 'c', 'd']))
    expect(next.dayPlans[TODAY].highlightIds).toEqual(['a', 'b', 'c'])
  })
})

describe('finishMorning / finishEvening', () => {
  it('stamps the morning ritual time', () => {
    const next = run(emptyEntityState(), finishMorning(emptyEntityState(), TODAY, NOW))
    expect(next.dayPlans[TODAY].morningDoneAt).toBe(NOW)
  })

  it('saves the trimmed reflection and stamps the evening ritual', () => {
    const next = run(emptyEntityState(), finishEvening(emptyEntityState(), TODAY, '  잘 마무리함  ', NOW))
    expect(next.dayPlans[TODAY]).toMatchObject({ reflection: '잘 마무리함', eveningDoneAt: NOW })
  })

  it('keeps the first evening time when the reflection is edited again', () => {
    const state = stateWith([], [{ ...emptyDayPlan(TODAY), eveningDoneAt: 111 }])
    const next = run(state, finishEvening(state, TODAY, '수정', NOW))
    expect(next.dayPlans[TODAY].eveningDoneAt).toBe(111)
  })

  it('leaves an earlier morning stamp alone', () => {
    const state = stateWith([], [{ ...emptyDayPlan(TODAY), morningDoneAt: 5, highlightIds: ['a'] }])
    const next = run(state, finishEvening(state, TODAY, '회고', NOW))
    expect(next.dayPlans[TODAY]).toMatchObject({ morningDoneAt: 5, highlightIds: ['a'] })
  })
})

describe('scheduleTasks', () => {
  it('puts the tasks on the day or takes the date away', () => {
    const state = stateWith([makeTask({ id: 'a' }), makeTask({ id: 'b', startDate: TODAY })])
    const added = run(state, scheduleTasks(state, ['a'], TODAY, NOW))
    expect(added.tasks.a.startDate).toBe(TODAY)
    const removed = run(added, scheduleTasks(added, ['b'], null, NOW))
    expect(removed.tasks.b.startDate).toBeNull()
  })
})

describe('pushToDay', () => {
  it('moves tasks to the day and counts each as a postponement, in one change set', () => {
    const state = stateWith([
      makeTask({ id: 'a', startDate: TODAY, postponeCount: 1 }),
      makeTask({ id: 'b', startDate: TODAY }),
    ])
    const next = run(state, pushToDay(state, ['a', 'b'], '2026-03-11', NOW))
    expect(next.tasks.a).toMatchObject({ startDate: '2026-03-11', postponeCount: 2 })
    expect(next.tasks.b).toMatchObject({ startDate: '2026-03-11', postponeCount: 1 })
  })

  it('skips ids that do not exist', () => {
    expect(pushToDay(emptyEntityState(), ['nope'], '2026-03-11', NOW)).toEqual({ puts: {}, deletes: {} })
  })
})

describe('applyPlacements', () => {
  it('writes the suggested time and length onto each task', () => {
    const state = stateWith([makeTask({ id: 'a', startDate: TODAY, estimateMin: 45 })])
    const cs = applyPlacements(
      state,
      [{ taskId: 'a', date: TODAY, startTime: '10:15', durationMin: 45 }],
      NOW,
    )
    const next = run(state, cs)
    expect(next.tasks.a).toMatchObject({ startDate: TODAY, startTime: '10:15', durationMin: 45 })
  })

  it('can be reverted with the inverse change', () => {
    const state = stateWith([makeTask({ id: 'a', startDate: TODAY })])
    const cs = applyPlacements(state, [{ taskId: 'a', date: TODAY, startTime: '09:00', durationMin: 30 }], NOW)
    const { next, inverse } = applyChangeSet(state, cs)
    expect(applyChangeSet(next, inverse).next.tasks.a.startTime).toBeNull()
  })
})
