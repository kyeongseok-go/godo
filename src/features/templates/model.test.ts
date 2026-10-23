import { describe, expect, it } from 'vitest'
import type { Template } from '../../domain/types'
import { countTemplateTasks, parseTemplatePayload } from './model'
import type { TemplateTaskNode } from './model'
import { node } from './nodeFixture'

const template = (kind: Template['kind'], payload: unknown): Pick<Template, 'kind' | 'payload'> => ({ kind, payload })

describe('parseTemplatePayload', () => {
  it('accepts a task payload with nested children', () => {
    const payload = { version: 1, root: node({ title: '출장', children: [node({ title: '항공권', children: [node()] })] }) }

    const parsed = parseTemplatePayload(template('task', payload))

    expect(parsed.ok && parsed.kind === 'task' && parsed.payload.root.children[0].title).toBe('항공권')
  })

  it('accepts a project payload', () => {
    const payload = {
      version: 1,
      project: { color: '#2b4c7e', icon: null, defaultView: 'board' },
      sections: [{ name: '준비', category: null }],
      tasks: [{ section: 0, node: node() }, { section: null, node: node() }],
    }

    const parsed = parseTemplatePayload(template('project', payload))

    expect(parsed.ok && parsed.kind === 'project' && parsed.payload.tasks).toHaveLength(2)
  })

  it('rejects non-object payloads with a Korean message', () => {
    expect(parseTemplatePayload(template('task', 'oops'))).toEqual({ ok: false, error: '템플릿 내용을 읽지 못했어요.' })
    expect(parseTemplatePayload(template('task', null)).ok).toBe(false)
  })

  it('rejects a payload of the wrong kind', () => {
    const projectPayload = { version: 1, project: { color: '#000', icon: null, defaultView: 'list' }, sections: [], tasks: [] }

    expect(parseTemplatePayload(template('task', projectPayload)).ok).toBe(false)
  })

  it('rejects an unknown version', () => {
    expect(parseTemplatePayload(template('task', { version: 2, root: node() })).ok).toBe(false)
  })

  it('rejects a node with an invalid priority', () => {
    const bad = { version: 1, root: { ...node(), priority: 9 } }

    expect(parseTemplatePayload(template('task', bad)).ok).toBe(false)
  })

  it('rejects a section index that does not exist', () => {
    const payload = {
      version: 1,
      project: { color: '#000', icon: null, defaultView: 'list' },
      sections: [],
      tasks: [{ section: 3, node: node() }],
    }

    expect(parseTemplatePayload(template('project', payload)).ok).toBe(false)
  })

  it('accepts a recurrence with an until offset', () => {
    const recurrence = {
      freq: 'weekly' as const,
      interval: 1,
      byWeekday: [1, 3] as (0 | 1 | 2 | 3 | 4 | 5 | 6)[],
      anchor: 'due' as const,
      end: { type: 'untilOffset' as const, days: 30 },
      resetSubtasks: true,
    }

    expect(parseTemplatePayload(template('task', { version: 1, root: node({ recurrence }) })).ok).toBe(true)
  })
})

describe('countTemplateTasks', () => {
  it('counts a task template including all descendants', () => {
    const parsed = parseTemplatePayload(template('task', { version: 1, root: node({ children: [node(), node({ children: [node()] })] }) }))

    expect(parsed.ok && countTemplateTasks(parsed)).toBe(4)
  })

  it('counts every task in a project template', () => {
    const payload = {
      version: 1,
      project: { color: '#000', icon: null, defaultView: 'list' },
      sections: [],
      tasks: [{ section: null, node: node({ children: [node()] }) }, { section: null, node: node() }],
    }
    const parsed = parseTemplatePayload(template('project', payload))

    expect(parsed.ok && countTemplateTasks(parsed)).toBe(3)
  })
})

describe('parseTemplatePayload with hostile nesting', () => {
  const chain = (depth: number): TemplateTaskNode => {
    let current = node()
    for (let i = 0; i < depth; i += 1) current = node({ children: [current] })
    return current
  }

  it('returns a failure instead of throwing when subtasks are nested thousands of levels deep', () => {
    const payload = { version: 1, root: chain(5000) }

    expect(() => parseTemplatePayload(template('task', payload))).not.toThrow()
    expect(parseTemplatePayload(template('task', payload)).ok).toBe(false)
  })

  it('returns a failure for an absurdly deep project payload', () => {
    const payload = {
      version: 1,
      project: { color: '#2b4c7e', icon: null, defaultView: 'list' },
      sections: [],
      tasks: [{ section: null, node: chain(20_000) }],
    }

    expect(parseTemplatePayload(template('project', payload)).ok).toBe(false)
  })

  it('still accepts a realistic 50-level subtask chain', () => {
    const parsed = parseTemplatePayload(template('task', { version: 1, root: chain(50) }))

    expect(parsed.ok && countTemplateTasks(parsed)).toBe(51)
  })
})
