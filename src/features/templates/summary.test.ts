import { describe, expect, it } from 'vitest'
import { node } from './nodeFixture'
import { describeTemplate } from './summary'

describe('describeTemplate', () => {
  it('describes a single task', () => {
    expect(describeTemplate({ kind: 'task', payload: { version: 1, root: node() } })).toBe('할 일 1개')
  })

  it('counts subtasks separately', () => {
    const payload = { version: 1, root: node({ children: [node(), node()] }) }

    expect(describeTemplate({ kind: 'task', payload })).toBe('할 일 1개 + 하위 작업 2개')
  })

  it('describes a project with sections', () => {
    const payload = {
      version: 1,
      project: { color: '#000', icon: null, defaultView: 'list' },
      sections: [{ name: 'a', category: null }],
      tasks: [{ section: 0, node: node() }],
    }

    expect(describeTemplate({ kind: 'project', payload })).toBe('섹션 1개 · 할 일 1개')
  })

  it('describes a project without sections', () => {
    const payload = { version: 1, project: { color: '#000', icon: null, defaultView: 'list' }, sections: [], tasks: [] }

    expect(describeTemplate({ kind: 'project', payload })).toBe('할 일 0개')
  })

  it('says so when the payload is unreadable', () => {
    expect(describeTemplate({ kind: 'task', payload: 42 })).toBe('내용을 읽을 수 없어요')
  })
})
