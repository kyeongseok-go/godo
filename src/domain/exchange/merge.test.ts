import { describe, expect, it } from 'vitest'
import { makeLabel, makeProject, makeSection, makeTask } from '../../test/factories'
import { INBOX_ID } from '../types'
import type { DayPlan, Settings } from '../types'
import { emptyAppData, type AppData } from './model'
import { applyImport } from './merge'

const data = (overrides: Partial<AppData> = {}): AppData => ({ ...emptyAppData(), ...overrides })

const dayPlan = (date: string, reflection = ''): DayPlan => ({
  date,
  capacityMin: null,
  highlightIds: [],
  morningDoneAt: null,
  eveningDoneAt: null,
  reflection,
})

const settings = (accent: string): Settings =>
  ({ id: 'settings', accent }) as unknown as Settings

describe('applyImport replace', () => {
  it('returns the incoming data and drops what was only in the current data', () => {
    const current = data({ tasks: [makeTask({ id: 'old' })] })
    const incoming = data({ tasks: [makeTask({ id: 'new' })] })

    const result = applyImport(current, incoming, 'replace')

    expect(result.data.tasks.map((t) => t.id)).toEqual(['new'])
  })

  it('counts incoming items as added or updated by id', () => {
    const current = data({ tasks: [makeTask({ id: 'same' })] })
    const incoming = data({ tasks: [makeTask({ id: 'same' }), makeTask({ id: 'fresh' })] })

    const result = applyImport(current, incoming, 'replace')

    expect(result.added).toBe(1)
    expect(result.updated).toBe(1)
  })

  // 백업에 설정이 없다고 지금 설정까지 버리면, 테마·시간대·단축키가 조용히 기본값으로 돌아간다
  it('설정이 없는 백업으로 덮어써도 지금 설정은 지킨다', () => {
    const current = data({ settings: settings('#111') })
    expect(applyImport(current, data(), 'replace').data.settings).toEqual(settings('#111'))
  })

  it('백업에 설정이 있으면 그것으로 바꾼다', () => {
    const current = data({ settings: settings('#111') })
    const incoming = data({ settings: settings('#222') })
    expect(applyImport(current, incoming, 'replace').data.settings).toEqual(settings('#222'))
  })

  it('keeps tasks that are in the trash', () => {
    const incoming = data({ tasks: [makeTask({ id: 'trashed', deletedAt: 123 })] })
    expect(applyImport(data(), incoming, 'replace').data.tasks[0].deletedAt).toBe(123)
  })
})

