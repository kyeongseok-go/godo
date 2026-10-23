import { describe, expect, it } from 'vitest'
import { emptyEntityState } from '../../store/changes'
import { defaultSettings } from '../../store/defaults'
import { makeLabel, makeProject, makeTask } from '../../test/factories'
import { emptyAppData } from '../../domain/exchange'
import { appDataChanges, collectAppData, summarizeAppData } from './appData'

describe('collectAppData', () => {
  it('gathers every table and the settings into one AppData', () => {
    const task = makeTask({ id: 'a' })
    const project = makeProject({ id: 'p' })
    const entities = {
      ...emptyEntityState(),
      tasks: { a: task },
      projects: { p: project },
      dayPlans: {
        '2026-10-23': { date: '2026-10-23', capacityMin: null, highlightIds: [], morningDoneAt: null, eveningDoneAt: null, reflection: '' },
      },
    }
    const settings = defaultSettings()

    const data = collectAppData({ entities, settings })

    expect(data.tasks).toEqual([task])
    expect(data.projects).toEqual([project])
    expect(data.dayPlans).toHaveLength(1)
    expect(data.settings).toBe(settings)
    expect(data.labels).toEqual([])
  })

  it('includes tasks that are in the trash', () => {
    const trashed = makeTask({ id: 't', deletedAt: 5 })
    const data = collectAppData({ entities: { ...emptyEntityState(), tasks: { t: trashed } }, settings: defaultSettings() })

    expect(data.tasks).toEqual([trashed])
  })

  it('does not mutate or alias the entity maps', () => {
    const entities = { ...emptyEntityState(), tasks: { a: makeTask({ id: 'a' }) } }
    const data = collectAppData({ entities, settings: defaultSettings() })

    data.tasks.push(makeTask({ id: 'b' }))

    expect(Object.keys(entities.tasks)).toEqual(['a'])
  })
})

describe('appDataChanges', () => {
  it('puts only items that are new or replaced', () => {
    const kept = makeTask({ id: 'kept' })
    const before = { ...emptyAppData(), tasks: [kept] }
    const added = makeTask({ id: 'added' })
    const changed = { ...kept, id: 'kept', title: '바뀜' }
    const after = { ...emptyAppData(), tasks: [changed, added] }

    const cs = appDataChanges(before, after)

    expect(cs.puts.tasks).toEqual([changed, added])
    expect(cs.deletes.tasks ?? []).toEqual([])
  })

  it('skips items that are the very same object', () => {
    const same = makeTask({ id: 'same' })
    const cs = appDataChanges({ ...emptyAppData(), tasks: [same] }, { ...emptyAppData(), tasks: [same] })

    expect(cs.puts.tasks ?? []).toEqual([])
  })

  it('deletes ids that disappeared', () => {
    const gone = makeLabel({ id: 'gone' })
    const cs = appDataChanges({ ...emptyAppData(), labels: [gone] }, emptyAppData())

    expect(cs.deletes.labels).toEqual(['gone'])
  })

  it('keys day plans by date', () => {
    const plan = { date: '2026-01-01', capacityMin: 60, highlightIds: [], morningDoneAt: null, eveningDoneAt: null, reflection: '' }
    const cs = appDataChanges({ ...emptyAppData(), dayPlans: [plan] }, emptyAppData())

    expect(cs.deletes.dayPlans).toEqual(['2026-01-01'])
  })
})

describe('summarizeAppData', () => {
  it('lists only non-empty collections with Korean labels', () => {
    const data = { ...emptyAppData(), tasks: [makeTask(), makeTask()], labels: [makeLabel()] }

    expect(summarizeAppData(data)).toEqual([
      { key: 'tasks', label: '할 일', count: 2 },
      { key: 'labels', label: '라벨', count: 1 },
    ])
  })

  it('returns an empty list for empty data', () => {
    expect(summarizeAppData(emptyAppData())).toEqual([])
  })
})