describe('applyImport merge', () => {
  it('adds items that only exist in the incoming data', () => {
    const current = data({ tasks: [makeTask({ id: 'a' })] })
    const incoming = data({ tasks: [makeTask({ id: 'b' })] })

    const result = applyImport(current, incoming, 'merge')

    expect(result.data.tasks.map((t) => t.id)).toEqual(['a', 'b'])
    expect(result.added).toBe(1)
    expect(result.updated).toBe(0)
  })

  it('keeps items that only exist in the current data', () => {
    const current = data({ labels: [makeLabel({ id: 'l1' })] })
    const result = applyImport(current, data(), 'merge')
    expect(result.data.labels.map((l) => l.id)).toEqual(['l1'])
    expect(result.added).toBe(0)
  })

  it('lets the newer updatedAt win when ids collide', () => {
    const current = data({ tasks: [makeTask({ id: 'x', title: '현재', updatedAt: 200 })] })
    const incoming = data({ tasks: [makeTask({ id: 'x', title: '가져온', updatedAt: 300 })] })

    const result = applyImport(current, incoming, 'merge')

    expect(result.data.tasks[0].title).toBe('가져온')
    expect(result.updated).toBe(1)
  })

  it('keeps the current item when it is newer', () => {
    const current = data({ tasks: [makeTask({ id: 'x', title: '현재', updatedAt: 500 })] })
    const incoming = data({ tasks: [makeTask({ id: 'x', title: '가져온', updatedAt: 300 })] })

    const result = applyImport(current, incoming, 'merge')

    expect(result.data.tasks[0].title).toBe('현재')
    expect(result.updated).toBe(0)
  })

  it('keeps the current item when both have the same updatedAt', () => {
    const current = data({ tasks: [makeTask({ id: 'x', title: '현재', updatedAt: 300 })] })
    const incoming = data({ tasks: [makeTask({ id: 'x', title: '가져온', updatedAt: 300 })] })
    expect(applyImport(current, incoming, 'merge').data.tasks[0].title).toBe('현재')
  })

  it('keeps the current item for entities without updatedAt, so an old backup cannot roll back newer data', () => {
    const current = data({ labels: [makeLabel({ id: 'l', name: '현재' })] })
    const incoming = data({ labels: [makeLabel({ id: 'l', name: '가져온' })] })

    const result = applyImport(current, incoming, 'merge')

    expect(result.data.labels[0].name).toBe('현재')
    expect(result.updated).toBe(0)
  })

  it('does not count identical items as updated', () => {
    const label = makeLabel({ id: 'l' })
    const result = applyImport(data({ labels: [label] }), data({ labels: [{ ...label }] }), 'merge')
    expect(result.updated).toBe(0)
  })

  it('merges day plans by date', () => {
    const current = data({ dayPlans: [dayPlan('2026-10-01', '현재')] })
    const incoming = data({ dayPlans: [dayPlan('2026-10-01', '가져온'), dayPlan('2026-10-02')] })

    const result = applyImport(current, incoming, 'merge')

    expect(result.data.dayPlans.map((p) => p.date)).toEqual(['2026-10-01', '2026-10-02'])
    // 수정 시각이 없는 항목은 현재 쪽을 지키고, 없는 날짜만 추가한다.
    expect(result.data.dayPlans[0].reflection).toBe('현재')
    expect(result.added).toBe(1)
    expect(result.updated).toBe(0)
  })

  it('overwrites settings when incoming has them', () => {
    const current = data({ settings: settings('#111') })
    const incoming = data({ settings: settings('#222') })
    expect(applyImport(current, incoming, 'merge').data.settings).toEqual(settings('#222'))
  })

  it('keeps current settings when incoming has none', () => {
    const current = data({ settings: settings('#111') })
    expect(applyImport(current, data(), 'merge').data.settings).toEqual(settings('#111'))
  })

  it('keeps trashed tasks from both sides', () => {
    const current = data({ tasks: [makeTask({ id: 'a', deletedAt: 1 })] })
    const incoming = data({ tasks: [makeTask({ id: 'b', deletedAt: 2 })] })
    const ids = applyImport(current, incoming, 'merge').data.tasks.map((t) => [t.id, t.deletedAt])
    expect(ids).toEqual([
      ['a', 1],
      ['b', 2],
    ])
  })

  it('keeps the position of replaced items and appends new ones at the end', () => {
    const current = data({ tasks: [makeTask({ id: 'a', updatedAt: 1 }), makeTask({ id: 'b', updatedAt: 1 })] })
    const incoming = data({ tasks: [makeTask({ id: 'n' }), makeTask({ id: 'a', title: '새', updatedAt: 9 })] })
    expect(applyImport(current, incoming, 'merge').data.tasks.map((t) => t.id)).toEqual(['a', 'b', 'n'])
  })

  it('does not mutate either input', () => {
    const current = data({ tasks: [makeTask({ id: 'a', updatedAt: 1 })] })
    const incoming = data({ tasks: [makeTask({ id: 'a', title: '새', updatedAt: 9 })] })
    const before = JSON.stringify([current, incoming])
    applyImport(current, incoming, 'merge')
    expect(JSON.stringify([current, incoming])).toBe(before)
  })
})

describe('applyImport reference integrity', () => {
  it('moves tasks with an unknown project to the inbox', () => {
    const incoming = data({
      projects: [makeProject({ id: 'p1' })],
      tasks: [makeTask({ id: 'ok', projectId: 'p1' }), makeTask({ id: 'lost', projectId: 'ghost' })],
    })

    const tasks = applyImport(data(), incoming, 'merge').data.tasks

    expect(tasks.find((t) => t.id === 'ok')?.projectId).toBe('p1')
    expect(tasks.find((t) => t.id === 'lost')?.projectId).toBe(INBOX_ID)
  })

  it('treats the inbox id as always valid', () => {
    const incoming = data({ tasks: [makeTask({ id: 't', projectId: INBOX_ID })] })
    expect(applyImport(data(), incoming, 'merge').data.tasks[0].projectId).toBe(INBOX_ID)
  })

  it('accepts a project that exists only in the current data', () => {
    const current = data({ projects: [makeProject({ id: 'p1' })] })
    const incoming = data({ tasks: [makeTask({ id: 't', projectId: 'p1' })] })
    expect(applyImport(current, incoming, 'merge').data.tasks[0].projectId).toBe('p1')
  })

  it('clears a parentId that points to a missing task', () => {
    const incoming = data({
      tasks: [makeTask({ id: 'parent' }), makeTask({ id: 'child', parentId: 'parent' }), makeTask({ id: 'orphan', parentId: 'ghost' })],
    })
    const tasks = applyImport(data(), incoming, 'merge').data.tasks
    expect(tasks.find((t) => t.id === 'child')?.parentId).toBe('parent')
    expect(tasks.find((t) => t.id === 'orphan')?.parentId).toBeNull()
  })

  it('clears a task that is its own parent and breaks longer parent cycles', () => {
    const incoming = data({
      tasks: [
        makeTask({ id: 'self', parentId: 'self' }),
        makeTask({ id: 'a', parentId: 'b' }),
        makeTask({ id: 'b', parentId: 'a' }),
      ],
    })
    const tasks = applyImport(data(), incoming, 'merge').data.tasks
    expect(tasks.find((t) => t.id === 'self')?.parentId).toBeNull()
    const parents = [tasks.find((t) => t.id === 'a')?.parentId, tasks.find((t) => t.id === 'b')?.parentId]
    expect(parents.filter((p) => p === null).length).toBeGreaterThanOrEqual(1)
  })

  it('clears a sectionId that points to a missing section', () => {
    const incoming = data({
      sections: [makeSection({ id: 's1' })],
      tasks: [makeTask({ id: 'a', sectionId: 's1' }), makeTask({ id: 'b', sectionId: 'ghost' })],
    })
    const tasks = applyImport(data(), incoming, 'replace').data.tasks
    expect(tasks[0].sectionId).toBe('s1')
    expect(tasks[1].sectionId).toBeNull()
  })

  it('also repairs references after a replace', () => {
    const incoming = data({ tasks: [makeTask({ id: 'lost', projectId: 'ghost' })] })
    expect(applyImport(data(), incoming, 'replace').data.tasks[0].projectId).toBe(INBOX_ID)
  })

  it('repairs a task whose parent was replaced by the merge', () => {
    // 현재 쪽 부모 'p' 는 그대로이므로 가져온 자식의 parentId 가 유지된다
    const current = data({ tasks: [makeTask({ id: 'p' })] })
    const incoming = data({ tasks: [makeTask({ id: 'c', parentId: 'p' })] })
    expect(applyImport(current, incoming, 'merge').data.tasks.find((t) => t.id === 'c')?.parentId).toBe('p')
  })
})

describe('applyImport 참조 복구', () => {
  it('자기 자신을 막는 작업은 막힘을 비운다', () => {
    const incoming = data({ tasks: [makeTask({ id: 'a', blockedBy: ['a'] })] })
    expect(applyImport(data(), incoming, 'replace').data.tasks[0].blockedBy).toEqual([])
  })

  it('사라진 작업을 가리키는 막힘은 걷어낸다', () => {
    const incoming = data({ tasks: [makeTask({ id: 'a', blockedBy: ['gone', 'b'] }), makeTask({ id: 'b' })] })
    expect(applyImport(data(), incoming, 'replace').data.tasks[0].blockedBy).toEqual(['b'])
  })

  it('서로 막는 순환은 한쪽만 남겨 둘 다 영원히 막히지 않게 한다', () => {
    const incoming = data({
      tasks: [makeTask({ id: 'b', blockedBy: ['c'] }), makeTask({ id: 'c', blockedBy: ['b'] })],
    })
    const tasks = applyImport(data(), incoming, 'replace').data.tasks
    expect(tasks.find((t) => t.id === 'b')?.blockedBy).toEqual(['c'])
    expect(tasks.find((t) => t.id === 'c')?.blockedBy).toEqual([])
  })

  it('정상적인 막힘은 그대로 둔다', () => {
    const incoming = data({ tasks: [makeTask({ id: 'a', blockedBy: ['b'] }), makeTask({ id: 'b' })] })
    expect(applyImport(data(), incoming, 'replace').data.tasks[0].blockedBy).toEqual(['b'])
  })

  it('프로젝트끼리의 순환을 끊어 사이드바에서 사라지지 않게 한다', () => {
    const incoming = data({
      projects: [makeProject({ id: 'p1', parentId: 'p2' }), makeProject({ id: 'p2', parentId: 'p1' })],
    })
    const projects = applyImport(data(), incoming, 'replace').data.projects
    expect(projects.find((p) => p.id === 'p1')?.parentId).toBeNull()
    expect(projects.find((p) => p.id === 'p2')?.parentId).toBe('p1')
  })

  it('사라진 상위 프로젝트를 가리키면 최상위로 올린다', () => {
    const incoming = data({ projects: [makeProject({ id: 'p1', parentId: 'gone' })] })
    expect(applyImport(data(), incoming, 'replace').data.projects[0].parentId).toBeNull()
  })
})
